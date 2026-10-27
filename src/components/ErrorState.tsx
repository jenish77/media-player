import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react-native';
import { palette, darkTheme } from '../theme/colors';
import { typography } from '../theme/typography';
import { borderRadius, spacing } from '../theme/spacing';
import { PlayerError } from '../types/player';

interface ErrorStateProps {
  error: PlayerError | null;
  onRetry?: () => void;
  onGoBack?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry, onGoBack }) => {
  const message = error?.message || 'An unexpected error occurred while loading this video.';
  const code = error?.code || 'UNKNOWN_ERROR';
  const isRecoverable = error?.recoverable ?? false;

  return (
    <View style={styles.container} testID="error-state">
      <View style={styles.iconCircle}>
        <AlertTriangle size={42} color={palette.error} />
      </View>

      <Text style={styles.codeText}>ERROR CODE: {code}</Text>
      <Text style={styles.title}>Playback Failed</Text>
      <Text style={styles.message}>{message}</Text>

      {error?.technicalDetails && (
        <View style={styles.detailsBox}>
          <Text style={styles.detailsText} numberOfLines={3}>
            {error.technicalDetails}
          </Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        {onGoBack && (
          <TouchableOpacity style={styles.secondaryButton} onPress={onGoBack} activeOpacity={0.8}>
            <ArrowLeft size={18} color={palette.slate300} style={styles.buttonIcon} />
            <Text style={styles.secondaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        )}

        {isRecoverable && onRetry && (
          <TouchableOpacity style={styles.primaryButton} onPress={onRetry} activeOpacity={0.8}>
            <RefreshCw size={18} color={palette.white} style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  codeText: {
    ...typography.caption,
    color: palette.error,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: darkTheme.text,
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.bodyMedium,
    color: darkTheme.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 320,
  },
  detailsBox: {
    backgroundColor: palette.slate800,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    maxWidth: '90%',
  },
  detailsText: {
    ...typography.mono,
    color: palette.slate400,
    fontSize: 11,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.primary500,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  primaryButtonText: {
    ...typography.bodyMedium,
    color: palette.white,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.slate800,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  secondaryButtonText: {
    ...typography.bodyMedium,
    color: palette.slate200,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: spacing.xs,
  },
});
