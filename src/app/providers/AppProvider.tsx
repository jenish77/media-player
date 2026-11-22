import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { getDatabase } from '../../services/database/db';
import { useSettingsStore } from '../../store/useSettingsStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { playbackPersistence } from '../../services/playbackPersistence';
import { darkTheme } from '../../theme/colors';
import { requestMediaPermissions } from '../../services/mediaDiscovery/mediaDiscoveryService';
import { isExpoGo } from '../../utils/environment';

// Dynamically import Mobile Ads SDK only in standalone native builds
let mobileAds: any = null;
if (!isExpoGo) {
  try {
    mobileAds = require('react-native-google-mobile-ads').default;
  } catch (e) {
    // Native module not available
  }
}

interface AppProviderProps {
  children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const { loadSettings } = useSettingsStore();

  useEffect(() => {
    let mounted = true;

    async function initializeApp() {
      try {
        await getDatabase();
        await loadSettings();

        // Request media permissions so app has media access
        try {
          await requestMediaPermissions();
        } catch (permErr) {
          console.warn('Initial permission check error:', permErr);
        }

        // Initialize Google Mobile Ads SDK safely in native build (non-blocking)
        if (!isExpoGo && mobileAds) {
          try {
            const instance = typeof mobileAds === 'function' ? mobileAds() : mobileAds;
            if (instance && typeof instance.initialize === 'function') {
              instance.initialize().catch((adsErr: any) => {
                console.warn('AdMob initialize warning:', adsErr);
              });
            }
          } catch (adsErr) {
            console.warn('AdMob initialize warning:', adsErr);
          }
        }
      } catch (err) {
        console.warn('Initialization warning:', err);
      } finally {
        if (mounted) setIsReady(true);
      }
    }

    initializeApp();

    // App state listener to handle backgrounding / pause / persist
    // Read state directly from the store to avoid stale closure
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState.match(/inactive|background/)) {
        playbackPersistence.flush();
        const currentState = usePlaybackStore.getState();
        if (currentState.state === 'playing') {
          currentState.pause();
        }
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={darkTheme.accent} />
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: darkTheme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
