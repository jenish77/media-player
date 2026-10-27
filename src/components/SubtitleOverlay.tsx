import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SubtitleCue } from '../types/player';
import { getActiveCue } from '../utils/subtitleParser';
import { palette } from '../theme/colors';

interface SubtitleOverlayProps {
  cues: SubtitleCue[];
  currentTimeMs: number;
  subtitleDelayMs?: number;
  fontSize?: number;
  textColor?: string;
  backgroundColor?: string;
}

const SubtitleOverlayComponent: React.FC<SubtitleOverlayProps> = ({
  cues,
  currentTimeMs,
  subtitleDelayMs = 0,
  fontSize = 16,
  textColor = palette.white,
  backgroundColor = 'rgba(0, 0, 0, 0.75)',
}) => {
  const activeCue = useMemo(() => {
    return getActiveCue(cues, currentTimeMs, subtitleDelayMs);
  }, [cues, currentTimeMs, subtitleDelayMs]);

  if (!activeCue || !activeCue.text) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none" testID="subtitle-overlay">
      <View style={[styles.pill, { backgroundColor }]}>
        <Text style={[styles.subtitleText, { fontSize, color: textColor }]}>
          {activeCue.text}
        </Text>
      </View>
    </View>
  );
};

export const SubtitleOverlay = React.memo(SubtitleOverlayComponent);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 24,
    right: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    maxWidth: '90%',
  },
  subtitleText: {
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 22,
  },
});
