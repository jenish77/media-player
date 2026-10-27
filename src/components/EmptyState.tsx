import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Film, FolderSearch, AlertCircle, RefreshCw } from 'lucide-react-native';
import { palette, darkTheme } from '../theme/colors';
import { typography } from '../theme/typography';
import { borderRadius, spacing } from '../theme/spacing';

interface EmptyStateProps {
  icon?: 'video' | 'search' | 'permission' | 'empty';
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  isLoading?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'video',
  title,
  description,
  actionLabel,
  onAction,
  isLoading = false,
}) => {
  const renderIcon = () => {
    switch (icon) {
      case 'search':
        return <FolderSearch size={48} color={palette.slate500} />;
      case 'permission':
        return <AlertCircle size={48} color={palette.warning} />;
      default:
        return <Film size={48} color={palette.slate500} />;
    }
  };

  return (
    <View style={styles.container} testID="empty-state">
      <View style={styles.iconCircle}>{renderIcon()}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {actionLabel && onAction && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onAction}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading && <RefreshCw size={16} color={palette.white} style={styles.spinIcon} />}
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: darkTheme.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: darkTheme.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.bodyMedium,
    color: darkTheme.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 280,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.primary500,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  actionText: {
    ...typography.bodyMedium,
    color: palette.white,
    fontWeight: '600',
  },
  spinIcon: {
    marginRight: spacing.sm,
  },
});
