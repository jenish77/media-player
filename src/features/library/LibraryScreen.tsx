import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Search,
  LayoutGrid,
  List,
  ArrowUpDown,
  RefreshCw,
  FolderOpen,
  X,
  Play,
} from 'lucide-react-native';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { VideoCard } from '../../components/VideoCard';
import { EmptyState } from '../../components/EmptyState';
import { pickVideoFromDocumentPicker } from '../../services/mediaDiscovery/mediaDiscoveryService';
import { isImageUri, isSupportedThumbnailUri, preloadThumbnails } from '../../services/thumbnailService';
import { MediaItem } from '../../types/media';
import { palette, darkTheme } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';
import { formatDuration } from '../../utils/formatters';

let ScreenOrientation: any = null;
try {
  ScreenOrientation = require('expo-screen-orientation');
} catch (e) {}

interface LibraryScreenProps {
  navigation: any;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({ navigation }) => {
  const {
    mediaItems,
    continueWatching,
    searchQuery,
    isScanning,
    scanError,
    viewLayout,
    sortBy,
    sortDirection,
    loadLibrary,
    scanMedia,
    setSearchQuery,
    setViewLayout,
    setSort,
    toggleFavorite,
  } = useLibraryStore();

  const { loadMedia } = usePlaybackStore();
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => {
    loadLibrary();
    const unsubscribe = navigation.addListener('focus', () => {
      if (ScreenOrientation?.lockAsync) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (mediaItems.length > 0) {
      preloadThumbnails(mediaItems, 24);
    }
  }, [mediaItems]);

  const filteredItems = mediaItems.filter((item) =>
    searchQuery.trim() === ''
      ? true
      : item.displayName.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const handlePlayVideo = async (media: MediaItem) => {
    const list = filteredItems.length > 0 ? filteredItems : mediaItems;
    const index = list.findIndex((item) => item.id === media.id);
    usePlaybackStore.getState().setQueue(list, index >= 0 ? index : 0);
    await loadMedia(media, true);
    navigation.navigate('Player');
  };

  const handleScan = async () => {
    try {
      const res = await scanMedia();
      if (res && res.errors && res.errors.length > 0 && res.addedCount === 0) {
        Alert.alert(
          'Media Access Required',
          `${res.errors[0]}.\n\nPlease ensure Nova Player has permission to access video files in your device Settings, or tap the folder icon to open any video directly.`
        );
      } else if (res && res.addedCount > 0) {
        Alert.alert('Scan Complete', `Discovered and added ${res.addedCount} video(s) to your library.`);
      } else {
        Alert.alert(
          'Scan Complete',
          'No new video files were found on device storage.\n\nTip: You can use the Folder icon (top-right) to browse and open videos from any directory or SD card.'
        );
      }
    } catch (e: any) {
      Alert.alert('Scan Error', e?.message || 'Failed to scan videos.');
    }
  };

  const handleOpenDocument = async () => {
    try {
      const picked = await pickVideoFromDocumentPicker();
      if (picked) {
        await loadLibrary();
        await handlePlayVideo(picked);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to open document: ' + err.message);
    }
  };

  return (
    <View style={styles.container} testID="library-screen">
      <StatusBar barStyle="light-content" />

      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.brandTitle}>Nova Player</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleScan}
              disabled={isScanning}
              testID="scan-button"
            >
              {isScanning ? (
                <ActivityIndicator size="small" color={palette.accentCyan} />
              ) : (
                <RefreshCw size={20} color={palette.slate300} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleOpenDocument}
              testID="open-file-button"
            >
              <FolderOpen size={20} color={palette.accentCyan} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={18} color={palette.slate400} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search videos..."
            placeholderTextColor={palette.slate500}
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="search-input"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={palette.slate400} />
            </TouchableOpacity>
          )}
        </View>

        {/* Toolbar: Layout & Sort */}
        <View style={styles.toolBar}>
          <Text style={styles.countText}>{filteredItems.length} videos</Text>

          <View style={styles.toolActions}>
            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => setShowSortMenu(!showSortMenu)}
              testID="sort-button"
            >
              <ArrowUpDown size={16} color={palette.slate300} style={{ marginRight: 4 }} />
              <Text style={styles.toolText}>Sort: {sortBy}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => setViewLayout(viewLayout === 'grid' ? 'list' : 'grid')}
              testID="layout-toggle-button"
            >
              {viewLayout === 'grid' ? (
                <List size={18} color={palette.slate300} />
              ) : (
                <LayoutGrid size={18} color={palette.slate300} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Sort Popup Dropdown */}
        {showSortMenu && (
          <View style={styles.sortDropdown}>
            {(['name', 'date', 'duration', 'size'] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.sortItem, sortBy === opt && styles.activeSortItem]}
                onPress={() => {
                  setSort(opt);
                  setShowSortMenu(false);
                }}
              >
                <Text style={[styles.sortItemText, sortBy === opt && styles.activeSortText]}>
                  {opt.toUpperCase()} {sortBy === opt ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <FlatList
        data={filteredItems}
        key={viewLayout}
        numColumns={viewLayout === 'grid' ? 2 : 1}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Continue Watching Section */}
            {continueWatching.length > 0 && searchQuery === '' && (
              <View style={styles.continueSection}>
                <Text style={styles.sectionTitle}>Continue Watching</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel}>
                  {continueWatching.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.continueCard}
                      onPress={() => handlePlayVideo(item)}
                      activeOpacity={0.8}
                      testID={`continue-card-${item.id}`}
                    >
                      <View style={styles.continueThumbnail}>
                        {Boolean(
                          (item.thumbnailUri && isSupportedThumbnailUri(item.thumbnailUri)) ||
                          (item.sourceReference && item.sourceReference.startsWith('ph://'))
                        ) && (
                          <Image
                            source={{ uri: (item.thumbnailUri && isSupportedThumbnailUri(item.thumbnailUri)) ? item.thumbnailUri : item.sourceReference }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            transition={150}
                          />
                        )}
                        <View style={styles.continuePlayIcon}>
                          <Play size={20} color={palette.white} fill={palette.white} />
                        </View>
                        <View style={styles.continueDuration}>
                          <Text style={styles.continueDurationText}>
                            {formatDuration(item.lastPositionMs)} / {formatDuration(item.durationMs)}
                          </Text>
                        </View>
                        {item.durationMs && item.durationMs > 0 && (
                          <View style={styles.continueProgressBg}>
                            <View
                              style={[
                                styles.continueProgressFill,
                                { width: `${(item.lastPositionMs / item.durationMs) * 100}%` },
                              ]}
                            />
                          </View>
                        )}
                      </View>
                      <Text style={styles.continueTitle} numberOfLines={1}>
                        {item.displayName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {filteredItems.length > 0 && <Text style={styles.sectionTitle}>All Videos</Text>}
          </>
        }
        renderItem={({ item }) => (
          <VideoCard
            media={item}
            onPress={handlePlayVideo}
            onToggleFavorite={toggleFavorite}
            layout={viewLayout}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={searchQuery ? 'search' : 'video'}
            title={searchQuery ? 'No videos found' : 'No videos in library'}
            description={
              searchQuery
                ? `No videos match "${searchQuery}". Try a different keyword.`
                : 'Scan your device to discover videos or open a file from storage.'
            }
            actionLabel={searchQuery ? undefined : 'Scan Videos'}
            onAction={searchQuery ? undefined : handleScan}
            isLoading={isScanning}
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
    backgroundColor: darkTheme.surface,
    paddingTop: 48,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: darkTheme.borderSubtle,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  brandTitle: {
    ...typography.h1,
    color: darkTheme.text,
    fontSize: 24,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: darkTheme.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.slate800,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 42,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: darkTheme.text,
    ...typography.bodyMedium,
  },
  toolBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  countText: {
    ...typography.caption,
    color: darkTheme.textMuted,
  },
  toolActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: darkTheme.surfaceVariant,
    borderRadius: borderRadius.sm,
  },
  toolText: {
    ...typography.caption,
    color: palette.slate300,
    textTransform: 'capitalize',
  },
  sortDropdown: {
    backgroundColor: palette.slate800,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginTop: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sortItem: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: borderRadius.sm,
  },
  activeSortItem: {
    backgroundColor: palette.primary500,
  },
  sortItemText: {
    ...typography.caption,
    color: palette.slate300,
    fontWeight: '600',
  },
  activeSortText: {
    color: palette.white,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 90,
  },
  sectionTitle: {
    ...typography.h3,
    color: darkTheme.text,
    marginVertical: spacing.sm,
    fontSize: 16,
  },
  continueSection: {
    marginBottom: spacing.lg,
  },
  carousel: {
    flexDirection: 'row',
  },
  continueCard: {
    width: 170,
    marginRight: spacing.md,
    backgroundColor: darkTheme.cardBackground,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  continueThumbnail: {
    width: '100%',
    height: 95,
    backgroundColor: palette.slate800,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  continuePlayIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueDuration: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  continueDurationText: {
    ...typography.caption,
    color: palette.white,
    fontSize: 9,
  },
  continueProgressBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  continueProgressFill: {
    height: '100%',
    backgroundColor: palette.accentCyan,
  },
  continueTitle: {
    ...typography.bodySmall,
    color: darkTheme.text,
    padding: spacing.sm,
    fontWeight: '600',
  },
});
