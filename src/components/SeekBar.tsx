import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { palette } from '../theme/colors';

export interface SeekBarProps {
  currentTimeMs: number;
  durationMs: number;
  bufferedMs?: number;
  onSeek: (positionMs: number) => void;
  onScrubbingStart?: () => void;
  onScrubbingMove?: (positionMs: number) => void;
  onScrubbingEnd?: (positionMs: number) => void;
  disabled?: boolean;
}

const SeekBarComponent: React.FC<SeekBarProps> = ({
  currentTimeMs,
  durationMs,
  bufferedMs = 0,
  onSeek,
  onScrubbingStart,
  onScrubbingMove,
  onScrubbingEnd,
  disabled = false,
}) => {
  // Reanimated shared values driven on the UI thread with zero JS bridge lag
  const trackWidth = useSharedValue<number>(0);
  const progressFraction = useSharedValue<number>(0);
  const isDragging = useSharedValue<boolean>(false);

  const isDraggingRef = useRef<boolean>(false);
  const lastMoveCallTimeRef = useRef<number>(0);

  const latestRef = useRef({
    durationMs,
    onSeek,
    onScrubbingStart,
    onScrubbingMove,
    onScrubbingEnd,
    disabled,
  });

  useEffect(() => {
    latestRef.current = {
      durationMs,
      onSeek,
      onScrubbingStart,
      onScrubbingMove,
      onScrubbingEnd,
      disabled,
    };
  });

  // Sync external progress to shared value when not actively dragging
  useEffect(() => {
    if (!isDraggingRef.current) {
      const fraction = durationMs > 0 ? Math.min(1, Math.max(0, currentTimeMs / durationMs)) : 0;
      progressFraction.value = fraction;
    }
  }, [currentTimeMs, durationMs]);

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    latestRef.current.onScrubbingStart?.();
  }, []);

  const handleDragMove = useCallback((fraction: number) => {
    const dur = latestRef.current.durationMs;
    const pos = Math.round(fraction * (dur > 0 ? dur : 0));
    const now = Date.now();
    // Throttle writes to JS/Zustand: at most once every 80ms while dragging (~12fps)
    if (now - lastMoveCallTimeRef.current >= 80) {
      lastMoveCallTimeRef.current = now;
      latestRef.current.onScrubbingMove?.(pos);
    }
  }, []);

  const handleDragEnd = useCallback((fraction: number) => {
    isDraggingRef.current = false;
    const dur = latestRef.current.durationMs;
    const finalPos = Math.round(fraction * (dur > 0 ? dur : 0));
    if (latestRef.current.onScrubbingEnd) {
      latestRef.current.onScrubbingEnd(finalPos);
    } else {
      latestRef.current.onSeek(finalPos);
    }
  }, []);

  const handleDragCancel = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      const dur = latestRef.current.durationMs;
      const finalPos = Math.round(progressFraction.value * (dur > 0 ? dur : 0));
      if (latestRef.current.onScrubbingEnd) {
        latestRef.current.onScrubbingEnd(finalPos);
      } else {
        latestRef.current.onSeek(finalPos);
      }
    }
  }, []);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0) {
      trackWidth.value = width;
    }
  };

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .minDistance(0)
      .onBegin((event) => {
        'worklet';
        isDragging.value = true;
        const width = trackWidth.value;
        if (width > 0) {
          const fraction = Math.min(1, Math.max(0, event.x / width));
          progressFraction.value = fraction;
        }
        runOnJS(handleDragStart)();
      })
      .onUpdate((event) => {
        'worklet';
        const width = trackWidth.value;
        if (width > 0) {
          const fraction = Math.min(1, Math.max(0, event.x / width));
          progressFraction.value = fraction;
          runOnJS(handleDragMove)(fraction);
        }
      })
      .onEnd((event) => {
        'worklet';
        const width = trackWidth.value;
        let fraction = progressFraction.value;
        if (width > 0) {
          fraction = Math.min(1, Math.max(0, event.x / width));
          progressFraction.value = fraction;
        }
        isDragging.value = false;
        runOnJS(handleDragEnd)(fraction);
      })
      .onFinalize(() => {
        'worklet';
        isDragging.value = false;
        runOnJS(handleDragCancel)();
      });
  }, [handleDragCancel, handleDragEnd, handleDragMove, handleDragStart]);

  // UI-thread animated styles
  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${progressFraction.value * 100}%`,
    };
  });

  const animatedThumbStyle = useAnimatedStyle(() => {
    return {
      left: `${progressFraction.value * 100}%`,
      transform: [
        {
          scale: withTiming(isDragging.value ? 1.35 : 1, { duration: 150 }),
        },
      ],
    };
  });

  const duration = Math.max(1, durationMs || 0);
  const bufferPercent = durationMs > 0 ? Math.min(100, Math.max(0, (bufferedMs / duration) * 100)) : 0;

  return (
    <GestureDetector gesture={panGesture.enabled(!disabled)}>
      <View
        style={styles.touchArea}
        onLayout={handleLayout}
        testID="seek-bar"
      >
        <View style={styles.trackBackground}>
          {/* Buffered Track */}
          <View style={[styles.trackBuffered, { width: `${bufferPercent}%` }]} />
          {/* Played Progress Track */}
          <Animated.View style={[styles.trackProgress, animatedProgressStyle]} />
        </View>

        {/* Scrubber Thumb */}
        <Animated.View style={[styles.thumb, animatedThumbStyle]} />
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  touchArea: {
    height: 40,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  trackBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  trackBuffered: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 2,
  },
  trackProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: palette.primary500,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: 13,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.white,
    marginLeft: -7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
});

export const SeekBar = React.memo(SeekBarComponent);
SeekBar.displayName = 'SeekBar';
