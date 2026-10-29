import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  MessageSquare,
  Lock,
  Maximize2,
  Minimize2,
  Smartphone,
  Gauge,
  Layers,
} from 'lucide-react-native';
import { SeekBar } from './SeekBar';
import { formatDuration } from '../utils/formatters';
import { palette } from '../theme/colors';
import { typography } from '../theme/typography';
import { borderRadius, spacing } from '../theme/spacing';
import { PlayerState } from '../types/player';
import { AspectRatioMode } from '../types/media';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlaybackStore } from '../store/usePlaybackStore';

export interface PlayerControlsProps {
  visible: boolean;
  state: PlayerState;
  title: string;
  currentTimeMs?: number;
  durationMs?: number;
  bufferedMs?: number;
  playbackRate: number;
  aspectRatio: AspectRatioMode;
  orientationMode?: 'auto' | 'portrait' | 'landscape';
  isLandscape?: boolean;
  isScrubbing?: boolean;
  scrubPositionMs?: number;
  isSeeking?: boolean;
  previewPositionMs?: number | null;
  onToggleOrientation?: () => void;
  onBack: () => void;
  onTogglePlay: () => void;
  onSeek: (positionMs: number) => void;
  onScrubbingStart?: () => void;
  onScrubbingMove?: (positionMs: number) => void;
  onScrubbingEnd?: (positionMs: number) => void;
  skipSeconds?: number;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onToggleLock: () => void;
  onOpenTracksSheet: () => void;
  onCycleSpeed: () => void;
  onCycleAspectRatio: () => void;
  onDismissControls?: () => void;
}

interface ControlsTopBarProps {
  title: string;
  isLandscape: boolean;
  onBack: () => void;
  onOpenTracksSheet: () => void;
  onCycleAspectRatio: () => void;
  onToggleOrientation?: () => void;
  onToggleLock: () => void;
}

const ControlsTopBar = React.memo<ControlsTopBarProps>(({
  title,
  isLandscape,
  onBack,
  onOpenTracksSheet,
  onCycleAspectRatio,
  onToggleOrientation,
  onToggleLock,
}) => (
  <View style={styles.topBar}>
    <TouchableOpacity
      style={styles.iconButton}
      onPress={onBack}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      testID="player-back-button"
    >
      <ArrowLeft size={22} color={palette.white} />
    </TouchableOpacity>

    <Text
      style={[styles.titleText, { fontSize: isLandscape ? 15 : 14 }]}
      numberOfLines={1}
    >
      {title}
    </Text>

    <View style={styles.topRightActions}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onOpenTracksSheet}
        testID="tracks-sheet-button"
        accessibilityLabel="Audio and Subtitles"
      >
        <MessageSquare size={20} color={palette.white} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.iconButton}
        onPress={onCycleAspectRatio}
        testID="aspect-ratio-button"
        accessibilityLabel="Change Aspect Ratio"
      >
        <Layers size={20} color={palette.white} />
      </TouchableOpacity>

      {onToggleOrientation && (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onToggleOrientation}
          testID="toggle-orientation-top-button"
          accessibilityLabel={isLandscape ? 'Switch to portrait' : 'Switch to landscape'}
        >
          {isLandscape ? (
            <Smartphone size={20} color={palette.white} />
          ) : (
            <Maximize2 size={20} color={palette.white} />
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.iconButton}
        onPress={onToggleLock}
        testID="lock-screen-button"
        accessibilityLabel="Lock Controls"
      >
        <Lock size={20} color={palette.white} />
      </TouchableOpacity>
    </View>
  </View>
));
ControlsTopBar.displayName = 'ControlsTopBar';

interface ControlsCenterProps {
  isLandscape: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  state: PlayerState;
  skipSeconds: number;
  onPrevious?: () => void;
  onSkipBack: () => void;
  onTogglePlay: () => void;
  onSkipForward: () => void;
  onNext?: () => void;
}

