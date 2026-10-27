import React, { useEffect } from 'react';
import { Linking, Platform, BackHandler, ToastAndroid } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Film, Folder, History, ListVideo, Settings } from 'lucide-react-native';

import { LibraryScreen } from '../../features/library/LibraryScreen';
import { FoldersScreen } from '../../features/folders/FoldersScreen';
import { HistoryScreen } from '../../features/history/HistoryScreen';
import { PlaylistsScreen } from '../../features/playlists/PlaylistsScreen';
import { SettingsScreen } from '../../features/settings/SettingsScreen';
import { PlayerScreen } from '../../features/playback/PlayerScreen';
import { PremiumScreen } from '../../features/premium/PremiumScreen';

import { palette, darkTheme } from '../../theme/colors';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { extractFileName, extractFileExtension, getContainerFromExtension, extractFolderName } from '../../utils/pathUtils';
import { MediaItem } from '../../types/media';
import { upsertMediaItem } from '../../services/database/mediaRepository';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

export const navigationRef = createNavigationContainerRef<any>();

async function handleIncomingVideoUrl(url?: string | null) {
  if (!url) return;
  try {
    const decoded = decodeURIComponent(url);
    const isVideo =
      decoded.startsWith('content://') ||
      decoded.startsWith('file://') ||
      decoded.includes('video') ||
      decoded.endsWith('.mp4') ||
      decoded.endsWith('.mkv') ||
      decoded.endsWith('.webm') ||
      decoded.endsWith('.mov') ||
      decoded.endsWith('.avi');

    if (!isVideo && !decoded.startsWith('novaplayer://')) return;

    const videoUri = decoded.startsWith('novaplayer://play?url=')
      ? decoded.replace('novaplayer://play?url=', '')
      : decoded;

    const filename = extractFileName(videoUri);
    const ext = extractFileExtension(filename);
    const now = Date.now();

    const mediaItem: MediaItem = {
      id: `ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sourceType: Platform.OS === 'android' ? 'android_saf' : 'local_file',
      sourceReference: videoUri,
      displayName: filename,
      durationMs: null,
      sizeBytes: null,
      width: null,
      height: null,
      mimeType: ext ? `video/${ext}` : 'video/*',
      container: getContainerFromExtension(ext),
      dateAdded: now,
      lastSeenAt: now,
      availabilityStatus: 'available',
      thumbnailStatus: 'none',
      thumbnailUri: null,
      lastPositionMs: 0,
      lastPlayedAt: now,
      isFavorite: false,
      folderName: extractFolderName(videoUri),
      createdAt: now,
      updatedAt: now,
    };

    await upsertMediaItem(mediaItem);
    await usePlaybackStore.getState().loadMedia(mediaItem, true);
    if (navigationRef.isReady()) {
      navigationRef.navigate('Player');
    }
  } catch (err) {
    console.warn('Failed to open incoming video:', err);
  }
}

function BottomTabs({ navigation }: any) {
  const insets = useSafeAreaInsets();
  // On Android devices with 3-button navigation, insets.bottom is often reported as 0 despite the 48dp system bar overlapping the app.
  // Enforce at least 48dp bottom clearance on Android when insets.bottom is under 48dp so labels ("Home", "Folders", etc.)
  // and icons are positioned completely above the 3-button navigation bar with comfortable padding.
  const effectiveBottomInset =
    Platform.OS === 'android'
      ? Math.max(insets.bottom, 48)
      : insets.bottom;

  const bottomPadding = Math.max(10, effectiveBottomInset);
  const barHeight = 56 + bottomPadding;

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        const navBar = require('expo-navigation-bar');
        navBar?.setStyle?.('dark');
        navBar?.setHidden?.(false);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let lastBackPressTime = 0;

    const onBackPress = () => {
      // If the root stack navigator has screens to go back to (e.g. Player, Premium), allow stack pop
      if (navigationRef.isReady() && navigationRef.canGoBack()) {
        return false;
      }

      // If the current tab navigator has back history, allow tab navigation
      if (navigation?.canGoBack && navigation.canGoBack()) {
        return false;
      }

      // At root of app (LibraryTab with no back stack): double tap back to exit
      const now = Date.now();
      if (now - lastBackPressTime < 2000) {
        BackHandler.exitApp();
        return true;
      }

      lastBackPressTime = now;
      if (ToastAndroid?.show) {
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      }
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [navigation]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: darkTheme.surface,
          borderTopColor: darkTheme.borderSubtle,
          height: barHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
        },
        tabBarActiveTintColor: palette.accentCyan,
        tabBarInactiveTintColor: palette.slate500,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="LibraryTab"
        component={LibraryScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Film size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="FoldersTab"
        component={FoldersScreen}
        options={{
          tabBarLabel: 'Folders',
          tabBarIcon: ({ color, size }) => <Folder size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => <History size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  useEffect(() => {
    Linking.getInitialURL().then(handleIncomingVideoUrl);
    const sub = Linking.addEventListener('url', (event) => handleIncomingVideoUrl(event.url));
    return () => sub.remove();
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="MainTabs"
          component={BottomTabs}
          options={{ orientation: 'portrait' }}
        />
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{
            animation: 'fade',
            orientation: 'all',
          }}
        />
        <Stack.Screen
          name="Premium"
          component={PremiumScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
