import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { getDatabase } from '../../services/database/db';
import { useSettingsStore } from '../../store/useSettingsStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { playbackPersistence } from '../../services/playbackPersistence';
import { darkTheme } from '../../theme/colors';

interface AppProviderProps {
  children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const { loadSettings } = useSettingsStore();
  const { pause, state, currentMedia, currentTimeMs } = usePlaybackStore();

  useEffect(() => {
    async function initializeApp() {
      try {
        await getDatabase();
        await loadSettings();
      } catch (err) {
        console.warn('Initialization warning:', err);
      } finally {
        setIsReady(true);
      }
    }

    initializeApp();

    // App state listener to handle backgrounding / pause / persist
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState.match(/inactive|background/)) {
        playbackPersistence.flush();
        if (state === 'playing') {
          pause();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [state]);

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
