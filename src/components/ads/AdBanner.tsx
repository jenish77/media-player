import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { isAdsAvailable, getBannerAdUnitId, AD_REQUEST_OPTIONS } from '../../config/adConfig';
import { isExpoGo } from '../../utils/environment';
import { darkTheme } from '../../theme/colors';
import { ErrorBoundary } from '../ErrorBoundary';

// Dynamically import ads components only when running as native binary
let BannerAd: any = null;
let BannerAdSize: any = null;

if (!isExpoGo) {
  try {
    const adsModule = require('react-native-google-mobile-ads');
    BannerAd = adsModule.BannerAd;
    BannerAdSize = adsModule.BannerAdSize;
  } catch (e) {
    // Native module not available
  }
}

interface AdBannerProps {
  /**
   * Where to position the banner. Defaults to 'bottom'.
   */
  position?: 'top' | 'bottom';
}

/**
 * A reusable AdMob banner ad component for Nova Player.
 * 
 * - In Expo Go: Returns null cleanly (no native module needed, no crashes).
 * - In Production APK / Dev Build: Renders Google Adaptive Banner positioned cleanly
 *   above the bottom navigation tabs without blocking user interactions.
 */
export function AdBanner({ position = 'bottom' }: AdBannerProps) {
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  const handleAdLoaded = useCallback(() => {
    console.log('[AdBanner] ✅ Ad loaded successfully');
    setAdLoaded(true);
    setAdError(false);
  }, []);

  const handleAdFailedToLoad = useCallback((error: any) => {
    console.warn('[AdBanner] ❌ Ad failed to load:', error?.message || error?.code || error);
    setAdError(true);
    setAdLoaded(false);
  }, []);

  // In Expo Go or if native module / adUnitId is absent, render nothing
  if (isExpoGo || !isAdsAvailable || !BannerAd || !BannerAdSize) {
    return null;
  }

  const adUnitId = getBannerAdUnitId();
  console.log('[AdBanner] Rendering with unitId:', adUnitId, '| isAdsAvailable:', isAdsAvailable, '| isExpoGo:', isExpoGo);
  if (!adUnitId) {
    console.warn('[AdBanner] No adUnitId available, returning null');
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        position === 'top' ? styles.top : styles.bottom,
        !adLoaded && styles.collapsed,
      ]}
    >
      {!adError && (
        <ErrorBoundary fallback={null}>
          <BannerAd
            unitId={adUnitId}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={AD_REQUEST_OPTIONS}
            onAdLoaded={handleAdLoaded}
            onAdFailedToLoad={handleAdFailedToLoad}
          />
        </ErrorBoundary>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: darkTheme.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: darkTheme.borderSubtle,
  },
  top: {
    borderTopWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: darkTheme.borderSubtle,
  },
  bottom: {
    // Positioned neatly above the tab bar or at bottom
  },
  collapsed: {
    height: 0,
    overflow: 'hidden',
    borderTopWidth: 0,
    borderBottomWidth: 0,
  },
});
