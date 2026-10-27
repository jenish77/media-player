import { getDatabase } from './db';
import { AppSettings } from '../../types/media';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  defaultPlaybackRate: 1.0,
  defaultSkipIntervalSeconds: 15,
  defaultAspectRatio: 'fit',
  autoResume: true,
  gesturesEnabled: true,
  doubleTapSeekEnabled: true,
  swipeBrightnessEnabled: true,
  swipeVolumeEnabled: true,
  backgroundAudioEnabled: true,
  pipEnabled: true,
  subtitleFontSize: 16,
  subtitleTextColor: '#FFFFFF',
  subtitleBackgroundColor: 'rgba(0, 0, 0, 0.75)',
  libraryLayout: 'grid',
  sortOrder: 'name',
  sortDirection: 'asc',
};

const SETTINGS_KEY = 'user_app_settings';

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>('SELECT value FROM app_settings WHERE key = ?', [SETTINGS_KEY]);
    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.error('Failed to load app settings from database:', err);
  }
  return DEFAULT_SETTINGS;
}

export async function saveAppSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await loadAppSettings();
  const updated: AppSettings = { ...current, ...settings };
  try {
    const db = await getDatabase();
    const now = Date.now();
    await db.runAsync(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
      [SETTINGS_KEY, JSON.stringify(updated), now]
    );
  } catch (err) {
    console.error('Failed to persist app settings:', err);
  }
  return updated;
}
