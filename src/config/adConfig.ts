import { Platform } from 'react-native';
import { isExpoGo } from '../utils/environment';

/**
 * AdMob Configuration for Nova Player
 *
 * Reads ad unit keys securely from environment variables (process.env.EXPO_PUBLIC_*).
 * Uses Google test IDs in development mode (__DEV__) to avoid AdMob policy violations.
 * Automatically disables ads in Expo Go where native Google Mobile Ads module is unavailable.
 */

const ANDROID_BANNER_ID =
  process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID || '';

const IOS_BANNER_ID =
  process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID || '';

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
 * In production APK / Google Play release, returns the live environment variable key.
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
