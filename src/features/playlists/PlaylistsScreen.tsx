import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  StatusBar,
  Alert,
  BackHandler,
} from 'react-native';
import { ListPlus, ListVideo, Trash2, ArrowLeft, Play, Plus, X } from 'lucide-react-native';
import { usePlaylistStore } from '../../store/usePlaylistStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { EmptyState } from '../../components/EmptyState';
import { VideoCard } from '../../components/VideoCard';
import { formatDuration } from '../../utils/formatters';
import { palette, darkTheme } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';
import { Playlist, PlaylistItem, MediaItem } from '../../types/media';

interface PlaylistsScreenProps {
  navigation: any;
}

export const PlaylistsScreen: React.FC<PlaylistsScreenProps> = ({ navigation }) => {
  const {
    playlists,
    currentPlaylist,
    playlistItems,
    loadPlaylists,
    createPlaylist,
    deletePlaylist,
    selectPlaylist,
    removeItemFromPlaylist,
  } = usePlaylistStore();

  const { loadMedia } = usePlaybackStore();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  useEffect(() => {
    if (!currentPlaylist) return;
    const backAction = () => {
      selectPlaylist(null);
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [currentPlaylist, selectPlaylist]);

  const handleCreate = async () => {
    if (!newPlaylistName.trim()) return;
    await createPlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setIsModalVisible(false);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Playlist', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePlaylist(id) },
    ]);
  };

  const handlePlayItem = async (mediaItem: MediaItem) => {
    const validItems = playlistItems
      .map((p) => p.mediaItem)
      .filter((m): m is MediaItem => m !== undefined && m !== null);
    const index = validItems.findIndex((m) => m.id === mediaItem.id);
    usePlaybackStore.getState().setQueue(validItems, index >= 0 ? index : 0);
    await loadMedia(mediaItem, true);
    navigation.navigate('Player');
  };

  return (
    <View style={styles.container} testID="playlists-screen">
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        {currentPlaylist ? (
          <View style={styles.playlistDetailHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => selectPlaylist(null)}
              testID="playlist-back-button"
            >
              <ArrowLeft size={22} color={darkTheme.text} />
            </TouchableOpacity>
            <View>
              <Text style={styles.title} numberOfLines={1}>
                {currentPlaylist.name}
              </Text>
              <Text style={styles.subtitle}>{playlistItems.length} videos</Text>
            </View>
          </View>
        ) : (
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Playlists</Text>
              <Text style={styles.subtitle}>{playlists.length} playlists</Text>
            </View>

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setIsModalVisible(true)}
              testID="new-playlist-button"
            >
              <Plus size={18} color={palette.white} style={{ marginRight: 4 }} />
              <Text style={styles.addButtonText}>New</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {currentPlaylist ? (
        <FlatList
          data={playlistItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              {item.mediaItem ? (
                <View style={{ flex: 1 }}>
                  <VideoCard
                    media={item.mediaItem}
                    onPress={handlePlayItem}
                    layout="list"
                  />
                </View>
              ) : (
                <View style={styles.missingItem}>
                  <Text style={styles.missingText}>Media item no longer available</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.removeItemButton}
                onPress={() => removeItemFromPlaylist(currentPlaylist.id, item.mediaItemId)}
              >
                <Trash2 size={16} color={palette.slate500} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="empty"
              title="Playlist is empty"
              description="Add videos to this playlist from your library."
            />
          }
        />
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.playlistCard}
              onPress={() => selectPlaylist(item)}
              activeOpacity={0.75}
              testID={`playlist-item-${item.id}`}
            >
              <View style={styles.iconBox}>
                <ListVideo size={24} color={palette.accentCyan} />
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.playlistName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.playlistCount}>Tap to view videos</Text>
              </View>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item.id, item.name)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID={`delete-playlist-${item.id}`}
              >
                <Trash2 size={18} color={palette.slate500} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="empty"
              title="No playlists yet"
              description="Create custom playlists to organize your favorite movies, clips, and series."
              actionLabel="Create Playlist"
              onAction={() => setIsModalVisible(true)}
            />
          }
        />
      )}

      {/* New Playlist Modal */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Playlist</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <X size={20} color={palette.slate400} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Playlist name..."
              placeholderTextColor={palette.slate500}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
              testID="playlist-name-input"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCreate}
                testID="save-playlist-button"
              >
                <Text style={styles.saveBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: darkTheme.borderSubtle,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playlistDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.primary500,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  addButtonText: {
    ...typography.bodyMedium,
    color: palette.white,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 90,
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkTheme.cardBackground,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  infoBox: {
    flex: 1,
  },
  playlistName: {
    ...typography.bodyMedium,
    color: darkTheme.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  playlistCount: {
    ...typography.caption,
    color: darkTheme.textSecondary,
  },
  deleteButton: {
    padding: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeItemButton: {
    padding: spacing.sm,
    marginLeft: spacing.xs,
  },
  missingItem: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: palette.slate800,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  missingText: {
    ...typography.bodySmall,
    color: palette.error,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: darkTheme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: darkTheme.borderSubtle,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h3,
    color: darkTheme.text,
  },
  modalInput: {
    backgroundColor: palette.slate800,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    color: palette.white,
    ...typography.bodyMedium,
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  cancelBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  cancelBtnText: {
    ...typography.bodyMedium,
    color: palette.slate400,
  },
  saveBtn: {
    backgroundColor: palette.primary500,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  saveBtnText: {
    ...typography.bodyMedium,
    color: palette.white,
    fontWeight: '600',
  },
});
