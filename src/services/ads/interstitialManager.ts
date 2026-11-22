import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getInterstitialAdUnitId, AD_REQUEST_OPTIONS, isAdsAvailable } from '../../config/adConfig';
import { isExpoGo } from '../../utils/environment';

// Storage keys
const STORAGE_KEY_LAST_SHOWN = 'nova_interstitial_last_shown';
const STORAGE_KEY_COMPLETED_COUNT = 'nova_interstitial_completed_count';

// Frequency thresholds
export const MIN_COMPLETED_VIDEOS = 3;
export const INTERSTITIAL_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
export const MIN_WATCH_DURATION_MS = 20 * 1000; // 20 seconds of watching to count

// Lazy-load native module safely
let InterstitialAd: any = null;
let AdEventType: any = null;

if (!isExpoGo) {
  try {
    const adsModule = require('react-native-google-mobile-ads');
    InterstitialAd = adsModule.InterstitialAd;
    AdEventType = adsModule.AdEventType;
  } catch (e) {
    // Native module not available
  }
}

class InterstitialManager {
  private adInstance: any = null;
  private isAdLoading = false;
  private isAdLoaded = false;
  private completedVideosCount = 0;
  private lastAdShownTimestamp = Date.now(); // Initialized to launch time to prevent ads right after launch
  private isInitialized = false;
  private isMockMode = false;

  /**
   * Initializes the manager, restores persisted timestamps and preloads the first interstitial.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      const [storedTimestamp, storedCount] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_LAST_SHOWN),
        AsyncStorage.getItem(STORAGE_KEY_COMPLETED_COUNT),
      ]);

      if (storedTimestamp) {
        const parsed = parseInt(storedTimestamp, 10);
        if (!isNaN(parsed) && parsed > 0) {
          this.lastAdShownTimestamp = parsed;
        }
      } else {
        // First app launch: set cooldown to now so user is never prompted immediately
        this.lastAdShownTimestamp = Date.now();
        await AsyncStorage.setItem(STORAGE_KEY_LAST_SHOWN, String(this.lastAdShownTimestamp)).catch(() => {});
      }

      if (storedCount) {
        const parsedCount = parseInt(storedCount, 10);
        if (!isNaN(parsedCount) && parsedCount >= 0) {
          this.completedVideosCount = parsedCount;
        }
      }
    } catch (e) {
      // Non-blocking fallback to in-memory state
    }

    this.preload();
  }

  /**
   * Preloads an interstitial ad in the background ahead of time.
   */
  preload(): void {
    if (isExpoGo || !isAdsAvailable || !InterstitialAd || !AdEventType) {
      return;
    }

    if (this.isAdLoading || this.isAdLoaded) {
      return;
    }

    const unitId = getInterstitialAdUnitId();
    if (!unitId) return;

    try {
      this.isAdLoading = true;
      this.isAdLoaded = false;

      const ad = InterstitialAd.createForAdRequest(unitId, AD_REQUEST_OPTIONS);

      const unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
        this.isAdLoading = false;
        this.isAdLoaded = true;
        console.log('[InterstitialManager] ✅ Interstitial ad preloaded successfully');
      });

      const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        this.isAdLoaded = false;
        this.adInstance = null;
        unsubscribeLoaded();
        unsubscribeClosed();
        unsubscribeError();
        // Preload next ad for the next eligible cycle
        setTimeout(() => this.preload(), 5000);
      });

      const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, (error: any) => {
        this.isAdLoading = false;
        this.isAdLoaded = false;
        this.adInstance = null;
        console.warn('[InterstitialManager] ❌ Interstitial ad failed to load:', error?.message || error);
        unsubscribeLoaded();
        unsubscribeClosed();
        unsubscribeError();
      });

      this.adInstance = ad;
      ad.load();
    } catch (err) {
      this.isAdLoading = false;
      this.isAdLoaded = false;
      this.adInstance = null;
      console.warn('[InterstitialManager] Failed to create interstitial request:', err);
    }
  }

  /**
   * Records a completed video playback session.
   * Increments the count if the video ended naturally OR user watched for at least MIN_WATCH_DURATION_MS.
   */
  async recordVideoWatched(durationWatchedMs: number, endedNaturally: boolean): Promise<number> {
    if (endedNaturally || durationWatchedMs >= MIN_WATCH_DURATION_MS) {
      this.completedVideosCount += 1;
      await AsyncStorage.setItem(STORAGE_KEY_COMPLETED_COUNT, String(this.completedVideosCount)).catch(() => {});
      console.log(`[InterstitialManager] Video completed. Total count: ${this.completedVideosCount}/${MIN_COMPLETED_VIDEOS}`);
    }
    return this.completedVideosCount;
  }

  /**
   * Evaluates whether all conditions are met to display an interstitial ad:
   * 1. Not in Expo Go and native ads available
   * 2. User has completed at least 3 videos
   * 3. At least 10–15 minutes have passed since the last interstitial (or app install)
   * 4. An interstitial ad is loaded and ready
   */
  isEligible(): boolean {
    if (!this.isMockMode && (isExpoGo || !isAdsAvailable)) {
      return false;
    }
    if (!this.isAdLoaded || !this.adInstance) {
      return false;
    }

    const hasCompletedEnoughVideos = this.completedVideosCount >= MIN_COMPLETED_VIDEOS;
    const timeSinceLastAd = Date.now() - this.lastAdShownTimestamp;
    const isCooldownSatisfied = timeSinceLastAd >= INTERSTITIAL_COOLDOWN_MS;

    return hasCompletedEnoughVideos && isCooldownSatisfied;
  }

  /**
   * Called strictly upon exiting video playback.
   * Shows the ad if eligible; otherwise continues immediately without delaying or blocking the user.
   */
  async maybeShowOnExit(): Promise<boolean> {
    if (!this.isEligible()) {
      // Ensure we keep preloading in background if not already loaded
      if (!this.isAdLoaded && !this.isAdLoading) {
        this.preload();
      }
      return false;
    }

    try {
      console.log('[InterstitialManager] Triggering interstitial on video playback exit...');
      await this.adInstance.show();

      // Reset frequency counter & update cooldown timestamp
      this.completedVideosCount = 0;
      this.lastAdShownTimestamp = Date.now();

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_LAST_SHOWN, String(this.lastAdShownTimestamp)),
        AsyncStorage.setItem(STORAGE_KEY_COMPLETED_COUNT, '0'),
      ]).catch(() => {});

      return true;
    } catch (showError) {
      console.warn('[InterstitialManager] Error showing interstitial on exit:', showError);
      this.isAdLoaded = false;
      this.preload();
      return false;
    }
  }

  // Helper getters for diagnostics & testing
  getCompletedVideosCount(): number {
    return this.completedVideosCount;
  }

  getLastAdShownTimestamp(): number {
    return this.lastAdShownTimestamp;
  }

  setMockState(count: number, lastShown: number, isLoaded = false): void {
    this.completedVideosCount = count;
    this.lastAdShownTimestamp = lastShown;
    this.isAdLoaded = isLoaded;
    this.isMockMode = true;
    if (isLoaded) {
      this.adInstance = { show: async () => {} };
    } else {
      this.adInstance = null;
    }
  }
}

export const interstitialManager = new InterstitialManager();