const ControlsCenter = React.memo<ControlsCenterProps>(({
  isLandscape,
  hasPrevious,
  hasNext,
  state,
  skipSeconds,
  onPrevious,
  onSkipBack,
  onTogglePlay,
  onSkipForward,
  onNext,
}) => {
  const isPlaying = state === 'playing';
  const isLoading = state === 'loading' || state === 'buffering';

  return (
    <View
      style={[
        styles.centerControls,
        { gap: isLandscape ? spacing.xxl : spacing.md },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={[styles.skipButton, !hasPrevious && styles.disabledButton]}
        onPress={onPrevious}
        disabled={!hasPrevious}
        activeOpacity={0.7}
        testID="previous-button"
        accessibilityLabel="Previous Video"
      >
        <SkipBack
          size={isLandscape ? 28 : 24}
          color={hasPrevious ? palette.white : palette.slate500}
          fill={hasPrevious ? palette.white : palette.slate500}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.skipButton}
        onPress={onSkipBack}
        activeOpacity={0.7}
        testID="skip-back-button"
        accessibilityLabel={`Skip backward ${skipSeconds} seconds`}
      >
        <RotateCcw size={isLandscape ? 32 : 28} color={palette.white} />
        <Text style={styles.skipLabel}>{skipSeconds}s</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.playPauseButton,
          isLandscape ? styles.playPauseLandscape : styles.playPausePortrait,
        ]}
        onPress={onTogglePlay}
        activeOpacity={0.8}
        testID="play-pause-button"
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={palette.white} />
        ) : state === 'completed' ? (
          <RotateCcw size={isLandscape ? 36 : 30} color={palette.white} />
        ) : isPlaying ? (
          <Pause
            size={isLandscape ? 36 : 30}
            color={palette.white}
            fill={palette.white}
          />
        ) : (
          <Play
            size={isLandscape ? 36 : 30}
            color={palette.white}
            fill={palette.white}
            style={{ marginLeft: 3 }}
          />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.skipButton}
        onPress={onSkipForward}
        activeOpacity={0.7}
        testID="skip-forward-button"
        accessibilityLabel={`Skip forward ${skipSeconds} seconds`}
      >
        <RotateCw size={isLandscape ? 32 : 28} color={palette.white} />
        <Text style={styles.skipLabel}>{skipSeconds}s</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.skipButton, !hasNext && styles.disabledButton]}
        onPress={onNext}
        disabled={!hasNext}
        activeOpacity={0.7}
        testID="next-button"
        accessibilityLabel="Next Video"
      >
        <SkipForward
          size={isLandscape ? 28 : 24}
          color={hasNext ? palette.white : palette.slate500}
          fill={hasNext ? palette.white : palette.slate500}
        />
      </TouchableOpacity>
    </View>
  );
});
ControlsCenter.displayName = 'ControlsCenter';

interface ControlsSeekBarProps {
  propCurrentTimeMs?: number;
  propDurationMs?: number;
  propBufferedMs?: number;
  propPreviewPositionMs?: number | null;
  onSeek: (positionMs: number) => void;
  onScrubbingStart?: () => void;
  onScrubbingMove?: (positionMs: number) => void;
  onScrubbingEnd?: (positionMs: number) => void;
}

const ControlsSeekBar = React.memo<ControlsSeekBarProps>(({
  propCurrentTimeMs,
  propDurationMs,
  propBufferedMs,
  propPreviewPositionMs,
  onSeek,
  onScrubbingStart,
  onScrubbingMove,
  onScrubbingEnd,
}) => {
  const storeTimeMs = usePlaybackStore((s) => (propCurrentTimeMs === undefined ? s.currentTimeMs : 0));
  const storeDurationMs = usePlaybackStore((s) => (propDurationMs === undefined ? s.durationMs : 0));
  const storeBufferedMs = usePlaybackStore((s) => (propBufferedMs === undefined ? s.bufferedMs : 0));
  const storePreviewPositionMs = usePlaybackStore((s) => (propPreviewPositionMs === undefined ? s.previewPositionMs : null));

  const previewPositionMs = propPreviewPositionMs !== undefined ? propPreviewPositionMs : storePreviewPositionMs;
  const currentTimeMs =
    previewPositionMs !== null && previewPositionMs !== undefined
      ? previewPositionMs
      : propCurrentTimeMs !== undefined
      ? propCurrentTimeMs
      : storeTimeMs;
  const durationMs = propDurationMs !== undefined ? propDurationMs : storeDurationMs;
  const bufferedMs = propBufferedMs !== undefined ? propBufferedMs : storeBufferedMs;

  return (
    <SeekBar
      currentTimeMs={currentTimeMs}
      durationMs={durationMs}
      bufferedMs={bufferedMs}
      onSeek={onSeek}
      onScrubbingStart={onScrubbingStart}
      onScrubbingMove={onScrubbingMove}
      onScrubbingEnd={onScrubbingEnd}
    />
  );
});
ControlsSeekBar.displayName = 'ControlsSeekBar';

interface ControlsTimeDisplayProps {
  propCurrentTimeMs?: number;
  propDurationMs?: number;
  propIsScrubbing?: boolean;
  propScrubPositionMs?: number;
  propIsSeeking?: boolean;
  propPreviewPositionMs?: number | null;
}

