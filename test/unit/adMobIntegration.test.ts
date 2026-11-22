import {
  getAdConfig,
  GOOGLE_TEST_APP_ID,
  GOOGLE_TEST_BANNER_ID,
  GOOGLE_TEST_INTERSTITIAL_ID,
  PRODUCTION_AD_CONFIG,
  AD_FREQUENCY_CONFIG,
  validateAdConfigForRelease,
} from '../../src/services/ads/adConfig';
import { adConsentManager } from '../../src/services/ads/adConsentManager';
import { interstitialAdController } from '../../src/services/ads/interstitialAdController';
import { usePlaybackStore } from '../../src/store/usePlaybackStore';
import { AdsConsent } from 'react-native-google-mobile-ads';

describe('AdMob Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    interstitialAdController.resetSession();
  });

  describe('Ad Configuration & Safety', () => {
    it('returns test ad units in development mode', () => {
      const config = getAdConfig();
      expect(config.isAdsEnabled).toBe(true);
      expect(config.isTestMode).toBe(true);
      expect(config.bannerUnitId).toBe(GOOGLE_TEST_BANNER_ID);
      expect(config.interstitialUnitId).toBe(GOOGLE_TEST_INTERSTITIAL_ID);
      expect(GOOGLE_TEST_APP_ID).toBe('ca-app-pub-3940256099942544~3347511713');
    });

    it('has sensible frequency capping defaults to prevent user annoyance', () => {
      expect(AD_FREQUENCY_CONFIG.minIntervalBetweenInterstitialsMs).toBe(60000);
      expect(AD_FREQUENCY_CONFIG.maxInterstitialsPerSession).toBe(4);
      expect(AD_FREQUENCY_CONFIG.minWatchDurationForExitAdMs).toBe(15000);
    });

    it('validates configuration correctly for production safety', () => {
      // In dev mode, validateAdConfigForRelease is true
      expect(validateAdConfigForRelease()).toBe(true);

      // Simulate non-dev mode
      const originalDev = (globalThis as any).__DEV__;
      try {
        (globalThis as any).__DEV__ = false;
        // Without production IDs, it should return false (safe fallback)
        expect(validateAdConfigForRelease()).toBe(false);

        // With valid production IDs, it should return true
        PRODUCTION_AD_CONFIG.bannerAdUnitId = 'ca-app-pub-1234567890123456/1111111111';
        PRODUCTION_AD_CONFIG.interstitialAdUnitId = 'ca-app-pub-1234567890123456/2222222222';
        expect(validateAdConfigForRelease()).toBe(true);
      } finally {
        PRODUCTION_AD_CONFIG.bannerAdUnitId = '';
        PRODUCTION_AD_CONFIG.interstitialAdUnitId = '';
        (globalThis as any).__DEV__ = originalDev;
      }
    });
  });

  describe('AdConsentManager (UMP & Consent)', () => {
    it('initializes UMP consent and Mobile Ads SDK', async () => {
      const state = await adConsentManager.initializeConsentAndAds();
      expect(state.isInitialized).toBe(true);
      expect(state.canRequestAds).toBe(true);
      expect(adConsentManager.getCanRequestAds()).toBe(true);
    });

    it('allows opening privacy options form on demand', async () => {
      const result = await adConsentManager.showPrivacyOptions();
      expect(result).toBe(true);
      expect(AdsConsent.showPrivacyOptionsForm).toHaveBeenCalled();
    });

    it('resets consent state for testing purposes', async () => {
      await adConsentManager.resetConsentForTesting();
      expect(AdsConsent.reset).toHaveBeenCalled();
      const state = adConsentManager.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.canRequestAds).toBe(false);
    });
  });

  describe('InterstitialAdController & Navigation Safety', () => {
    it('initializes and preloads interstitial without throwing', () => {
      expect(() => interstitialAdController.preload()).not.toThrow();
    });

    it('executes navigation immediately if video watch duration is below threshold (<15s)', async () => {
      const onAdDismissed = jest.fn();
      const shortWatchDurationMs = 5000; // 5 seconds < 15 seconds threshold

      await interstitialAdController.showIfEligible(onAdDismissed, shortWatchDurationMs);

      expect(onAdDismissed).toHaveBeenCalledTimes(1);
    });

    it('executes navigation immediately if playback state is actively playing', async () => {
      const onAdDismissed = jest.fn();

      // Simulate playback store active state
      usePlaybackStore.setState({ state: 'playing' });

      await interstitialAdController.showIfEligible(onAdDismissed, 30000);

      expect(onAdDismissed).toHaveBeenCalledTimes(1);
      usePlaybackStore.setState({ state: 'idle' });
    });

    it('executes navigation immediately if user is scrubbing or seeking', async () => {
      const onAdDismissed = jest.fn();

      usePlaybackStore.setState({ isSeeking: true });
      await interstitialAdController.showIfEligible(onAdDismissed, 30000);
      expect(onAdDismissed).toHaveBeenCalledTimes(1);

      onAdDismissed.mockClear();
      usePlaybackStore.setState({ isSeeking: false, isScrubbing: true });
      await interstitialAdController.showIfEligible(onAdDismissed, 30000);
      expect(onAdDismissed).toHaveBeenCalledTimes(1);

      usePlaybackStore.setState({ isScrubbing: false });
    });

    it('enforces frequency capping interval between consecutive interstitials', async () => {
      const onDismiss1 = jest.fn();
      const onDismiss2 = jest.fn();

      // First presentation after a 60s watch
      await interstitialAdController.showIfEligible(onDismiss1, 60000);
      expect(onDismiss1).toHaveBeenCalledTimes(1);

      // Immediate second exit after a 30s watch (within 60s cooldown)
      await interstitialAdController.showIfEligible(onDismiss2, 30000);
      expect(onDismiss2).toHaveBeenCalledTimes(1);

      // Session impressions should not have doubled due to cooldown
      const state = interstitialAdController.getState();
      expect(state.sessionImpressions).toBeLessThanOrEqual(1);
    });

    it('enforces max interstitials per session cap', async () => {
      // Simulate session reaching max impressions
      (interstitialAdController as any).sessionImpressions =
        AD_FREQUENCY_CONFIG.maxInterstitialsPerSession;

      const onDismiss = jest.fn();
      await interstitialAdController.showIfEligible(onDismiss, 60000);

      // Should bypass ad and immediately navigate
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
