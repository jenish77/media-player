import { Platform } from 'react-native';
import { isExpoGo } from '../utils/environment';

/**
 * AdMob Configuration for Nova Player
 *
 * Reads ad unit keys securely from environment variables (process.env.EXPO_PUBLIC_*).
 * Uses official Google AdMob test IDs in preview / development to prevent policy violations.
 * Uses live production IDs in production EAS builds.
 * Automatically disables ads in Expo Go where native Google Mobile Ads module is unavailable.
 */

// Google official sample test banner unit IDs
const TEST_BANNER_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_BANNER_IOS = 'ca-app-pub-3940256099942544/2934735716';

const ANDROID_BANNER_ID =
  process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID || TEST_BANNER_ANDROID;

const IOS_BANNER_ID =
  process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID || TEST_BANNER_IOS;

let _TestIds: any = null;
let _adsAvailable = false;

// Only attempt to load native AdMob when NOT running in Expo Go
if (!isExpoGo) {
  try {
    const adsModule = require('react-native-google-mobile-ads');
    _TestIds = adsModule.TestIds;
    _adsAvailable = true;
  } catch (e) {
    _adsAvailable = false;
  }
}

/** Whether the Google Mobile Ads native module is available in the current environment */
export const isAdsAvailable = _adsAvailable;

/**
 * Returns the appropriate banner ad unit ID based on platform and environment.
 * Always returns test IDs in __DEV__ mode to comply with Google AdMob policies.
 * In preview builds, uses the test banner unit ID provided in eas.json.
 * In production builds, returns the configured production unit ID.
 */
export function getBannerAdUnitId(): string {
  if (isExpoGo || !_adsAvailable) return '';

  if (__DEV__ && _TestIds?.BANNER) {
    return _TestIds.BANNER;
  }

  return (
    Platform.select({
      android: ANDROID_BANNER_ID,
      ios: IOS_BANNER_ID,
      default: '',
    }) ?? ''
  );
}

/**
 * Ad request configuration
 */
export const AD_REQUEST_OPTIONS = {
  requestNonPersonalizedAdsOnly: true,
};
