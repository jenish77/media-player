import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { Trash2, RotateCcw, Play } from 'lucide-react-native';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { clearWatchHistory, updatePlaybackPosition } from '../../services/database/mediaRepository';
import { EmptyState } from '../../components/EmptyState';
import { formatDuration, formatDate } from '../../utils/formatters';
import { palette, darkTheme } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';
import { MediaItem } from '../../types/media';

interface HistoryScreenProps {
  navigation: any;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ navigation }) => {
  const { recent, loadLibrary } = useLibraryStore();
  const { loadMedia } = usePlaybackStore();

  useEffect(() => {
    loadLibrary();
  }, []);

  const handleResume = async (media: MediaItem) => {
    const index = recent.findIndex((item) => item.id === media.id);
    if (recent.length > 0) {
      usePlaybackStore.getState().setQueue(recent, index >= 0 ? index : 0);
    }
    await loadMedia(media, true);
    navigation.navigate('Player');
  };

  const handleStartOver = async (media: MediaItem) => {
    const index = recent.findIndex((item) => item.id === media.id);
    if (recent.length > 0) {
      usePlaybackStore.getState().setQueue(recent, index >= 0 ? index : 0);
    }
    await loadMedia(media, false);
    navigation.navigate('Player');
  };

  const handleRemoveItem = async (media: MediaItem) => {
    await updatePlaybackPosition(media.id, 0);
    await loadLibrary();
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear Watch History',
      'Are you sure you want to clear your entire watch history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearWatchHistory();
            await loadLibrary();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container} testID="history-screen">
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>Resume recent videos</Text>
        </View>

        {recent.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearAll} testID="clear-history-button">
            <Trash2 size={18} color={palette.error} style={{ marginRight: 6 }} />
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={recent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const duration = formatDuration(item.durationMs);
          const current = formatDuration(item.lastPositionMs);
          const percent =
            item.durationMs && item.durationMs > 0
              ? Math.min(100, Math.round((item.lastPositionMs / item.durationMs) * 100))
              : 0;

          return (
            <View style={styles.historyCard} testID={`history-item-${item.id}`}>
              <View style={styles.thumbnailBox}>
                <View style={styles.playIconBox}>
                  <Play size={20} color={palette.white} fill={palette.white} />
                </View>
                {percent > 0 && (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${percent}%` }]} />
                  </View>
                )}
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <Text style={styles.itemMeta}>
                  {current} of {duration} ({percent}%)
                </Text>
                <Text style={styles.dateMeta}>{formatDate(item.lastPlayedAt)}</Text>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.actionResume}
                    onPress={() => handleResume(item)}
                    testID={`resume-btn-${item.id}`}
                  >
                    <Text style={styles.actionResumeText}>Resume</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionRestart}
                    onPress={() => handleStartOver(item)}
                    testID={`restart-btn-${item.id}`}
                  >
                    <RotateCcw size={14} color={palette.slate300} style={{ marginRight: 4 }} />
                    <Text style={styles.actionRestartText}>Start Over</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveItem(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID={`remove-history-${item.id}`}
              >
                <Trash2 size={16} color={palette.slate500} />
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="empty"
            title="No watch history"
            description="Videos you watch will appear here so you can easily pick up where you left off."
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkTheme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: darkTheme.surface,
    paddingTop: 48,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: darkTheme.borderSubtle,
  },
  title: {
    ...typography.h1,
    color: darkTheme.text,
    fontSize: 24,
  },
  subtitle: {
    ...typography.caption,
    color: darkTheme.textSecondary,
    marginTop: 2,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  clearButtonText: {
    ...typography.caption,
    color: palette.error,
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 90,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkTheme.cardBackground,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  thumbnailBox: {
    width: 90,
    height: 56,
    borderRadius: borderRadius.sm,
    backgroundColor: palette.slate800,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  playIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.primary500,
  },
  infoBox: {
    flex: 1,
  },
  itemTitle: {
    ...typography.bodyMedium,
    color: darkTheme.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemMeta: {
    ...typography.caption,
    color: palette.accentCyan,
    fontWeight: '600',
  },
  dateMeta: {
    ...typography.caption,
    color: darkTheme.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionResume: {
    backgroundColor: palette.primary500,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  actionResumeText: {
    ...typography.caption,
    color: palette.white,
    fontWeight: '700',
    fontSize: 11,
  },
  actionRestart: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkTheme.surfaceVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  actionRestartText: {
    ...typography.caption,
    color: palette.slate300,
    fontSize: 11,
  },
  removeButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
});
