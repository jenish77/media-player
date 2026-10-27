import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  BackHandler,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Folder,
  ArrowLeft,
  Pencil,
  FolderInput,
  FolderPlus,
  Check,
  X,
} from 'lucide-react-native';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { VideoCard } from '../../components/VideoCard';
import { EmptyState } from '../../components/EmptyState';
import { formatBytes } from '../../utils/formatters';
import { palette, darkTheme } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';
import { MediaItem } from '../../types/media';

interface FoldersScreenProps {
  navigation: any;
}

export const FoldersScreen: React.FC<FoldersScreenProps> = ({ navigation }) => {
  const {
    folders,
    mediaItems,
    loadLibrary,
    toggleFavorite,
    renameFolder,
    moveMediaToFolder,
  } = useLibraryStore();

  const { loadMedia } = usePlaybackStore();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Rename folder modal state
  const [folderToRename, setFolderToRename] = useState<string | null>(null);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);

  // Move video modal state
  const [videoToMove, setVideoToMove] = useState<MediaItem | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [targetFolderName, setTargetFolderName] = useState<string>('');
  const [isCustomFolderMode, setIsCustomFolderMode] = useState(false);
  const [customFolderNameInput, setCustomFolderNameInput] = useState('');

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    if (!selectedFolder) return;
    const backAction = () => {
      setSelectedFolder(null);
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [selectedFolder]);

  const folderVideos = selectedFolder
    ? mediaItems.filter((item) => item.folderName === selectedFolder)
    : [];

  const handlePlayVideo = async (media: MediaItem) => {
    const index = folderVideos.findIndex((item) => item.id === media.id);
    usePlaybackStore.getState().setQueue(folderVideos, index >= 0 ? index : 0);
    await loadMedia(media, true);
    navigation.navigate('Player');
  };

  // Open Rename Modal
  const handleOpenRename = (folderName: string) => {
    setFolderToRename(folderName);
    setNewFolderNameInput(folderName);
    setIsRenameModalOpen(true);
  };

  // Confirm Rename
  const handleConfirmRename = async () => {
    if (!folderToRename) return;
    const trimmed = newFolderNameInput.trim();
    if (!trimmed) {
      Alert.alert('Invalid Name', 'Folder name cannot be empty.');
      return;
    }
    if (trimmed === folderToRename) {
      setIsRenameModalOpen(false);
      return;
    }

    try {
      await renameFolder(folderToRename, trimmed);
      if (selectedFolder === folderToRename) {
        setSelectedFolder(trimmed);
      }
      setIsRenameModalOpen(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to rename folder.');
    }
  };

  // Open Move Video Modal
  const handleOpenMoveVideo = (media: MediaItem) => {
    setVideoToMove(media);
    setIsCustomFolderMode(false);
    setCustomFolderNameInput('');

    // Default target selection: first other folder, or empty
    const otherFolders = folders.filter((f) => f.name !== media.folderName);
    setTargetFolderName(otherFolders.length > 0 ? otherFolders[0].name : '');
    setIsMoveModalOpen(true);
  };

  // Confirm Move Video
  const handleConfirmMoveVideo = async () => {
    if (!videoToMove) return;

    const destination = isCustomFolderMode
      ? customFolderNameInput.trim()
      : targetFolderName.trim();

    if (!destination) {
      Alert.alert('Select Folder', 'Please select or enter a destination folder name.');
      return;
    }

    if (destination === videoToMove.folderName) {
      Alert.alert('Notice', 'Video is already in this folder.');
      return;
    }

    try {
      await moveMediaToFolder(videoToMove.id, destination);
      setIsMoveModalOpen(false);
      Alert.alert('Video Transferred', `Moved "${videoToMove.displayName}" to "${destination}".`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to move video.');
    }
  };

  return (
    <View style={styles.container} testID="folders-screen">
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        {selectedFolder ? (
          <View style={styles.folderDetailHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setSelectedFolder(null)}
              testID="folder-back-button"
            >
              <ArrowLeft size={22} color={darkTheme.text} />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.folderTitle} numberOfLines={1}>
                  {selectedFolder}
                </Text>

                <TouchableOpacity
                  style={styles.renameIconButton}
                  onPress={() => handleOpenRename(selectedFolder)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  testID="rename-current-folder-btn"
                  accessibilityLabel="Rename folder"
                >
                  <Pencil size={17} color={palette.accentCyan} />
                </TouchableOpacity>
              </View>

              <Text style={styles.subtitle}>{folderVideos.length} videos</Text>
            </View>
          </View>
        ) : (
          <View style={styles.mainHeaderRow}>
            <View>
              <Text style={styles.title}>Folders</Text>
              <Text style={styles.subtitle}>{folders.length} video directories</Text>
            </View>
          </View>
        )}
      </View>

      {selectedFolder ? (
        <FlatList
          data={folderVideos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <VideoCard
              media={item}
              onPress={handlePlayVideo}
              onToggleFavorite={toggleFavorite}
              onMorePress={handleOpenMoveVideo}
              layout="list"
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="empty"
              title="No videos in folder"
              description="This folder does not contain any accessible videos."
            />
          }
        />
      ) : (
        <FlatList
          data={folders}
          keyExtractor={(item) => item.name}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.folderCard}
              onPress={() => setSelectedFolder(item.name)}
              activeOpacity={0.75}
              testID={`folder-item-${item.name}`}
            >
              <View style={styles.folderIconContainer}>
                <Folder size={28} color={palette.primary400} />
              </View>

              <View style={styles.folderInfo}>
                <Text style={styles.folderName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.folderMeta}>
                  {item.count} {item.count === 1 ? 'video' : 'videos'} • {formatBytes(item.totalSizeBytes)}
                </Text>
              </View>

              {/* Action Button: Rename Folder (circled in red on user screenshot) */}
              <TouchableOpacity
                style={styles.folderActionButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleOpenRename(item.name);
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                testID={`rename-btn-${item.name}`}
                accessibilityLabel={`Rename folder ${item.name}`}
              >
                <Pencil size={18} color={palette.slate300} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="empty"
              title="No folders detected"
              description="Scan your device to organize your videos by folders."
            />
          }
        />
      )}

      {/* Rename Folder Modal */}
      <Modal
        visible={isRenameModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRenameModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rename Folder</Text>
              <TouchableOpacity
                onPress={() => setIsRenameModalOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={palette.slate400} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              {`Enter a new name for "${folderToRename}". All videos in this folder will be updated.`}
            </Text>

            <TextInput
              style={styles.modalInput}
              value={newFolderNameInput}
              onChangeText={setNewFolderNameInput}
              placeholder="Folder name"
              placeholderTextColor={palette.slate500}
              autoFocus
              selectTextOnFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsRenameModalOpen(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleConfirmRename}
                testID="confirm-rename-btn"
              >
                <Text style={styles.confirmButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Transfer / Move Video to Another Folder Modal */}
      <Modal
        visible={isMoveModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsMoveModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, styles.moveModalContent]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <FolderInput size={22} color={palette.accentCyan} />
                <Text style={styles.modalTitle}>Transfer Video</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsMoveModalOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={palette.slate400} />
              </TouchableOpacity>
            </View>

            {videoToMove && (
              <View style={styles.videoMetaBox}>
                <Text style={styles.videoMetaTitle} numberOfLines={1}>
                  {videoToMove.displayName}
                </Text>
                <Text style={styles.videoMetaFolder}>
                  Current folder: <Text style={{ color: palette.accentCyan, fontWeight: '700' }}>{videoToMove.folderName}</Text>
                </Text>
              </View>
            )}

            <Text style={styles.modalSectionLabel}>Select Destination Folder:</Text>

            <ScrollView style={styles.folderSelectionList} showsVerticalScrollIndicator={false}>
              {folders.map((f) => {
                const isCurrent = f.name === videoToMove?.folderName;
                const isSelected = !isCustomFolderMode && targetFolderName === f.name;

                return (
                  <TouchableOpacity
                    key={f.name}
                    style={[
                      styles.folderOptionRow,
                      isSelected && styles.folderOptionRowSelected,
                      isCurrent && styles.folderOptionRowCurrent,
                    ]}
                    onPress={() => {
                      if (!isCurrent) {
                        setIsCustomFolderMode(false);
                        setTargetFolderName(f.name);
                      }
                    }}
                    disabled={isCurrent}
                    activeOpacity={0.7}
                  >
                    <View style={styles.folderOptionIcon}>
                      <Folder
                        size={20}
                        color={isSelected ? palette.accentCyan : isCurrent ? palette.slate600 : palette.primary400}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.folderOptionName,
                          isSelected && { color: palette.accentCyan, fontWeight: '700' },
                          isCurrent && { color: palette.slate500 },
                        ]}
                        numberOfLines={1}
                      >
                        {f.name} {isCurrent ? '(Current)' : ''}
                      </Text>
                      <Text style={styles.folderOptionMeta}>
                        {f.count} {f.count === 1 ? 'video' : 'videos'}
                      </Text>
                    </View>

                    {isSelected && <Check size={18} color={palette.accentCyan} />}
                  </TouchableOpacity>
                );
              })}

              {/* Create New Folder Option */}
              <TouchableOpacity
                style={[
                  styles.folderOptionRow,
                  isCustomFolderMode && styles.folderOptionRowSelected,
                ]}
                onPress={() => setIsCustomFolderMode(true)}
                activeOpacity={0.7}
              >
                <View style={styles.folderOptionIcon}>
                  <FolderPlus size={20} color={isCustomFolderMode ? palette.accentCyan : palette.slate400} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.folderOptionName,
                      isCustomFolderMode && { color: palette.accentCyan, fontWeight: '700' },
                    ]}
                  >
                    + Create New Destination Folder
                  </Text>
                </View>

                {isCustomFolderMode && <Check size={18} color={palette.accentCyan} />}
              </TouchableOpacity>

              {isCustomFolderMode && (
                <View style={styles.customFolderInputWrapper}>
                  <TextInput
                    style={styles.modalInput}
                    value={customFolderNameInput}
                    onChangeText={setCustomFolderNameInput}
                    placeholder="Enter new folder name..."
                    placeholderTextColor={palette.slate500}
                    autoFocus
                  />
                </View>
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsMoveModalOpen(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleConfirmMoveVideo}
                testID="confirm-move-btn"
              >
                <Text style={styles.confirmButtonText}>Transfer Video</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  mainHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  folderDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  folderTitle: {
    ...typography.h2,
    color: darkTheme.text,
    fontSize: 20,
    maxWidth: '85%',
  },
  renameIconButton: {
    padding: spacing.xs,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderRadius: borderRadius.sm,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 90,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkTheme.cardBackground,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  folderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    ...typography.bodyMedium,
    color: darkTheme.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  folderMeta: {
    ...typography.caption,
    color: darkTheme.textSecondary,
  },
  folderActionButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: palette.slate900,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: darkTheme.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  moveModalContent: {
    maxHeight: '82%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    color: palette.white,
    fontSize: 18,
    fontWeight: '700',
  },
  modalDescription: {
    ...typography.caption,
    color: palette.slate400,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: palette.slate800,
    color: palette.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: palette.slate700,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalButton: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelButtonText: {
    ...typography.bodyMedium,
    color: palette.slate300,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: palette.primary500,
  },
  confirmButtonText: {
    ...typography.bodyMedium,
    color: palette.white,
    fontWeight: '700',
  },

  /* Video Meta Box in Move Modal */
  videoMetaBox: {
    backgroundColor: palette.slate800,
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.slate700,
  },
  videoMetaTitle: {
    ...typography.bodyMedium,
    color: palette.white,
    fontWeight: '600',
    marginBottom: 2,
  },
  videoMetaFolder: {
    ...typography.caption,
    color: palette.slate400,
    fontSize: 12,
  },
  modalSectionLabel: {
    ...typography.caption,
    color: palette.slate300,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  folderSelectionList: {
    maxHeight: 220,
    marginBottom: spacing.md,
  },
  folderOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  folderOptionRowSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: palette.accentCyan,
  },
  folderOptionRowCurrent: {
    opacity: 0.45,
  },
  folderOptionIcon: {
    marginRight: spacing.sm,
  },
  folderOptionName: {
    ...typography.bodyMedium,
    color: palette.white,
    fontSize: 14,
  },
  folderOptionMeta: {
    ...typography.caption,
    color: palette.slate400,
    fontSize: 11,
    marginTop: 1,
  },
  customFolderInputWrapper: {
    marginTop: spacing.xs,
    paddingHorizontal: 2,
  },
});
