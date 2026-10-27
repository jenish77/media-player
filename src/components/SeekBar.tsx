import React, { useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';
import { palette } from '../theme/colors';

interface SeekBarProps {
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
  const [layoutWidth, setLayoutWidth] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubPositionMs, setScrubPositionMs] = useState<number>(0);

  const containerRef = useRef<any>(null);
  const trackPageXRef = useRef<number>(0);
  const layoutWidthRef = useRef<number>(0);
  const lastMoveCallTimeRef = useRef<number>(0);

  const latestRef = useRef({
    durationMs,
    onSeek,
    onScrubbingStart,
    onScrubbingMove,
    onScrubbingEnd,
    disabled,
  });
  latestRef.current = {
    durationMs,
    onSeek,
    onScrubbingStart,
    onScrubbingMove,
    onScrubbingEnd,
    disabled,
  };

  const duration = Math.max(1, durationMs || 0);
  const current = isScrubbing ? scrubPositionMs : currentTimeMs;

  const progressPercent = durationMs > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;
  const bufferPercent = durationMs > 0 ? Math.min(100, Math.max(0, (bufferedMs / duration) * 100)) : 0;

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setLayoutWidth(width);
    layoutWidthRef.current = width;

    // Measure element's absolute screen coordinates
    if (containerRef.current?.measure) {
      containerRef.current.measure(
        (_x: number, _y: number, _w: number, _h: number, pageX: number) => {
          if (typeof pageX === 'number' && !isNaN(pageX) && pageX >= 0) {
            trackPageXRef.current = pageX;
          }
        }
      );
    }
  };

  const calculateSeekPosition = (pageX: number, fallbackLocationX?: number) => {
    const width = layoutWidthRef.current || layoutWidth;
    if (width <= 0) return 0;

    let touchX: number;
    if (trackPageXRef.current > 0) {
      touchX = Math.max(0, Math.min(pageX - trackPageXRef.current, width));
    } else if (typeof fallbackLocationX === 'number') {
      touchX = Math.max(0, Math.min(fallbackLocationX, width));
    } else {
      touchX = 0;
    }

    const percent = touchX / width;
    const dur = latestRef.current.durationMs;
    return Math.round(percent * (dur > 0 ? dur : 0));
  };

  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !latestRef.current.disabled,
      onMoveShouldSetPanResponder: () => !latestRef.current.disabled,
      onPanResponderGrant: (evt) => {
        setIsScrubbing(true);
        // Refresh measurement in case of layout shifts
        if (containerRef.current?.measure) {
          containerRef.current.measure(
            (_x: number, _y: number, _w: number, _h: number, pageX: number) => {
              if (typeof pageX === 'number' && !isNaN(pageX) && pageX >= 0) {
                trackPageXRef.current = pageX;
              }
            }
          );
        }
        const newPos = calculateSeekPosition(evt.nativeEvent.pageX, evt.nativeEvent.locationX);
        setScrubPositionMs(newPos);
        latestRef.current.onScrubbingStart?.();
        latestRef.current.onScrubbingMove?.(newPos);
      },
      onPanResponderMove: (evt) => {
        const newPos = calculateSeekPosition(evt.nativeEvent.pageX, evt.nativeEvent.locationX);
        setScrubPositionMs(newPos);
        const now = Date.now();
        if (now - lastMoveCallTimeRef.current >= 40) {
          lastMoveCallTimeRef.current = now;
          latestRef.current.onScrubbingMove?.(newPos);
        }
      },
      onPanResponderRelease: (evt) => {
        const finalPos = calculateSeekPosition(evt.nativeEvent.pageX, evt.nativeEvent.locationX);
        setIsScrubbing(false);
        setScrubPositionMs(finalPos);
        if (latestRef.current.onScrubbingEnd) {
          latestRef.current.onScrubbingEnd(finalPos);
        } else {
          latestRef.current.onSeek(finalPos);
        }
      },
      onPanResponderTerminate: () => {
        setIsScrubbing(false);
        const fallbackPos = scrubPositionMs;
        if (latestRef.current.onScrubbingEnd) {
          latestRef.current.onScrubbingEnd(fallbackPos);
        } else {
          latestRef.current.onSeek(fallbackPos);
        }
      },
    })
  );

  return (
    <View
      ref={containerRef}
      style={styles.touchArea}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
      testID="seek-bar"
    >
      <View style={styles.trackBackground}>
        {/* Buffered Track */}
        <View style={[styles.trackBuffered, { width: `${bufferPercent}%` }]} />
        {/* Played Progress Track */}
        <View style={[styles.trackProgress, { width: `${progressPercent}%` }]} />
      </View>

      {/* Scrubber Thumb */}
      <View
        style={[
          styles.thumb,
          {
            left: `${progressPercent}%`,
            transform: [{ scale: isScrubbing ? 1.3 : 1 }],
          },
        ]}
      />
    </View>
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
