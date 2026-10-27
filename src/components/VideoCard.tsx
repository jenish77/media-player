import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Play, Star, MoreVertical, Film } from 'lucide-react-native';
import { MediaItem } from '../types/media';
import { formatDuration, formatBytes } from '../utils/formatters';
import { getThumbnailForMedia, isSupportedThumbnailUri } from '../services/thumbnailService';
import { palette, darkTheme } from '../theme/colors';
import { typography } from '../theme/typography';
import { borderRadius, spacing } from '../theme/spacing';

interface VideoCardProps {
  media: MediaItem;
  onPress: (media: MediaItem) => void;
  onToggleFavorite?: (id: string, current: boolean) => void;
  onMorePress?: (media: MediaItem) => void;
  layout?: 'grid' | 'list';
}

function getContainerColor(container?: string | null): string {
  switch (container?.toUpperCase()) {
    case 'MOV':
      return '#3730A3'; // Royal Indigo
    case 'MP4':
      return '#075985'; // Deep Ocean Blue
    case 'MKV':
      return '#065F46'; // Forest Emerald
    case 'WEBM':
      return '#9A3412'; // Rich Rust Amber
    case 'AVI':
      return '#991B1B'; // Deep Crimson
    default:
      return '#1E293B'; // Slate
  }
}

