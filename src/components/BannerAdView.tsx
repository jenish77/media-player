/**
 * Reusable Banner Ad Component for Nova Player
 *
 * Uses Google AdMob anchored adaptive banner size, handles no-fill / error states
 * gracefully without crashing or layout jumping, and respects user consent.
 */

import React, { useState, useCallback, memo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { getAdConfig } from '../services/ads/adConfig';
import { adConsentManager } from '../services/ads/adConsentManager';
import { darkTheme } from '../theme/colors';

interface BannerAdViewProps {
  style?: any;
}

export const BannerAdView: React.FC<BannerAdViewProps> = memo(({ style }) => {
  const [adLoaded, setAdLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const config = getAdConfig();
  const canRequest = adConsentManager.getCanRequestAds();

  const handleAdLoaded = useCallback(() => {
    setAdLoaded(true);
    setHasError(false);
    console.log('[BannerAdView] Banner ad successfully loaded.');
  }, []);

  const handleAdFailedToLoad = useCallback((error: any) => {
    setAdLoaded(false);
    setHasError(true);
    console.warn('[BannerAdView] Banner ad failed to load (no-fill or network):', error?.message || error);
  }, []);

  // Do not render anything if ads are disabled, consent forbids requests, unit ID is missing, or ad errored
  if (!config.isAdsEnabled || !config.bannerUnitId || !canRequest || hasError) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {/* 
        Container wraps the BannerAd. Adaptive banner dynamically calculates width.
        Before loading, container maintains minimal height to minimize layout shifts.
      */}
      <View style={[styles.adWrapper, !adLoaded && styles.loadingPlaceholder]}>
        <BannerAd
          unitId={config.bannerUnitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          onAdLoaded={handleAdLoaded}
          onAdFailedToLoad={handleAdFailedToLoad}
          requestOptions={{
            requestNonPersonalizedAdsOnly: false,
          }}
        />
      </View>
    </View>
  );
});

BannerAdView.displayName = 'BannerAdView';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: darkTheme.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: darkTheme.borderSubtle,
    overflow: 'hidden',
  },
  adWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingPlaceholder: {
    minHeight: Platform.OS === 'android' ? 50 : 50,
  },
});
