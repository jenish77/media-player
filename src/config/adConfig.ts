import { Platform } from 'react-native';
import { isExpoGo } from '../utils/environment';

/**
 * AdMob Configuration for Nova Player
 *
 * Reads ad unit keys securely from environment variables (process.env.EXPO_PUBLIC_*).
 * Uses official Google AdMob test banner IDs in preview builds to guarantee ad visibility.
 * Uses live production IDs in production EAS builds.
 * Automatically disables ads in Expo Go where native Google Mobile Ads module is unavailable.
 */

// Google official sample test banner unit IDs (always fill, show "Test Ad" label)
const TEST_BANNER_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_BANNER_IOS = 'ca-app-pub-3940256099942544/2934735716';

// Google official sample test interstitial unit IDs
const TEST_INTERSTITIAL_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_INTERSTITIAL_IOS = 'ca-app-pub-3940256099942544/4411468910';

const ANDROID_BANNER_ID =
  process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID || TEST_BANNER_ANDROID;

const IOS_BANNER_ID =
  process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID || TEST_BANNER_IOS;

const ANDROID_INTERSTITIAL_ID =
  process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_UNIT_ID || TEST_INTERSTITIAL_ANDROID;

const IOS_INTERSTITIAL_ID =
  process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_UNIT_ID || TEST_INTERSTITIAL_IOS;

let _TestIds: any = null;
let _adsAvailable = false;

// Only attempt to load native AdMob when NOT running in Expo Go
if (!isExpoGo) {
  try {
    const adsModule = require('react-native-google-mobile-ads');
    _TestIds = adsModule.TestIds;
    _adsAvailable = true;
    console.log('[adConfig] ✅ Native ads module loaded successfully');
  } catch (e) {
    _adsAvailable = false;
    console.warn('[adConfig] ❌ Native ads module NOT available:', e);
  }
} else {
  console.log('[adConfig] Expo Go detected — ads disabled');
}

/** Whether the Google Mobile Ads native module is available in the current environment */
export const isAdsAvailable = _adsAvailable;

/**
 * Returns the appropriate banner ad unit ID based on platform and environment.
 * In __DEV__ mode: returns SDK built-in test IDs.
 * In release builds: returns the env var value (test banner in preview, real banner in production).
 */
export function getBannerAdUnitId(): string {
  if (isExpoGo || !_adsAvailable) return '';

  // In dev mode, always use SDK test IDs for safety
  if (__DEV__ && _TestIds?.BANNER) {
    console.log('[adConfig] __DEV__ mode — using SDK TestIds.BANNER:', _TestIds.BANNER);
    return _TestIds.BANNER;
  }

  const unitId = Platform.select({
    android: ANDROID_BANNER_ID,
    ios: IOS_BANNER_ID,
    default: '',
  }) ?? '';

  console.log('[adConfig] Release mode — banner unitId:', unitId);
  return unitId;
}

/**
 * Returns the appropriate interstitial ad unit ID based on platform and environment.
 * In __DEV__ mode: returns SDK built-in test IDs.
 * In release builds: returns the configured env var or official sample test ID.
 */
export function getInterstitialAdUnitId(): string {
  if (isExpoGo || !_adsAvailable) return '';

  if (__DEV__ && _TestIds?.INTERSTITIAL) {
    return _TestIds.INTERSTITIAL;
  }

  const unitId = Platform.select({
    android: ANDROID_INTERSTITIAL_ID,
    ios: IOS_INTERSTITIAL_ID,
    default: '',
  }) ?? '';

  return unitId;
}

/**
 * Ad request configuration
 */
export const AD_REQUEST_OPTIONS = {
  requestNonPersonalizedAdsOnly: true,
};
