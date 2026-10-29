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
  const lastDispatchTimeRef = useRef<number>(0);

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
    };
  }, []);

  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isLockedRef.current,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        if (isLockedRef.current || !gesturesEnabledRef.current) return false;
        if (!swipeBrightnessEnabledRef.current && !swipeVolumeEnabledRef.current) return false;
        return (
          Math.abs(gestureState.dy) >= 12 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.3
        );
      },
      onPanResponderGrant: (evt) => {
        // Read true current values from fresh refs to eliminate stale closure jumps
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

        const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
        const startY = touchStartYRef.current;

        // Ignore gestures that originated in top header (65px) or bottom timeline (85px)
        if (startY < 65 || startY > screenHeight - 85) {
          return;
        }

        // Commit to vertical swipe if threshold is exceeded
        if (!isVerticalSwipeRef.current) {
          const isVertical =
            Math.abs(gestureState.dy) >= 12 &&
            Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.3;

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

        // Dragging UP (-dy) increases, dragging DOWN (+dy) decreases
        // Adaptive sensitivity based on screen height
        const sensitivity = Math.max(180, Math.min(300, screenHeight * 0.45));
        const deltaFraction = -gestureState.dy / sensitivity;

        const now = Date.now();
        if (isLeftSide && swipeBrightnessEnabledRef.current && onBrightnessChangeRef.current) {
          setGestureType('brightness');
          const targetBrightness = Math.max(0, Math.min(1, initialBrightnessRef.current + deltaFraction));
          currentBrightnessRef.current = targetBrightness;
          setDisplayBrightness(targetBrightness);
          if (now - lastDispatchTimeRef.current >= 80) {
            lastDispatchTimeRef.current = now;
            onBrightnessChangeRef.current(targetBrightness);
          }
        } else if (!isLeftSide && swipeVolumeEnabledRef.current && onVolumeChangeRef.current) {
          setGestureType('volume');
          const targetVolume = Math.max(0, Math.min(1, initialVolumeRef.current + deltaFraction));
          currentVolumeRef.current = targetVolume;
          setDisplayVolume(targetVolume);
          if (now - lastDispatchTimeRef.current >= 80) {
            lastDispatchTimeRef.current = now;
            onVolumeChangeRef.current(targetVolume);
          }
        }
      },
      onPanResponderRelease: (evt) => {
        if (isVerticalSwipeRef.current) {
          isVerticalSwipeRef.current = false;
          // Ensure final value is dispatched upon gesture release
          if (activeGestureTypeRef.current === 'brightness') {
            onBrightnessChangeRef.current?.(currentBrightnessRef.current);
          } else if (activeGestureTypeRef.current === 'volume') {
            onVolumeChangeRef.current?.(currentVolumeRef.current);
          }
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          hideTimerRef.current = setTimeout(() => {
            setGestureType(null);
          }, 800);
          return;
        }

        // Distinguish single vs double tap
        const now = Date.now();
        const touchX = evt.nativeEvent.pageX;
        const timeDiff = now - lastTapRef.current.time;
        const distDiff = Math.abs(touchX - lastTapRef.current.x);
        const { width: screenWidth } = Dimensions.get('window');

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
          }, 300);
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
        {/* Full-screen backdrop to intercept, absorb, and block all touches/gestures */}
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
      {/* 1. Underlying touch interception layer (zIndex 10) */}
      <View
        style={styles.touchLayer}
        {...panResponder.panHandlers}
        testID="gesture-overlay"
      />

      {/* 2. Floating HUD overlay above controls (zIndex 35, pointerEvents="none") */}
      <View style={styles.hudOverlay} pointerEvents="none">
        {/* Right-side Volume HUD (Never collides with center play/pause) */}
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

            {/* Vertical Level Progress Bar (Fills upwards from bottom) */}
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  hudOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 35,
    justifyContent: 'center',
  },
  lockedContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 48,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  unlockButtonHighlight: {
    borderColor: palette.accentCyan,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    transform: [{ scale: 1.04 }],
  },
  unlockText: {
    ...typography.bodyMedium,
    color: palette.white,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  unlockTextHighlight: {
    color: palette.accentCyan,
  },
  sideHud: {
    position: 'absolute',
    top: '28%',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  volumeHud: {
    right: 20,
  },
  volumeHudLandscape: {
    right: 72,
  },
  brightnessHud: {
    left: 20,
  },
  brightnessHudLandscape: {
    left: 72,
  },
  hudIconContainer: {
    marginBottom: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarTrack: {
    width: 6,
    height: 84,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 3,
    overflow: 'hidden',
    justifyContent: 'flex-end', // Fills vertically upwards
    marginVertical: spacing.xs,
  },
  progressBarFill: {
    width: '100%',
    borderRadius: 3,
  },
  hudPercentageText: {
    ...typography.caption,
    color: palette.white,
    fontWeight: '700',
    fontSize: 10,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  skipBadge: {
    position: 'absolute',
    top: '38%',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  skipLeft: {
    left: '12%',
  },
  skipLeftLandscape: {
    left: '20%',
  },
  skipRight: {
    right: '12%',
  },
  skipRightLandscape: {
    right: '20%',
  },
  skipText: {
    ...typography.caption,
    color: palette.white,
    marginTop: 4,
    fontWeight: '700',
    fontSize: 12,
  },
});
