import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  BackHandler,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { PlayerControls } from '../../components/PlayerControls';
import { GestureOverlay } from '../../components/GestureOverlay';
import { SubtitleOverlay } from '../../components/SubtitleOverlay';
import { ErrorState } from '../../components/ErrorState';
import { SubtitleAudioBottomSheet } from '../subtitles/SubtitleAudioBottomSheet';
import { AspectRatioMode } from '../../types/media';

let VideoViewComponent: any = null;
try {
  const expoVideo = require('expo-video');
  VideoViewComponent = expoVideo.VideoView;
} catch (e) {}

let ScreenOrientation: any = null;
try {
  ScreenOrientation = require('expo-screen-orientation');
} catch (e) {}

let BrightnessModule: any = null;
try {
  BrightnessModule = require('expo-brightness');
} catch (e) {}

let NavigationBar: any = null;
try {
  NavigationBar = require('expo-navigation-bar');
} catch (e) {}

interface PlayerScreenProps {
  navigation: any;
  route?: any;
}

export const PlayerScreen: React.FC<PlayerScreenProps> = ({ navigation, route }) => {
  const [tracksSheetVisible, setTracksSheetVisible] = useState(false);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const state = usePlaybackStore((s) => s.state);
  const currentMedia = usePlaybackStore((s) => s.currentMedia);
  const nativePlayer = usePlaybackStore((s) => s.nativePlayer);
  const playbackRate = usePlaybackStore((s) => s.playbackRate);
  const volume = usePlaybackStore((s) => s.volume);
  const brightness = usePlaybackStore((s) => s.brightness);
  const aspectRatio = usePlaybackStore((s) => s.aspectRatio);
  const isLocked = usePlaybackStore((s) => s.isLocked);
  const areControlsVisible = usePlaybackStore((s) => s.areControlsVisible);
  const audioTracks = usePlaybackStore((s) => s.audioTracks);
  const subtitleTracks = usePlaybackStore((s) => s.subtitleTracks);
  const activeAudioTrackId = usePlaybackStore((s) => s.activeAudioTrackId);
  const activeSubtitleTrackId = usePlaybackStore((s) => s.activeSubtitleTrackId);
  const subtitleCues = usePlaybackStore((s) => s.subtitleCues);
  const subtitleDelayMs = usePlaybackStore((s) => s.subtitleDelayMs);
  const audioDelayMs = usePlaybackStore((s) => s.audioDelayMs);
  const error = usePlaybackStore((s) => s.error);
  const orientationMode = usePlaybackStore((s) => s.orientationMode);
  const hasPrevious = usePlaybackStore((s) => s.queueIndex > 0 || s.currentTimeMs > 0);
  const hasNext = usePlaybackStore((s) => s.queueIndex >= 0 && s.queueIndex + 1 < s.queue.length);

  const {
    playNext,
    playPrevious,
    toggleOrientation,
    hideControls,
    togglePlay,
    seekTo,
    skipBy,
    startScrubbing,
    moveScrubbing,
    endScrubbing,
    setPlaybackRate,
    setVolume,
    setBrightness,
    setAspectRatio,
    toggleLock,
    toggleControls,
    setAudioTrack,
    setSubtitleTrack,
    loadExternalSubtitleText,
    setSubtitleDelay,
    setAudioDelay,
    reset,
    loadMedia,
  } = usePlaybackStore.getState();

  const { settings, loadSettings } = useSettingsStore();
  const skipSeconds = settings.defaultSkipIntervalSeconds || 15;

  const isExitingRef = useRef(false);

  const cleanupPlayback = useCallback(async () => {
    try {
      if (ScreenOrientation?.lockAsync) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
      if (Platform.OS === 'android' && NavigationBar) {
        try {
          if (NavigationBar.setHidden) {
            NavigationBar.setHidden(false);
          } else if (NavigationBar.setVisibilityAsync) {
            NavigationBar.setVisibilityAsync('visible').catch(() => {});
          }
          if (NavigationBar.setStyle) {
            NavigationBar.setStyle('dark');
          }
        } catch (e) {}
      }
    } catch (e) {}
    await reset();
  }, [reset]);

  const handleExit = useCallback(async () => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;

    try {
      await cleanupPlayback();
    } finally {
      if (navigation?.canGoBack && navigation.canGoBack()) {
        navigation.goBack();
      } else if (navigation?.navigate) {
        navigation.navigate('MainTabs');
      }
    }
  }, [cleanupPlayback, navigation]);

  const isLockedRef = useRef(isLocked);
  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  useEffect(() => {
    loadSettings().catch(() => {});
  }, [loadSettings]);

  useEffect(() => {
    // Android back hardware button handler
    const backAction = () => {
      if (isLockedRef.current) {
        return true; // prevent exit while screen is locked
      }
      handleExit();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => {
      backHandler.remove();
    };
  }, []);

  useEffect(() => {
    // Initial orientation: allow sensor auto-rotation while in video player
    if (ScreenOrientation?.unlockAsync) {
      ScreenOrientation.unlockAsync().catch(() => {});
    }

    // Navigation lifecycle listeners (iOS swipe-to-back, header back, tab switch, blur)
    const unsubscribeBeforeRemove = navigation?.addListener?.('beforeRemove', () => {
      cleanupPlayback();
    });

    const unsubscribeBlur = navigation?.addListener?.('blur', () => {
      cleanupPlayback();
    });

    return () => {
      unsubscribeBeforeRemove?.();
      unsubscribeBlur?.();
      cleanupPlayback();
    };
  }, [navigation]);

  // Keep navigation bar hidden in video player for immersive full-screen playback
  useEffect(() => {
    if (Platform.OS === 'android' && NavigationBar) {
      try {
        if (NavigationBar.setHidden) {
          NavigationBar.setHidden(true);
        } else if (NavigationBar.setVisibilityAsync) {
          NavigationBar.setVisibilityAsync('hidden').catch(() => {});
        }
      } catch (e) {}
    }

    return () => {
      if (Platform.OS === 'android' && NavigationBar) {
        try {
          if (NavigationBar.setHidden) {
            NavigationBar.setHidden(false);
          } else if (NavigationBar.setVisibilityAsync) {
            NavigationBar.setVisibilityAsync('visible').catch(() => {});
          }
          if (NavigationBar.setStyle) {
            NavigationBar.setStyle('dark');
          }
        } catch (e) {}
      }
    };
  }, []);

  // Listen for device physical sensor orientation changes
  useEffect(() => {
    if (!ScreenOrientation?.addOrientationChangeListener) return;
    const subscription = ScreenOrientation.addOrientationChangeListener((evt: any) => {
      if (isLockedRef.current) return;
      const orientation = evt?.orientationInfo?.orientation;
      if (
        orientation === ScreenOrientation.Orientation?.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation?.LANDSCAPE_RIGHT
      ) {
        usePlaybackStore.setState({ orientationMode: 'landscape' });
      } else if (
        orientation === ScreenOrientation.Orientation?.PORTRAIT_UP ||
        orientation === ScreenOrientation.Orientation?.PORTRAIT_DOWN
      ) {
        usePlaybackStore.setState({ orientationMode: 'portrait' });
      }
    });

    return () => {
      try {
        ScreenOrientation.removeOrientationChangeListener?.(subscription);
      } catch (e) {}
    };
  }, []);

  // Lock orientation while screen is locked to preserve landscape/portrait without interruption
  useEffect(() => {
    if (!ScreenOrientation?.lockAsync) return;

    if (isLocked) {
      ScreenOrientation.getOrientationAsync?.()
        .then((current: any) => {
          if (
            current === ScreenOrientation.Orientation?.LANDSCAPE_LEFT ||
            current === ScreenOrientation.Orientation?.LANDSCAPE_RIGHT
          ) {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
          } else if (
            current === ScreenOrientation.Orientation?.PORTRAIT_UP ||
            current === ScreenOrientation.Orientation?.PORTRAIT_DOWN
          ) {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
          }
        })
        .catch(() => {});
    } else {
      if (orientationMode === 'landscape') {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      } else if (orientationMode === 'portrait') {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
    }
  }, [isLocked, orientationMode]);

  // Freeze auto-hide timer when tracks bottom sheet is open
  useEffect(() => {
    if (tracksSheetVisible) {
      const timer = usePlaybackStore.getState().autoHideTimer;
      if (timer) {
        clearTimeout(timer);
        usePlaybackStore.setState({ autoHideTimer: null });
      }
    } else if (state === 'playing') {
      usePlaybackStore.getState().showControlsTemporarily(4000);
    }
  }, [tracksSheetVisible, state]);

  useEffect(() => {
    let initialSysBrightness = 0.5;
    let isMounted = true;

    const initBrightness = async () => {
      try {
        if (BrightnessModule?.getBrightnessAsync) {
          const current = await BrightnessModule.getBrightnessAsync();
          if (isMounted && typeof current === 'number' && !isNaN(current) && current >= 0) {
            initialSysBrightness = current;
            setBrightness(current);
          }
        }
      } catch (e) {}
    };

    initBrightness();

    return () => {
      isMounted = false;
      try {
        if (BrightnessModule?.setBrightnessAsync) {
          BrightnessModule.setBrightnessAsync(initialSysBrightness).catch(() => {});
        }
      } catch (e) {}
    };
  }, [setBrightness]);

  const handleToggleOrientation = useCallback(async () => {
    const nextMode = toggleOrientation();
    try {
      if (!ScreenOrientation?.lockAsync) return;
      if (nextMode === 'landscape') {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
    } catch (e) {
      console.warn('Orientation toggle failed:', e);
    }
  }, [toggleOrientation]);

  const handleCycleSpeed = useCallback(async () => {
    const currentRate = usePlaybackStore.getState().playbackRate;
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(currentRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    await usePlaybackStore.getState().setPlaybackRate(nextSpeed);
  }, []);

  const handleCycleAspectRatio = useCallback(async () => {
    const currentMode = usePlaybackStore.getState().aspectRatio;
    const modes: AspectRatioMode[] = ['fit', 'fill', 'stretch', '16:9', '4:3', 'original'];
    const currentIndex = modes.indexOf(currentMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    await usePlaybackStore.getState().setAspectRatio(nextMode);
  }, []);

  const handleTogglePlay = useCallback(() => {
    usePlaybackStore.getState().togglePlay();
  }, []);

  const handleSeek = useCallback((pos: number) => {
    usePlaybackStore.getState().seekTo(pos);
  }, []);

  const handleScrubbingStart = useCallback(() => {
    usePlaybackStore.getState().startScrubbing();
  }, []);

  const handleScrubbingMove = useCallback((pos: number) => {
    usePlaybackStore.getState().moveScrubbing(pos);
  }, []);

  const handleScrubbingEnd = useCallback((pos?: number) => {
    const finalPos = typeof pos === 'number' ? pos : usePlaybackStore.getState().currentTimeMs;
    usePlaybackStore.getState().endScrubbing(finalPos);
  }, []);

  const handleSkipBack = useCallback(() => {
    skipBy(-skipSeconds);
  }, [skipBy, skipSeconds]);

  const handleSkipForward = useCallback(() => {
    skipBy(skipSeconds);
  }, [skipBy, skipSeconds]);

  const handlePrevious = useCallback(() => {
    usePlaybackStore.getState().playPrevious();
  }, []);

  const handleNext = useCallback(() => {
    usePlaybackStore.getState().playNext();
  }, []);

  const handleToggleLock = useCallback(() => {
    usePlaybackStore.getState().toggleLock();
  }, []);

  const handleDismissControls = useCallback(() => {
    usePlaybackStore.getState().hideControls();
  }, []);

  const handleSingleTap = useCallback(() => {
    usePlaybackStore.getState().toggleControls();
  }, []);

  const handleBrightnessChange = useCallback((newBrightness: number) => {
    usePlaybackStore.getState().setBrightness(newBrightness);
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    usePlaybackStore.getState().setVolume(newVolume);
  }, []);

  const handleOpenTracksSheet = useCallback(() => {
    setTracksSheetVisible(true);
  }, []);

  const handleCloseTracksSheet = useCallback(() => {
    setTracksSheetVisible(false);
  }, []);

  return (
    <View style={styles.container} testID="player-screen">
      <StatusBar hidden={true} />
      {Platform.OS === 'android' && NavigationBar?.NavigationBar && (
        <NavigationBar.NavigationBar hidden={true} />
      )}

      {/* Native Video Surface */}
      <View style={styles.videoSurface}>
        {VideoViewComponent && nativePlayer ? (
          <VideoViewComponent
            player={nativePlayer}
            style={styles.fullSurface}
            contentFit={aspectRatio === 'fill' ? 'cover' : aspectRatio === 'stretch' ? 'fill' : 'contain'}
            surfaceType={Platform.OS === 'android' ? 'surfaceView' : undefined}
            nativeControls={false}
            allowsPictureInPicture={true}
          />
        ) : (
          <View style={styles.fallbackSurface} />
        )}
      </View>

      {/* Screen Brightness Dimming Scrim Layer */}
      <View
        style={[
          styles.brightnessScrim,
          {
            opacity: Math.max(0, Math.min(0.75, (1 - brightness) * 0.75)),
          },
        ]}
        pointerEvents="none"
      />

      {/* Subtitle Rendering Overlay */}
      <SubtitleOverlay
        cues={subtitleCues}
        subtitleDelayMs={subtitleDelayMs}
        fontSize={settings.subtitleFontSize}
        textColor={settings.subtitleTextColor}
        backgroundColor={settings.subtitleBackgroundColor}
      />

      {/* Gestures (Single Tap, Double Tap Skip, Swipe Volume/Brightness, Lock) */}
      <GestureOverlay
        isLocked={isLocked}
        isLandscape={isLandscape}
        onToggleLock={handleToggleLock}
        onSingleTap={handleSingleTap}
        onDoubleTapLeft={handleSkipBack}
        onDoubleTapRight={handleSkipForward}
        onBrightnessChange={handleBrightnessChange}
        onVolumeChange={handleVolumeChange}
        currentBrightness={brightness}
        currentVolume={volume}
        skipSeconds={skipSeconds}
        gesturesEnabled={settings.gesturesEnabled}
        doubleTapSeekEnabled={settings.doubleTapSeekEnabled}
        swipeBrightnessEnabled={settings.swipeBrightnessEnabled}
        swipeVolumeEnabled={settings.swipeVolumeEnabled}
      />

      {/* On-screen Transport & Scrubber Controls */}
      {!isLocked && (
        <PlayerControls
          visible={areControlsVisible}
          state={state}
          title={currentMedia?.displayName || 'Playing Video'}
          playbackRate={playbackRate}
          aspectRatio={aspectRatio}
          orientationMode={orientationMode}
          isLandscape={isLandscape}
          skipSeconds={skipSeconds}
          onToggleOrientation={handleToggleOrientation}
          onDismissControls={handleDismissControls}
          onBack={handleExit}
          onTogglePlay={handleTogglePlay}
          onSeek={handleSeek}
          onScrubbingStart={handleScrubbingStart}
          onScrubbingMove={handleScrubbingMove}
          onScrubbingEnd={handleScrubbingEnd}
          onSkipBack={handleSkipBack}
          onSkipForward={handleSkipForward}
          onPrevious={handlePrevious}
          onNext={handleNext}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
          onToggleLock={handleToggleLock}
          onOpenTracksSheet={handleOpenTracksSheet}
          onCycleSpeed={handleCycleSpeed}
          onCycleAspectRatio={handleCycleAspectRatio}
        />
      )}

      {/* Subtitles & Audio Track Selector Bottom Sheet */}
      <SubtitleAudioBottomSheet
        visible={tracksSheetVisible}
        onClose={handleCloseTracksSheet}
        audioTracks={audioTracks}
        subtitleTracks={subtitleTracks}
        activeAudioTrackId={activeAudioTrackId}
        activeSubtitleTrackId={activeSubtitleTrackId}
        subtitleDelayMs={subtitleDelayMs}
        audioDelayMs={audioDelayMs}
        onSelectAudioTrack={setAudioTrack}
        onSelectSubtitleTrack={setSubtitleTrack}
        onLoadExternalSubtitleText={loadExternalSubtitleText}
        onSetSubtitleDelay={setSubtitleDelay}
        onSetAudioDelay={setAudioDelay}
      />

      {/* Error State Overlay */}
      {error && (
        <ErrorState
          error={error}
          onRetry={() => {
            if (currentMedia) {
              loadMedia(currentMedia, false);
            }
          }}
          onGoBack={handleExit}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  videoSurface: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullSurface: {
    width: '100%',
    height: '100%',
  },
  brightnessScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 5,
  },
  fallbackSurface: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
});
