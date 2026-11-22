/**
 * Interstitial Ad Controller for Nova Player
 *
 * Manages preloading, lifecycle tracking, frequency capping,
 * and safe, non-disruptive presentation of interstitial ads.
 */

import {
  InterstitialAd,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { getAdConfig, AD_FREQUENCY_CONFIG } from './adConfig';
import { adConsentManager } from './adConsentManager';
import { usePlaybackStore } from '../../store/usePlaybackStore';

export interface InterstitialState {
  isLoaded: boolean;
  isLoading: boolean;
  isShowing: boolean;
  sessionImpressions: number;
  lastImpressionTimestamp: number | null;
}

class InterstitialAdController {
  private interstitial: InterstitialAd | null = null;
  private isLoaded = false;
  private isLoading = false;
  private isShowing = false;
  private sessionImpressions = 0;
  private lastImpressionTimestamp: number | null = null;
  private listeners: (() => void)[] = [];
  private onDismissCallback: (() => void) | null = null;

  getState(): InterstitialState {
    return {
      isLoaded: this.isLoaded,
      isLoading: this.isLoading,
      isShowing: this.isShowing,
      sessionImpressions: this.sessionImpressions,
      lastImpressionTimestamp: this.lastImpressionTimestamp,
    };
  }

  /**
   * Preloads an interstitial ad if consent is obtained and unit ID is available.
   */
  preload(): void {
    if (this.isLoading || this.isLoaded || this.isShowing) {
      return;
    }

    const config = getAdConfig();
    if (!config.isAdsEnabled || !config.interstitialUnitId) {
      return;
    }

    if (!adConsentManager.getCanRequestAds()) {
      return;
    }

    if (this.sessionImpressions >= AD_FREQUENCY_CONFIG.maxInterstitialsPerSession) {
      return;
    }

    try {
      this.cleanup();
      this.isLoading = true;

      const ad = InterstitialAd.createForAdRequest(config.interstitialUnitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
        this.isLoaded = true;
        this.isLoading = false;
        console.log('[InterstitialController] Interstitial ad preloaded and ready.');
      });

      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('[InterstitialController] Interstitial ad closed by user.');
        this.handleAdClosedOrFailed();
      });

      const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
        console.warn('[InterstitialController] Interstitial ad failed to load or show:', error);
        this.handleAdClosedOrFailed();
      });

      this.listeners = [unsubLoaded, unsubClosed, unsubError];
      this.interstitial = ad;
      ad.load();
    } catch (err: any) {
      console.warn('[InterstitialController] Failed to initiate interstitial preload:', err?.message || err);
      this.isLoading = false;
      this.isLoaded = false;
    }
  }

  /**
   * Checks whether the current context is strictly safe and eligible to show an interstitial.
   * NEVER shows an ad during active video playback, scrubbing, seeking, buffering, or screen lock.
   */
  isEligibleToShow(watchDurationMs?: number): boolean {
    const config = getAdConfig();
    if (!config.isAdsEnabled || !config.interstitialUnitId) {
      return false;
    }

    if (!this.isLoaded || !this.interstitial || this.isShowing) {
      return false;
    }

    // 1. Session frequency cap check
    if (this.sessionImpressions >= AD_FREQUENCY_CONFIG.maxInterstitialsPerSession) {
      return false;
    }

    // 2. Minimum interval cooldown check
    const now = Date.now();
    if (
      this.lastImpressionTimestamp !== null &&
      now - this.lastImpressionTimestamp < AD_FREQUENCY_CONFIG.minIntervalBetweenInterstitialsMs
    ) {
      return false;
    }

    // 3. Minimum watch duration check (e.g. at least 15s before showing exit ad)
    if (
      typeof watchDurationMs === 'number' &&
      watchDurationMs < AD_FREQUENCY_CONFIG.minWatchDurationForExitAdMs
    ) {
      return false;
    }

    // 4. Strict playback state safety checks
    const playbackState = usePlaybackStore.getState();
    if (
      playbackState.isSeeking ||
      playbackState.isScrubbing ||
      playbackState.isLocked ||
      playbackState.state === 'playing' ||
      playbackState.state === 'buffering'
    ) {
      return false;
    }

    return true;
  }

  /**
   * Attempts to show the interstitial.
   * If eligible and ready, presents the ad and invokes onDismiss when finished.
   * If NOT ready or NOT eligible, returns false and IMMEDIATELY invokes onDismiss,
   * guaranteeing that user navigation is NEVER blocked or delayed.
   */
  showIfEligible(onDismiss: () => void, watchDurationMs?: number): boolean {
    if (!this.isEligibleToShow(watchDurationMs)) {
      onDismiss();
      return false;
    }

    this.onDismissCallback = onDismiss;
    this.isShowing = true;
    this.isLoaded = false;

    try {
      this.sessionImpressions += 1;
      this.lastImpressionTimestamp = Date.now();
      console.log(
        `[InterstitialController] Presenting interstitial impression #${this.sessionImpressions}`
      );
      this.interstitial?.show();
      return true;
    } catch (err: any) {
      console.warn('[InterstitialController] Failed to display interstitial:', err?.message || err);
      this.handleAdClosedOrFailed();
      return false;
    }
  }

  private handleAdClosedOrFailed(): void {
    this.isShowing = false;
    this.isLoaded = false;
    this.isLoading = false;

    const callback = this.onDismissCallback;
    this.onDismissCallback = null;
    if (callback) {
      try {
        callback();
      } catch (err) {
        console.warn('[InterstitialController] onDismiss callback error:', err);
      }
    }

    // Clean up current instance and schedule a preload for the next eligible transition
    this.cleanup();
    setTimeout(() => {
      this.preload();
    }, 1500);
  }

  private cleanup(): void {
    if (this.listeners.length > 0) {
      this.listeners.forEach((unsub) => {
        try {
          unsub();
        } catch {}
      });
      this.listeners = [];
    }
    this.interstitial = null;
  }

  /**
   * Resets session counters (e.g. when app starts fresh)
   */
  resetSession(): void {
    this.sessionImpressions = 0;
    this.lastImpressionTimestamp = null;
    this.cleanup();
    this.isLoaded = false;
    this.isLoading = false;
    this.isShowing = false;
  }
}

export const interstitialAdController = new InterstitialAdController();