export const VideoCard: React.FC<VideoCardProps> = ({
  media,
  onPress,
  onToggleFavorite,
  onMorePress,
  layout = 'list',
}) => {
  const resolveInitialThumb = (): any => {
    if (media.thumbnailUri && isSupportedThumbnailUri(media.thumbnailUri)) {
      return media.thumbnailUri;
    }
    if (media.sourceReference) {
      if (media.sourceReference.startsWith('ph://')) {
        return media.sourceReference;
      }
      if (Platform.OS === 'android') {
        const numericId = media.id?.replace('media_', '');
        if (numericId && !isNaN(Number(numericId))) {
          return `content://media/external/video/media/${numericId}/thumbnail`;
        }
        if (media.sourceReference.startsWith('content://') || media.sourceReference.startsWith('file://')) {
          return media.sourceReference;
        }
      }
    }
    return null;
  };

  const [currentMediaId, setCurrentMediaId] = useState(media.id);
  const [imgError, setImgError] = useState(false);
  const [thumbSource, setThumbSource] = useState<any>(resolveInitialThumb);

  if (currentMediaId !== media.id) {
    setCurrentMediaId(media.id);
    setImgError(false);
    setThumbSource(resolveInitialThumb());
  }

  const duration = formatDuration(media.durationMs);
  const size = formatBytes(media.sizeBytes);
  const progressPercent =
    media.durationMs && media.durationMs > 0 && media.lastPositionMs > 0
      ? Math.min(100, Math.round((media.lastPositionMs / media.durationMs) * 100))
      : 0;

  useEffect(() => {
    let isMounted = true;

    if (thumbSource && !imgError) return;

    // Lazy load on-demand thumbnail
    getThumbnailForMedia(media)
      .then((resolved) => {
        if (isMounted && resolved) {
          setImgError(false);
          setThumbSource(resolved);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [media, thumbSource, imgError]);

  const hasValidThumbnail = Boolean(thumbSource) && !imgError;
  const containerColor = getContainerColor(media.container);
  const imagePropSource =
    typeof thumbSource === 'string'
      ? { uri: thumbSource }
      : thumbSource;

  if (layout === 'grid') {
    return (
      <TouchableOpacity
        style={styles.gridCard}
        onPress={() => onPress(media)}
        activeOpacity={0.8}
        testID={`video-card-${media.id}`}
      >
        <View style={styles.gridThumbnailContainer}>
          {hasValidThumbnail ? (
            <Image
              source={imagePropSource}
              style={styles.thumbnailImage}
              contentFit="cover"
              transition={150}
              onError={() => {
                if (typeof thumbSource === 'string' && thumbSource.includes('/thumbnail')) {
                  // Fall back from system thumbnail to full video extraction
                  getThumbnailForMedia(media)
                    .then((extracted) => {
                      if (extracted) {
                        setImgError(false);
                        setThumbSource(extracted);
                      } else {
                        setImgError(true);
                      }
                    })
                    .catch(() => setImgError(true));
                } else {
                  setImgError(true);
                }
              }}
            />
          ) : (
            <View style={[styles.placeholderContainer, { backgroundColor: containerColor }]}>
              <View style={styles.placeholderIconRing}>
                <Play size={20} color={palette.white} fill={palette.white} style={{ marginLeft: 2 }} />
              </View>
            </View>
          )}

          {/* Duration Badge */}
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{duration}</Text>
          </View>

          {/* Container Badge */}
          {media.container && (
            <View style={styles.containerBadge}>
              <Text style={styles.containerText}>{media.container}</Text>
            </View>
          )}

          {/* Progress Bar */}
          {progressPercent > 0 && (
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          )}
        </View>

        <View style={styles.gridInfo}>
          <Text style={styles.gridTitle} numberOfLines={2}>
            {media.displayName}
          </Text>
          <View style={styles.gridMetaRow}>
            <Text style={[styles.metaText, { flex: 1, marginRight: 6 }]} numberOfLines={1}>
              {media.folderName}
            </Text>
            {onToggleFavorite && (
              <TouchableOpacity
                onPress={() => onToggleFavorite(media.id, media.isFavorite)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Star
                  size={16}
                  color={media.isFavorite ? palette.warning : palette.slate500}
                  fill={media.isFavorite ? palette.warning : 'transparent'}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.listCard}
      onPress={() => onPress(media)}
      activeOpacity={0.75}
      testID={`video-card-${media.id}`}
    >
      <View style={styles.listThumbnailContainer}>
        {hasValidThumbnail ? (
          <Image
            source={imagePropSource}
            style={styles.thumbnailImage}
            contentFit="cover"
            transition={150}
            onError={() => {
              if (typeof thumbSource === 'string' && thumbSource.includes('/thumbnail')) {
                getThumbnailForMedia(media)
                  .then((extracted) => {
                    if (extracted) {
                      setImgError(false);
                      setThumbSource(extracted);
                    } else {
                      setImgError(true);
                    }
                  })
                  .catch(() => setImgError(true));
              } else {
                setImgError(true);
              }
            }}
          />
        ) : (
          <View style={[styles.placeholderContainer, { backgroundColor: containerColor }]}>
            <View style={styles.placeholderIconRing}>
              <Play size={16} color={palette.white} fill={palette.white} style={{ marginLeft: 2 }} />
            </View>
          </View>
        )}

        {/* Container Badge */}
        {media.container && (
          <View style={styles.containerBadge}>
            <Text style={styles.containerText}>{media.container}</Text>
          </View>
        )}

        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{duration}</Text>
        </View>

        {progressPercent > 0 && (
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        )}
      </View>

      <View style={styles.listInfo}>
        <Text style={styles.listTitle} numberOfLines={2}>
          {media.displayName}
        </Text>
        <View style={styles.listMetaRow}>
          <Text style={styles.metaText} numberOfLines={1} ellipsizeMode="tail">
            {media.folderName} • {size}
          </Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        {onToggleFavorite && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => onToggleFavorite(media.id, media.isFavorite)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Star
              size={18}
              color={media.isFavorite ? palette.warning : palette.slate500}
              fill={media.isFavorite ? palette.warning : 'transparent'}
            />
          </TouchableOpacity>
        )}

        {onMorePress && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => onMorePress(media)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MoreVertical size={18} color={palette.slate400} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: darkTheme.cardBackground,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  listThumbnailContainer: {
    width: 108,
    height: 64,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: palette.slate800,
    position: 'relative',
    marginRight: spacing.md,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.slate800,
  },
  placeholderIconRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    ...typography.caption,
    color: palette.white,
    fontSize: 10,
  },
  containerBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.85)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  containerText: {
    color: palette.white,
    fontSize: 9,
    fontWeight: '700',
  },
  progressBarBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: palette.primary500,
  },
  listInfo: {
    flex: 1,
    justifyContent: 'center',
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  listTitle: {
    ...typography.bodyMedium,
    color: darkTheme.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    flexShrink: 1,
  },
  metaText: {
    ...typography.caption,
    color: darkTheme.textSecondary,
    flexShrink: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },

  // Grid Styles
  gridCard: {
    flex: 1,
    margin: spacing.xs,
    backgroundColor: darkTheme.cardBackground,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  gridThumbnailContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: palette.slate800,
    position: 'relative',
  },
  gridInfo: {
    padding: spacing.sm,
  },
  gridTitle: {
    ...typography.bodySmall,
    color: darkTheme.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  gridMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