const ControlsTimeDisplay = React.memo<ControlsTimeDisplayProps>(({
  propCurrentTimeMs,
  propDurationMs,
  propIsScrubbing,
  propScrubPositionMs,
  propIsSeeking,
  propPreviewPositionMs,
}) => {
  const storeTimeMs = usePlaybackStore((s) => (propCurrentTimeMs === undefined ? s.currentTimeMs : 0));
  const storeDurationMs = usePlaybackStore((s) => (propDurationMs === undefined ? s.durationMs : 0));
  const storeIsScrubbing = usePlaybackStore((s) => (propIsScrubbing === undefined ? s.isScrubbing : false));
  const storeScrubPositionMs = usePlaybackStore((s) => (propScrubPositionMs === undefined ? s.scrubPositionMs : 0));
  const storeIsSeeking = usePlaybackStore((s) => (propIsSeeking === undefined ? s.isSeeking : false));
  const storePreviewPositionMs = usePlaybackStore((s) => (propPreviewPositionMs === undefined ? s.previewPositionMs : null));

  const currentTimeMs = propCurrentTimeMs !== undefined ? propCurrentTimeMs : storeTimeMs;
  const durationMs = propDurationMs !== undefined ? propDurationMs : storeDurationMs;
  const isScrubbing = propIsScrubbing !== undefined ? propIsScrubbing : storeIsScrubbing;
  const isSeeking = propIsSeeking !== undefined ? propIsSeeking : storeIsSeeking;
  const scrubPositionMs = propScrubPositionMs !== undefined ? propScrubPositionMs : storeScrubPositionMs;
  const previewPositionMs = propPreviewPositionMs !== undefined ? propPreviewPositionMs : storePreviewPositionMs;

  const showSeekingIndicator = isScrubbing || isSeeking;
  const displayTimeMs = isScrubbing
    ? scrubPositionMs
    : previewPositionMs !== null && previewPositionMs !== undefined
    ? previewPositionMs
    : currentTimeMs;

  return (
    <View style={styles.timeRow}>
      <Text
        style={[
          styles.timeText,
          showSeekingIndicator && styles.timeTextScrubbing,
        ]}
      >
        {formatDuration(displayTimeMs)} / {formatDuration(durationMs)}
      </Text>
      {showSeekingIndicator && (
        <Text style={styles.scrubIndicator}> SEEKING</Text>
      )}
    </View>
  );
});
ControlsTimeDisplay.displayName = 'ControlsTimeDisplay';

interface ControlsBottomActionsProps {
  playbackRate: number;
  aspectRatio: AspectRatioMode;
  isLandscape: boolean;
  onCycleSpeed: () => void;
  onCycleAspectRatio: () => void;
  onToggleOrientation?: () => void;
}

const ControlsBottomActions = React.memo<ControlsBottomActionsProps>(({
  playbackRate,
  aspectRatio,
  isLandscape,
  onCycleSpeed,
  onCycleAspectRatio,
  onToggleOrientation,
}) => (
  <View style={styles.bottomControlsRight}>
    <TouchableOpacity
      style={styles.badgeButton}
      onPress={onCycleSpeed}
      testID="speed-button"
      accessibilityLabel={`Playback speed: ${playbackRate}x`}
    >
      <Gauge size={15} color={palette.accentCyan} style={{ marginRight: 3 }} />
      <Text style={styles.badgeText}>{playbackRate}x</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.badgeButton}
      onPress={onCycleAspectRatio}
      accessibilityLabel={`Aspect ratio: ${aspectRatio}`}
    >
      <Text style={styles.badgeText}>{aspectRatio.toUpperCase()}</Text>
    </TouchableOpacity>

    {onToggleOrientation && (
      <TouchableOpacity
        style={styles.badgeButton}
        onPress={onToggleOrientation}
        testID="toggle-orientation-button"
        accessibilityLabel={isLandscape ? 'Switch to portrait' : 'Switch to landscape'}
      >
        {isLandscape ? (
          <>
            <Smartphone size={14} color={palette.accentCyan} style={{ marginRight: 3 }} />
            <Text style={[styles.badgeText, { color: palette.accentCyan }]}>LAND</Text>
          </>
        ) : (
          <>
            <Maximize2 size={14} color={palette.white} style={{ marginRight: 3 }} />
            <Text style={styles.badgeText}>PORT</Text>
          </>
        )}
      </TouchableOpacity>
    )}
  </View>
));
ControlsBottomActions.displayName = 'ControlsBottomActions';

