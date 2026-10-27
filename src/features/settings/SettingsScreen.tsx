import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import {
  Moon,
  Gauge,
  RotateCcw,
  Sparkles,
  HandMetal,
  Type,
  Trash2,
  RefreshCw,
  Info,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react-native';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { clearWatchHistory } from '../../services/database/mediaRepository';
import { palette, darkTheme } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

interface SettingsScreenProps {
  navigation: any;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { settings, loadSettings, updateSettings } = useSettingsStore();
  const { scanMedia, isScanning } = useLibraryStore();

  useEffect(() => {
    loadSettings();
  }, []);

  const handleClearHistory = () => {
    Alert.alert('Clear History', 'Reset all watch positions and recent history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await clearWatchHistory();
          Alert.alert('Success', 'Watch history cleared.');
        },
      },
    ]);
  };

  const speedOptions = [0.75, 1.0, 1.25, 1.5, 2.0];
  const skipOptions = [5, 10, 15, 30];

  return (
    <View style={styles.container} testID="settings-screen">
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Preferences & player configuration</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Playback Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PLAYBACK</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingIconBox}>
                <Gauge size={20} color={palette.primary400} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Default Speed</Text>
                <Text style={styles.settingDesc}>Initial speed when opening videos</Text>
              </View>
            </View>
            <View style={styles.optionsRow}>
              {speedOptions.map((speed) => (
                <TouchableOpacity
                  key={speed}
                  style={[
                    styles.optionChip,
                    settings.defaultPlaybackRate === speed && styles.activeOptionChip,
                  ]}
                  onPress={() => updateSettings({ defaultPlaybackRate: speed })}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      settings.defaultPlaybackRate === speed && styles.activeOptionChipText,
                    ]}
                  >
                    {speed}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingIconBox}>
                <RotateCcw size={20} color={palette.accentCyan} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Skip Interval</Text>
                <Text style={styles.settingDesc}>Double-tap and button seek duration</Text>
              </View>
            </View>
            <View style={styles.optionsRow}>
              {skipOptions.map((secs) => (
                <TouchableOpacity
                  key={secs}
                  style={[
                    styles.optionChip,
                    settings.defaultSkipIntervalSeconds === secs && styles.activeOptionChip,
                  ]}
                  onPress={() => updateSettings({ defaultSkipIntervalSeconds: secs })}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      settings.defaultSkipIntervalSeconds === secs && styles.activeOptionChipText,
                    ]}
                  >
                    {secs}s
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Auto-Resume</Text>
              <Text style={styles.settingDesc}>Automatically resume from last position</Text>
            </View>
            <Switch
              value={settings.autoResume}
              onValueChange={(val) => updateSettings({ autoResume: val })}
              thumbColor={settings.autoResume ? palette.primary500 : palette.slate400}
              trackColor={{ false: palette.slate700, true: palette.primary600 }}
              testID="auto-resume-switch"
            />
          </View>
        </View>

        {/* Gestures Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>GESTURES & TOUCH</Text>

          <View style={styles.switchRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Enable Touch Gestures</Text>
              <Text style={styles.settingDesc}>Single tap, double tap, and edge swipes</Text>
            </View>
            <Switch
              value={settings.gesturesEnabled}
              onValueChange={(val) => updateSettings({ gesturesEnabled: val })}
              thumbColor={settings.gesturesEnabled ? palette.primary500 : palette.slate400}
              trackColor={{ false: palette.slate700, true: palette.primary600 }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Double Tap to Seek</Text>
              <Text style={styles.settingDesc}>Double tap left/right to skip interval</Text>
            </View>
            <Switch
              value={settings.doubleTapSeekEnabled}
              onValueChange={(val) => updateSettings({ doubleTapSeekEnabled: val })}
              thumbColor={settings.doubleTapSeekEnabled ? palette.primary500 : palette.slate400}
              trackColor={{ false: palette.slate700, true: palette.primary600 }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Vertical Swipes</Text>
              <Text style={styles.settingDesc}>Left side brightness, right side volume</Text>
            </View>
            <Switch
              value={settings.swipeVolumeEnabled}
              onValueChange={(val) =>
                updateSettings({ swipeVolumeEnabled: val, swipeBrightnessEnabled: val })
              }
              thumbColor={settings.swipeVolumeEnabled ? palette.primary500 : palette.slate400}
              trackColor={{ false: palette.slate700, true: palette.primary600 }}
            />
          </View>
        </View>

        {/* Subtitles Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SUBTITLES</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingIconBox}>
                <Type size={20} color={palette.primary400} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Subtitle Font Size</Text>
                <Text style={styles.settingDesc}>Current: {settings.subtitleFontSize}px</Text>
              </View>
            </View>
            <View style={styles.optionsRow}>
              {[14, 16, 18, 22].map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.optionChip,
                    settings.subtitleFontSize === size && styles.activeOptionChip,
                  ]}
                  onPress={() => updateSettings({ subtitleFontSize: size })}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      settings.subtitleFontSize === size && styles.activeOptionChipText,
                    ]}
                  >
                    {size}px
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Data & Maintenance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>LIBRARY & DATA</Text>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={scanMedia}
            disabled={isScanning}
          >
            <RefreshCw size={20} color={palette.accentCyan} style={styles.actionIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Rescan Media Library</Text>
              <Text style={styles.actionDesc}>Index newly added video files</Text>
            </View>
            <ChevronRight size={18} color={palette.slate500} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} onPress={handleClearHistory}>
            <Trash2 size={20} color={palette.error} style={styles.actionIcon} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: palette.error }]}>Clear Watch History</Text>
              <Text style={styles.actionDesc}>Reset playback positions</Text>
            </View>
            <ChevronRight size={18} color={palette.slate500} />
          </TouchableOpacity>
        </View>

        {/* About & Licenses */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ABOUT</Text>

          <View style={styles.infoRow}>
            <Info size={20} color={palette.slate400} style={styles.actionIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Nova Player</Text>
              <Text style={styles.settingDesc}>Version 1.0.0 (Production Build)</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => navigation.navigate('Premium')}
          >
            <Sparkles size={20} color={palette.warning} style={styles.actionIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Nova Player Pro</Text>
              <Text style={styles.actionDesc}>Ad-free and advanced features</Text>
            </View>
            <ChevronRight size={18} color={palette.slate500} />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  content: {
    padding: spacing.md,
    paddingBottom: 90,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    ...typography.caption,
    color: palette.slate500,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  settingCard: {
    backgroundColor: darkTheme.cardBackground,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  settingIconBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: darkTheme.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    ...typography.bodyMedium,
    color: darkTheme.text,
    fontWeight: '600',
  },
  settingDesc: {
    ...typography.caption,
    color: darkTheme.textSecondary,
    marginTop: 2,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optionChip: {
    flex: 1,
    paddingVertical: spacing.xs,
    backgroundColor: darkTheme.surfaceVariant,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  activeOptionChip: {
    backgroundColor: palette.primary500,
  },
  optionChipText: {
    ...typography.caption,
    color: palette.slate300,
    fontWeight: '600',
  },
  activeOptionChipText: {
    color: palette.white,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: darkTheme.cardBackground,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkTheme.cardBackground,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  actionIcon: {
    marginRight: spacing.md,
  },
  actionTitle: {
    ...typography.bodyMedium,
    color: darkTheme.text,
    fontWeight: '600',
  },
  actionDesc: {
    ...typography.caption,
    color: darkTheme.textSecondary,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkTheme.cardBackground,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
});
