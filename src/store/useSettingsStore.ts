import { create } from 'zustand';
import { AppSettings } from '../types/media';
import { DEFAULT_SETTINGS, loadAppSettings, saveAppSettings } from '../services/database/settingsRepository';

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: true,

  loadSettings: async () => {
    try {
      const loaded = await loadAppSettings();
      set({ settings: loaded, isLoading: false });
    } catch {
      set({ settings: DEFAULT_SETTINGS, isLoading: false });
    }
  },

  updateSettings: async (partial: Partial<AppSettings>) => {
    const updated = await saveAppSettings(partial);
    set({ settings: updated });
  },
}));
