import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Lock, Sun, Volume2, Volume1, VolumeX, RotateCcw, RotateCw } from 'lucide-react-native';
import { palette } from '../theme/colors';
import { typography } from '../theme/typography';
import { borderRadius, spacing } from '../theme/spacing';

interface GestureOverlayProps {
  isLocked: boolean;
  onToggleLock: () => void;
  onSingleTap: () => void;
  onDoubleTapLeft: () => void;
  onDoubleTapRight: () => void;
  onBrightnessChange?: (brightness: number) => void;
  onVolumeChange?: (volume: number) => void;
  onBrightnessComplete?: (brightness: number) => void;
  onVolumeComplete?: (volume: number) => void;
  currentBrightness?: number;
  currentVolume?: number;
  skipSeconds?: number;
  isLandscape?: boolean;
  gesturesEnabled?: boolean;
  doubleTapSeekEnabled?: boolean;
  swipeBrightnessEnabled?: boolean;
  swipeVolumeEnabled?: boolean;
}

const GestureOverlayComponent: React.FC<GestureOverlayProps> = ({
  isLocked,
  onToggleLock,
  onSingleTap,
  onDoubleTapLeft,
  onDoubleTapRight,
  onBrightnessChange,
  onVolumeChange,
  onBrightnessComplete,
  onVolumeComplete,
  currentBrightness = 0.5,
  currentVolume = 0.5,
  skipSeconds = 10,
  isLandscape = false,
  gesturesEnabled = true,
  doubleTapSeekEnabled = true,
  swipeBrightnessEnabled = true,
  swipeVolumeEnabled = true,
}) => {
  const [activeGestureType, setActiveGestureType] = useState<
    'volume' | 'brightness' | 'skipLeft' | 'skipRight' | null
  >(null);

  // Local HUD display state for instantaneous 60fps rendering without bridge lag
  const [displayVolume, setDisplayVolume] = useState<number>(currentVolume);
  const [displayBrightness, setDisplayBrightness] = useState<number>(currentBrightness);

  // Screen dimensions cache (updated on touch grant and orientation change)
  const screenWidthRef = useRef<number>(Dimensions.get('window').width);
  const screenHeightRef = useRef<number>(Dimensions.get('window').height);

  // Fresh refs to prevent stale closure inside PanResponder
  const currentVolumeRef = useRef<number>(currentVolume);
  currentVolumeRef.current = currentVolume;

  const currentBrightnessRef = useRef<number>(currentBrightness);
  currentBrightnessRef.current = currentBrightness;

  const isLockedRef = useRef<boolean>(isLocked);
  isLockedRef.current = isLocked;

  const onVolumeChangeRef = useRef(onVolumeChange);
  onVolumeChangeRef.current = onVolumeChange;

  const onBrightnessChangeRef = useRef(onBrightnessChange);
  onBrightnessChangeRef.current = onBrightnessChange;

  const onVolumeCompleteRef = useRef(onVolumeComplete);
  onVolumeCompleteRef.current = onVolumeComplete;

  const onBrightnessCompleteRef = useRef(onBrightnessComplete);
  onBrightnessCompleteRef.current = onBrightnessComplete;

  const onSingleTapRef = useRef(onSingleTap);
  onSingleTapRef.current = onSingleTap;

  const onDoubleTapLeftRef = useRef(onDoubleTapLeft);
  onDoubleTapLeftRef.current = onDoubleTapLeft;

  const onDoubleTapRightRef = useRef(onDoubleTapRight);
  onDoubleTapRightRef.current = onDoubleTapRight;

  const gesturesEnabledRef = useRef(gesturesEnabled);
  gesturesEnabledRef.current = gesturesEnabled;

  const doubleTapSeekEnabledRef = useRef(doubleTapSeekEnabled);
  doubleTapSeekEnabledRef.current = doubleTapSeekEnabled;

  const swipeBrightnessEnabledRef = useRef(swipeBrightnessEnabled);
  swipeBrightnessEnabledRef.current = swipeBrightnessEnabled;

  const swipeVolumeEnabledRef = useRef(swipeVolumeEnabled);
  swipeVolumeEnabledRef.current = swipeVolumeEnabled;

  const activeGestureTypeRef = useRef<'volume' | 'brightness' | 'skipLeft' | 'skipRight' | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Touch tracking refs
  const initialVolumeRef = useRef<number>(currentVolume);
  const initialBrightnessRef = useRef<number>(currentBrightness);
  const touchStartYRef = useRef<number>(0);
  const touchStartXRef = useRef<number>(0);
  const isVerticalSwipeRef = useRef<boolean>(false);

  // High-performance RAF throttles for hardware dispatch
  const pendingBrightnessRef = useRef<number | null>(null);
  const brightnessRafRef = useRef<number | null>(null);
  const isBrightnessInFlightRef = useRef<boolean>(false);

  const pendingVolumeRef = useRef<number | null>(null);
  const volumeRafRef = useRef<number | null>(null);

  const updateHardwareBrightness = (val: number) => {
    pendingBrightnessRef.current = val;
    if (brightnessRafRef.current === null) {
      brightnessRafRef.current = requestAnimationFrame(async () => {
        brightnessRafRef.current = null;
        const target = pendingBrightnessRef.current;
        if (target === null || isBrightnessInFlightRef.current) return;

        isBrightnessInFlightRef.current = true;
        try {
          if (onBrightnessChangeRef.current) {
            await onBrightnessChangeRef.current(target);
          }
        } catch (e) {
        } finally {
          isBrightnessInFlightRef.current = false;
          if (pendingBrightnessRef.current !== target && pendingBrightnessRef.current !== null) {
            updateHardwareBrightness(pendingBrightnessRef.current);
          }
        }
      });
    }
  };

  const updateHardwareVolume = (val: number) => {
    pendingVolumeRef.current = val;
    if (volumeRafRef.current === null) {
      volumeRafRef.current = requestAnimationFrame(() => {
        volumeRafRef.current = null;
        const target = pendingVolumeRef.current;
        if (target !== null) {
          onVolumeChangeRef.current?.(target);
        }
      });
    }
  };

  useEffect(() => {
    if (!isVerticalSwipeRef.current) {
      setDisplayVolume(currentVolume);
    }
  }, [currentVolume]);

  useEffect(() => {
    if (!isVerticalSwipeRef.current) {
      setDisplayBrightness(currentBrightness);
    }
  }, [currentBrightness]);

  const setGestureType = (type: 'volume' | 'brightness' | 'skipLeft' | 'skipRight' | null) => {
    activeGestureTypeRef.current = type;
    setActiveGestureType(type);
  };

  const [showUnlockHint, setShowUnlockHint] = useState(false);
  const unlockHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBackdropTap = () => {
    setShowUnlockHint(true);
    if (unlockHintTimerRef.current) {
      clearTimeout(unlockHintTimerRef.current);
    }
    unlockHintTimerRef.current = setTimeout(() => {
      setShowUnlockHint(false);
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      if (unlockHintTimerRef.current) clearTimeout(unlockHintTimerRef.current);
      if (brightnessRafRef.current) cancelAnimationFrame(brightnessRafRef.current);
      if (volumeRafRef.current) cancelAnimationFrame(volumeRafRef.current);
    };
  }, []);

  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isLockedRef.current,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        if (isLockedRef.current || !gesturesEnabledRef.current) return false;
        if (!swipeBrightnessEnabledRef.current && !swipeVolumeEnabledRef.current) return false;
        return (
          Math.abs(gestureState.dy) >= 8 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2
        );
      },
      onPanResponderGrant: (evt) => {
        const { width, height } = Dimensions.get('window');
        screenWidthRef.current = width;
        screenHeightRef.current = height;

        initialVolumeRef.current = currentVolumeRef.current;
        initialBrightnessRef.current = currentBrightnessRef.current;
        touchStartXRef.current = evt.nativeEvent.pageX;
        touchStartYRef.current = evt.nativeEvent.pageY;
        isVerticalSwipeRef.current = false;

        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (isLockedRef.current || !gesturesEnabledRef.current) return;

        const screenWidth = screenWidthRef.current;
        const screenHeight = screenHeightRef.current;
        const startY = touchStartYRef.current;

        // Ignore gestures originating in status bar header or timeline bottom
        if (startY < 50 || startY > screenHeight - 65) {
          return;
        }

        if (!isVerticalSwipeRef.current) {
          const isVertical =
            Math.abs(gestureState.dy) >= 8 &&
            Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2;

          if (isVertical) {
            isVerticalSwipeRef.current = true;
          } else {
            return;
          }
        }

        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }

        const startX = touchStartXRef.current;
        const isLeftSide = startX < screenWidth / 2;

        // Natural, responsive sensitivity
        const sensitivity = Math.max(200, Math.min(360, screenHeight * 0.55));
        const deltaFraction = -gestureState.dy / sensitivity;

        if (isLeftSide && swipeBrightnessEnabledRef.current) {
          setGestureType('brightness');
          const targetBrightness = Math.max(0, Math.min(1, initialBrightnessRef.current + deltaFraction));
          currentBrightnessRef.current = targetBrightness;
          setDisplayBrightness(targetBrightness);
          updateHardwareBrightness(targetBrightness);
        } else if (!isLeftSide && swipeVolumeEnabledRef.current) {
          setGestureType('volume');
          const targetVolume = Math.max(0, Math.min(1, initialVolumeRef.current + deltaFraction));
          currentVolumeRef.current = targetVolume;
          setDisplayVolume(targetVolume);
          updateHardwareVolume(targetVolume);
        }
      },
      onPanResponderRelease: (evt) => {
        if (isVerticalSwipeRef.current) {
          isVerticalSwipeRef.current = false;
          if (activeGestureTypeRef.current === 'brightness') {
            const finalVal = currentBrightnessRef.current;
            updateHardwareBrightness(finalVal);
            onBrightnessCompleteRef.current?.(finalVal);
          } else if (activeGestureTypeRef.current === 'volume') {
            const finalVal = currentVolumeRef.current;
            updateHardwareVolume(finalVal);
            onVolumeCompleteRef.current?.(finalVal);
          }

          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          hideTimerRef.current = setTimeout(() => {
            setGestureType(null);
          }, 700);
          return;
        }

        // Tap handling (distinguish single vs double tap)
        const now = Date.now();
        const touchX = evt.nativeEvent.pageX;
        const timeDiff = now - lastTapRef.current.time;
        const distDiff = Math.abs(touchX - lastTapRef.current.x);
        const screenWidth = screenWidthRef.current;

        if (timeDiff < 320 && distDiff < 60) {
          // Double Tap detected
          if (tapTimeoutRef.current) {
            clearTimeout(tapTimeoutRef.current);
            tapTimeoutRef.current = null;
          }

          if (gesturesEnabledRef.current && doubleTapSeekEnabledRef.current) {
            if (touchX < screenWidth * 0.38) {
              setGestureType('skipLeft');
              onDoubleTapLeftRef.current?.();
            } else if (touchX > screenWidth * 0.62) {
              setGestureType('skipRight');
              onDoubleTapRightRef.current?.();
            } else {
              onSingleTapRef.current?.();
            }
          } else {
            onSingleTapRef.current?.();
          }

          setTimeout(() => setGestureType(null), 700);
          lastTapRef.current = { time: 0, x: 0 };
        } else {
          // Single tap confirmation timer
          lastTapRef.current = { time: now, x: touchX };
          tapTimeoutRef.current = setTimeout(() => {
            onSingleTapRef.current?.();
            tapTimeoutRef.current = null;
          }, 280);
        }
      },
      onPanResponderTerminate: () => {
        isVerticalSwipeRef.current = false;
        setGestureType(null);
      },
    })
  );

  if (isLocked) {
    return (
      <View
        style={[
          styles.lockedContainer,
          { paddingTop: isLandscape ? spacing.lg : 48 },
        ]}
        testID="locked-overlay"
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropTap}
          testID="locked-backdrop"
        />

        <TouchableOpacity
          style={[
            styles.unlockButton,
            showUnlockHint && styles.unlockButtonHighlight,
          ]}
          onPress={onToggleLock}
          activeOpacity={0.8}
          testID="unlock-button"
          accessibilityLabel="Unlock screen controls"
        >
          <Lock size={20} color={showUnlockHint ? palette.accentCyan : palette.white} />
          <Text style={[styles.unlockText, showUnlockHint && styles.unlockTextHighlight]}>
            Screen Locked • Tap to Unlock
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      {/* Dynamic Brightness Dimming Scrim (renders at 60fps without parent re-renders) */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: '#000000',
            opacity: Math.max(0, Math.min(0.75, (1 - displayBrightness) * 0.75)),
            zIndex: 1,
          },
        ]}
        pointerEvents="none"
      />

      {/* 1. Underlying touch interception layer (zIndex 10) */}
      <View
        style={styles.touchLayer}
        {...panResponder.panHandlers}
        testID="gesture-overlay"
      />

      {/* 2. Floating HUD overlay above controls (zIndex 35, pointerEvents="none") */}
      <View style={styles.hudOverlay} pointerEvents="none">
        {/* Right-side Volume HUD */}
        {activeGestureType === 'volume' && (
          <View
            style={[
              styles.sideHud,
              styles.volumeHud,
              isLandscape && styles.volumeHudLandscape,
            ]}
            testID="volume-gesture-hud"
          >
            <View style={styles.hudIconContainer}>
              {displayVolume <= 0 ? (
                <VolumeX size={20} color={palette.slate400} />
              ) : displayVolume < 0.5 ? (
                <Volume1 size={20} color={palette.primary400} />
              ) : (
                <Volume2 size={20} color={palette.primary400} />
              )}
            </View>

            {/* Vertical Level Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    height: `${Math.round(displayVolume * 100)}%`,
                    backgroundColor: displayVolume <= 0 ? palette.slate500 : palette.primary500,
                  },
                ]}
              />
            </View>

            <Text style={styles.hudPercentageText}>
              {Math.round(displayVolume * 100)}%
            </Text>
          </View>
        )}

        {/* Left-side Brightness HUD */}
        {activeGestureType === 'brightness' && (
          <View
            style={[
              styles.sideHud,
              styles.brightnessHud,
              isLandscape && styles.brightnessHudLandscape,
            ]}
            testID="brightness-gesture-hud"
          >
            <View style={styles.hudIconContainer}>
              <Sun size={20} color={palette.accentCyan} />
            </View>

            {/* Vertical Level Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    height: `${Math.round(displayBrightness * 100)}%`,
                    backgroundColor: palette.accentCyan,
                  },
                ]}
              />
            </View>

            <Text style={styles.hudPercentageText}>
              {Math.round(displayBrightness * 100)}%
            </Text>
          </View>
        )}

        {/* Skip Backward Badge (-10s) */}
        {activeGestureType === 'skipLeft' && (
          <View
            style={[
              styles.skipBadge,
              styles.skipLeft,
              isLandscape && styles.skipLeftLandscape,
            ]}
          >
            <RotateCcw size={32} color={palette.white} />
            <Text style={styles.skipText}>-{skipSeconds}s</Text>
          </View>
        )}

        {/* Skip Forward Badge (+10s) */}
        {activeGestureType === 'skipRight' && (
          <View
            style={[
              styles.skipBadge,
              styles.skipRight,
              isLandscape && styles.skipRightLandscape,
            ]}
          >
            <RotateCw size={32} color={palette.white} />
            <Text style={styles.skipText}>+{skipSeconds}s</Text>
          </View>
        )}
      </View>
    </>
  );
};

export const GestureOverlay = React.memo(GestureOverlayComponent);

const styles = StyleSheet.create({
  touchLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  hudOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideHud: {
    position: 'absolute',
    top: '25%',
    bottom: '25%',
    width: 50,
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  brightnessHud: {
    left: spacing.lg,
  },
  brightnessHudLandscape: {
    left: spacing.xl,
  },
  volumeHud: {
    right: spacing.lg,
  },
  volumeHudLandscape: {
    right: spacing.xl,
  },
  hudIconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarTrack: {
    flex: 1,
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: borderRadius.full,
    marginVertical: spacing.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  progressBarFill: {
    width: '100%',
    borderRadius: borderRadius.full,
  },
  hudPercentageText: {
    ...typography.caption,
    color: palette.white,
    fontWeight: '700',
    fontSize: 11,
    textAlign: 'center',
  },
  skipBadge: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: borderRadius.full,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  skipLeft: {
    left: '18%',
  },
  skipLeftLandscape: {
    left: '22%',
  },
  skipRight: {
    right: '18%',
  },
  skipRightLandscape: {
    right: '22%',
  },
  skipText: {
    ...typography.bodySmall,
    color: palette.white,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  lockedContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    alignItems: 'center',
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  unlockButtonHighlight: {
    borderColor: palette.accentCyan,
    backgroundColor: 'rgba(14, 165, 233, 0.25)',
  },
  unlockText: {
    ...typography.bodySmall,
    color: palette.white,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  unlockTextHighlight: {
    color: palette.accentCyan,
  },
});
