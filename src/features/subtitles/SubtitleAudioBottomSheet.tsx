import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { X, Check, FileText, Volume2, Plus, Minus, FilePlus } from 'lucide-react-native';
import { palette, darkTheme } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';
import { AudioTrack, SubtitleTrack } from '../../types/player';
import { pickSubtitleFile } from '../../services/mediaDiscovery/mediaDiscoveryService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { File as ExpoFile } from 'expo-file-system';

interface SubtitleAudioBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  activeAudioTrackId: string | null;
  activeSubtitleTrackId: string | null;
  subtitleDelayMs: number;
  audioDelayMs: number;
  onSelectAudioTrack: (id: string) => void;
  onSelectSubtitleTrack: (id: string | null) => void;
  onLoadExternalSubtitleText: (text: string, filename: string) => void;
  onSetSubtitleDelay: (ms: number) => void;
  onSetAudioDelay: (ms: number) => void;
}

export const SubtitleAudioBottomSheet: React.FC<SubtitleAudioBottomSheetProps> = ({
  visible,
  onClose,
  audioTracks,
  subtitleTracks,
  activeAudioTrackId,
  activeSubtitleTrackId,
  subtitleDelayMs,
  audioDelayMs,
  onSelectAudioTrack,
  onSelectSubtitleTrack,
  onLoadExternalSubtitleText,
  onSetSubtitleDelay,
  onSetAudioDelay,
}) => {
  const [activeTab, setActiveTab] = useState<'subtitles' | 'audio'>('subtitles');
  const insets = useSafeAreaInsets();
  const effectiveBottomInset =
    Platform.OS === 'android' ? Math.max(insets.bottom, 48) : insets.bottom;
  const bottomPadding = Math.max(effectiveBottomInset, 20) + 16;

  const handlePickExternalSubtitle = async () => {
    try {
      const file = await pickSubtitleFile();
      if (!file) return;

      let content = '';
      try {
        const expoFile = new ExpoFile(file.uri);
        content = await expoFile.text();
      } catch (_) {
        if (FileSystem.readAsStringAsync) {
          content = await FileSystem.readAsStringAsync(file.uri);
        }
      }
      onLoadExternalSubtitleText(content, file.name);
      Alert.alert('Subtitle Loaded', `Loaded ${file.name}`);
    } catch (err: any) {
      Alert.alert('Error', 'Could not read subtitle file: ' + err.message);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheetContainer, { paddingBottom: bottomPadding }]} testID="subtitle-audio-bottom-sheet">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'subtitles' && styles.activeTabButton]}
                onPress={() => setActiveTab('subtitles')}
              >
                <FileText size={18} color={activeTab === 'subtitles' ? palette.accentCyan : palette.slate400} />
                <Text style={[styles.tabText, activeTab === 'subtitles' && styles.activeTabText]}>
                  Subtitles
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'audio' && styles.activeTabButton]}
                onPress={() => setActiveTab('audio')}
              >
                <Volume2 size={18} color={activeTab === 'audio' ? palette.accentCyan : palette.slate400} />
                <Text style={[styles.tabText, activeTab === 'audio' && styles.activeTabText]}>
                  Audio Tracks
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose} testID="close-sheet-button">
              <X size={20} color={palette.slate300} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll}>
            {activeTab === 'subtitles' ? (
              <View>
                {/* Off Option */}
                <TouchableOpacity
                  style={[styles.trackItem, activeSubtitleTrackId === null && styles.activeTrackItem]}
                  onPress={() => onSelectSubtitleTrack(null)}
                >
                  <Text style={styles.trackLabel}>Off</Text>
                  {activeSubtitleTrackId === null && <Check size={18} color={palette.accentCyan} />}
                </TouchableOpacity>

                {/* Subtitle Track Items */}
                {subtitleTracks.map((track) => (
                  <TouchableOpacity
                    key={track.id}
                    style={[styles.trackItem, activeSubtitleTrackId === track.id && styles.activeTrackItem]}
                    onPress={() => onSelectSubtitleTrack(track.id)}
                  >
                    <View>
                      <Text style={styles.trackLabel}>{track.label}</Text>
                      {track.language && (
                        <Text style={styles.trackMeta}>{track.language.toUpperCase()} • {track.format || 'Embedded'}</Text>
                      )}
                    </View>
                    {activeSubtitleTrackId === track.id && <Check size={18} color={palette.accentCyan} />}
                  </TouchableOpacity>
                ))}

                {/* External Subtitle Picker */}
                <TouchableOpacity style={styles.loadExternalButton} onPress={handlePickExternalSubtitle}>
                  <FilePlus size={18} color={palette.primary400} style={{ marginRight: 8 }} />
                  <Text style={styles.loadExternalText}>Load External Subtitle (.srt / .vtt)</Text>
                </TouchableOpacity>

                {/* Subtitle Delay Sync Control */}
                <View style={styles.syncSection}>
                  <Text style={styles.syncTitle}>Subtitle Synchronization (Delay)</Text>
                  <View style={styles.syncRow}>
                    <TouchableOpacity
                      style={styles.syncButton}
                      onPress={() => onSetSubtitleDelay(subtitleDelayMs - 100)}
                    >
                      <Minus size={18} color={palette.white} />
                    </TouchableOpacity>
                    <Text style={styles.syncValueText}>{subtitleDelayMs > 0 ? `+${subtitleDelayMs}` : subtitleDelayMs} ms</Text>
                    <TouchableOpacity
                      style={styles.syncButton}
                      onPress={() => onSetSubtitleDelay(subtitleDelayMs + 100)}
                    >
                      <Plus size={18} color={palette.white} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <View>
                {/* Audio Track Items */}
                {audioTracks.length === 0 ? (
                  <Text style={styles.emptyText}>Default Audio Stream</Text>
                ) : (
                  audioTracks.map((track) => (
                    <TouchableOpacity
                      key={track.id}
                      style={[styles.trackItem, activeAudioTrackId === track.id && styles.activeTrackItem]}
                      onPress={() => onSelectAudioTrack(track.id)}
                    >
                      <View>
                        <Text style={styles.trackLabel}>{track.label}</Text>
                        {track.language && (
                          <Text style={styles.trackMeta}>{track.language.toUpperCase()} {track.codec ? `• ${track.codec}` : ''}</Text>
                        )}
                      </View>
                      {activeAudioTrackId === track.id && <Check size={18} color={palette.accentCyan} />}
                    </TouchableOpacity>
                  ))
                )}

                {/* Audio Delay Sync Control */}
                <View style={styles.syncSection}>
                  <Text style={styles.syncTitle}>Audio Synchronization (Delay)</Text>
                  <View style={styles.syncRow}>
                    <TouchableOpacity
                      style={styles.syncButton}
                      onPress={() => onSetAudioDelay(audioDelayMs - 100)}
                    >
                      <Minus size={18} color={palette.white} />
                    </TouchableOpacity>
                    <Text style={styles.syncValueText}>{audioDelayMs > 0 ? `+${audioDelayMs}` : audioDelayMs} ms</Text>
                    <TouchableOpacity
                      style={styles.syncButton}
                      onPress={() => onSetAudioDelay(audioDelayMs + 100)}
                    >
                      <Plus size={18} color={palette.white} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: darkTheme.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    maxHeight: '65%',
    borderWidth: 1,
    borderColor: darkTheme.borderSubtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: darkTheme.borderSubtle,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    gap: 6,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: palette.accentCyan,
  },
  tabText: {
    ...typography.bodyMedium,
    color: palette.slate400,
  },
  activeTabText: {
    color: palette.accentCyan,
    fontWeight: '700',
  },
  closeButton: {
    padding: spacing.xs,
  },
  contentScroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    backgroundColor: darkTheme.surfaceVariant,
  },
  activeTrackItem: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: palette.primary500,
    borderWidth: 1,
  },
  trackLabel: {
    ...typography.bodyMedium,
    color: darkTheme.text,
    fontWeight: '500',
  },
  trackMeta: {
    ...typography.caption,
    color: darkTheme.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: darkTheme.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  loadExternalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: palette.primary500,
    borderStyle: 'dashed',
  },
  loadExternalText: {
    ...typography.bodyMedium,
    color: palette.primary400,
    fontWeight: '600',
  },
  syncSection: {
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
    padding: spacing.md,
    backgroundColor: palette.slate800,
    borderRadius: borderRadius.md,
  },
  syncTitle: {
    ...typography.caption,
    color: palette.slate300,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  syncButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.slate700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncValueText: {
    ...typography.mono,
    color: palette.white,
    fontSize: 16,
    minWidth: 90,
    textAlign: 'center',
  },
});
