/**
 * Centralized AdMob Configuration for Nova Player
 *
 * Distinguishes between development (Google Test IDs) and production configurations.
 * Guarantees safe disabled states when configuration is missing or invalid.
 */

// Google Official Test IDs for Android AdMob
export const GOOGLE_TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
export const GOOGLE_TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
export const GOOGLE_TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

/**
 * PRODUCTION CONFIGURATION:
 * When ready to release to Google Play, the developer should provide their real
 * AdMob App ID in app.json and place real Ad Unit IDs here.
 */
export const PRODUCTION_AD_CONFIG = {
  // Replace with real production AdMob Banner Unit ID from Google AdMob console
  bannerAdUnitId: '',
  // Replace with real production AdMob Interstitial Unit ID from Google AdMob console
  interstitialAdUnitId: '',
};

/**
 * Flag to force test ads during QA/testing even in release mode.
 * In development (__DEV__ === true), test ads are ALWAYS enforced.
 */
export const FORCE_TEST_ADS_IN_RELEASE = false;

export interface AdUnitConfig {
  bannerUnitId: string | null;
  interstitialUnitId: string | null;
  isTestMode: boolean;
  isAdsEnabled: boolean;
}

/**
 * Frequency capping and policy guardrails for interstitials
 */
export const AD_FREQUENCY_CONFIG = {
  // Minimum duration (in ms) that must elapse between two interstitial displays (e.g. 60 seconds)
  minIntervalBetweenInterstitialsMs: 60 * 1000,
  // Maximum number of interstitials shown per viewing session to prevent ad fatigue
  maxInterstitialsPerSession: 4,
  // Minimum video watch duration (in ms) required before an exit ad is eligible (e.g. 15 seconds)
  minWatchDurationForExitAdMs: 15 * 1000,
};

/**
 * Resolves current ad unit IDs and mode based on environment and developer configuration.
 */
export function getAdConfig(): AdUnitConfig {
  const isDev = __DEV__ || FORCE_TEST_ADS_IN_RELEASE;

  if (isDev) {
    return {
      bannerUnitId: GOOGLE_TEST_BANNER_ID,
      interstitialUnitId: GOOGLE_TEST_INTERSTITIAL_ID,
      isTestMode: true,
      isAdsEnabled: true,
    };
  }

  // Production Mode checks
  const hasProdBanner = Boolean(
    PRODUCTION_AD_CONFIG.bannerAdUnitId &&
      PRODUCTION_AD_CONFIG.bannerAdUnitId.trim() !== '' &&
      PRODUCTION_AD_CONFIG.bannerAdUnitId !== GOOGLE_TEST_BANNER_ID
  );

  const hasProdInterstitial = Boolean(
    PRODUCTION_AD_CONFIG.interstitialAdUnitId &&
      PRODUCTION_AD_CONFIG.interstitialAdUnitId.trim() !== '' &&
      PRODUCTION_AD_CONFIG.interstitialAdUnitId !== GOOGLE_TEST_INTERSTITIAL_ID
  );

  if (!hasProdBanner && !hasProdInterstitial) {
    console.warn(
      '[AdConfig] WARNING: Production build detected without production AdMob IDs configured. ' +
        'Ads are disabled to prevent accidental live policy violations.'
    );
    return {
      bannerUnitId: null,
      interstitialUnitId: null,
      isTestMode: false,
      isAdsEnabled: false,
    };
  }

  return {
    bannerUnitId: hasProdBanner ? PRODUCTION_AD_CONFIG.bannerAdUnitId : null,
    interstitialUnitId: hasProdInterstitial ? PRODUCTION_AD_CONFIG.interstitialAdUnitId : null,
    isTestMode: false,
    isAdsEnabled: true,
  };
}

/**
 * Validates that production ad unit IDs are configured properly when building for release.
 * Returns true if valid or if running in test/dev mode.
 */
export function validateAdConfigForRelease(): boolean {
  const isDev = __DEV__ || FORCE_TEST_ADS_IN_RELEASE;
  if (isDev) {
    return true;
  }

  const hasProdBanner = Boolean(
    PRODUCTION_AD_CONFIG.bannerAdUnitId &&
      PRODUCTION_AD_CONFIG.bannerAdUnitId.trim() !== '' &&
      PRODUCTION_AD_CONFIG.bannerAdUnitId !== GOOGLE_TEST_BANNER_ID
  );

  const hasProdInterstitial = Boolean(
    PRODUCTION_AD_CONFIG.interstitialAdUnitId &&
      PRODUCTION_AD_CONFIG.interstitialAdUnitId.trim() !== '' &&
      PRODUCTION_AD_CONFIG.interstitialAdUnitId !== GOOGLE_TEST_INTERSTITIAL_ID
  );

  return hasProdBanner && hasProdInterstitial;
}