const PlayerControlsComponent: React.FC<PlayerControlsProps> = ({
  visible,
  state,
  title,
  currentTimeMs,
  durationMs,
  bufferedMs,
  playbackRate,
  aspectRatio,
  orientationMode = 'auto',
  isLandscape = false,
  isScrubbing,
  scrubPositionMs,
  isSeeking,
  previewPositionMs,
  skipSeconds = 15,
  onToggleOrientation,
  onBack,
  onTogglePlay,
  onSeek,
  onScrubbingStart,
  onScrubbingMove,
  onScrubbingEnd,
  onSkipBack,
  onSkipForward,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  onToggleLock,
  onOpenTracksSheet,
  onCycleSpeed,
  onCycleAspectRatio,
  onDismissControls,
}) => {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  // Standard Android 3-button navigation bar occupies 48dp on phone screen edges
  const navBarThickness = Platform.OS === 'android' ? 48 : 0;

  // In landscape, Android 3-button bar sits on the side (left or right).
  // Provide at least 48dp navBar + 20dp margin on Android so buttons (Lock, LAND, 1x, etc.) are never crowded against system buttons.
  const paddingLeft = isLandscape
    ? Math.max(insets.left, navBarThickness) + 20
    : Math.max(insets.left, 16);

  const paddingRight = isLandscape
    ? Math.max(insets.right, navBarThickness) + 20
    : Math.max(insets.right, 16);

  // In portrait, navigation bar is at the bottom (48dp). Ensure controls clear it comfortably.
  const effectiveBottomInset =
    !isLandscape && Platform.OS === 'android'
      ? Math.max(insets.bottom, navBarThickness)
      : insets.bottom;

  const bottomPadding = Math.max(effectiveBottomInset, isLandscape ? 16 : 24) + 8;
  const topPadding = Math.max(insets.top, isLandscape ? 14 : 24) + 6;

  return (
    <View
      style={[
        styles.overlay,
        {
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          paddingLeft: paddingLeft,
          paddingRight: paddingRight,
        },
      ]}
      pointerEvents="box-none"
      testID="player-controls"
    >
      {/* Background touch dismisser to hide controls when tapping empty area */}
      {onDismissControls && (
        <TouchableWithoutFeedback onPress={onDismissControls}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      )}

      {/* Top Header Bar */}
      <ControlsTopBar
        title={title}
        isLandscape={isLandscape}
        onBack={onBack}
        onOpenTracksSheet={onOpenTracksSheet}
        onCycleAspectRatio={onCycleAspectRatio}
        onToggleOrientation={onToggleOrientation}
        onToggleLock={onToggleLock}
      />

      {/* Center Transport Controls */}
      <ControlsCenter
        isLandscape={isLandscape}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        state={state}
        skipSeconds={skipSeconds}
        onPrevious={onPrevious}
        onSkipBack={onSkipBack}
        onTogglePlay={onTogglePlay}
        onSkipForward={onSkipForward}
        onNext={onNext}
      />

      {/* Bottom Timeline & Function Controls */}
      <View style={styles.bottomBar}>
        <ControlsSeekBar
          propCurrentTimeMs={currentTimeMs}
          propDurationMs={durationMs}
          propBufferedMs={bufferedMs}
          propPreviewPositionMs={previewPositionMs}
          onSeek={onSeek}
          onScrubbingStart={onScrubbingStart}
          onScrubbingMove={onScrubbingMove}
          onScrubbingEnd={onScrubbingEnd}
        />

        <View style={styles.bottomRow}>
          <ControlsTimeDisplay
            propCurrentTimeMs={currentTimeMs}
            propDurationMs={durationMs}
            propIsScrubbing={isScrubbing}
            propScrubPositionMs={scrubPositionMs}
            propIsSeeking={isSeeking}
            propPreviewPositionMs={previewPositionMs}
          />

          <ControlsBottomActions
            playbackRate={playbackRate}
            aspectRatio={aspectRatio}
            isLandscape={isLandscape}
            onCycleSpeed={onCycleSpeed}
            onCycleAspectRatio={onCycleAspectRatio}
            onToggleOrientation={onToggleOrientation}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleText: {
    ...typography.bodyMedium,
    color: palette.white,
    fontWeight: '600',
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconButton: {
    padding: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseButton: {
    backgroundColor: palette.primary500,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.primary500,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  playPauseLandscape: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  playPausePortrait: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  disabledButton: {
    opacity: 0.35,
  },
  skipLabel: {
    ...typography.caption,
    color: palette.white,
    marginTop: 2,
    fontWeight: '700',
    fontSize: 11,
  },
  bottomBar: {
    width: '100%',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    ...typography.mono,
    color: palette.slate200,
    fontSize: 12,
  },
  timeTextScrubbing: {
    color: palette.accentCyan,
    fontWeight: '700',
  },
  scrubIndicator: {
    ...typography.caption,
    color: palette.accentCyan,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bottomControlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    ...typography.caption,
    color: palette.white,
    fontWeight: '700',
    fontSize: 11,
  },
});

export const PlayerControls = React.memo(PlayerControlsComponent);
