import { create } from 'zustand';
import { MediaItem } from '../types/media';
import {
  getAllMediaItems,
  getContinueWatching,
  getFavorites,
  getRecentMedia,
  getFolders,
  toggleFavorite as dbToggleFavorite,
  renameFolder as dbRenameFolder,
  moveMediaToFolder as dbMoveMediaToFolder,
} from '../services/database/mediaRepository';
import { scanDeviceVideos, ScanResult } from '../services/mediaDiscovery/mediaDiscoveryService';

interface LibraryState {
  mediaItems: MediaItem[];
  continueWatching: MediaItem[];
  favorites: MediaItem[];
  recent: MediaItem[];
  folders: { name: string; count: number; totalSizeBytes: number }[];
  searchQuery: string;
  selectedFolder: string | null;
  sortBy: 'name' | 'date' | 'duration' | 'size';
  sortDirection: 'asc' | 'desc';
  viewLayout: 'grid' | 'list';
  isScanning: boolean;
  scanError: string | null;

  loadLibrary: () => Promise<void>;
  scanMedia: () => Promise<ScanResult>;
  setSearchQuery: (query: string) => void;
  selectFolder: (folder: string | null) => void;
  setViewLayout: (layout: 'grid' | 'list') => void;
  setSort: (by: 'name' | 'date' | 'duration' | 'size', direction?: 'asc' | 'desc') => Promise<void>;
  toggleFavorite: (id: string, currentStatus: boolean) => Promise<void>;
  renameFolder: (oldName: string, newName: string) => Promise<void>;
  moveMediaToFolder: (mediaId: string, targetFolder: string) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  mediaItems: [],
  continueWatching: [],
  favorites: [],
  recent: [],
  folders: [],
  searchQuery: '',
  selectedFolder: null,
  sortBy: 'name',
  sortDirection: 'asc',
  viewLayout: 'grid',
  isScanning: false,
  scanError: null,

  loadLibrary: async () => {
    try {
      const { sortBy, sortDirection } = get();
      const [items, cw, favs, recents, foldersList] = await Promise.all([
        getAllMediaItems(sortBy, sortDirection),
        getContinueWatching(),
        getFavorites(),
        getRecentMedia(15),
        getFolders(),
      ]);

      set({
        mediaItems: items,
        continueWatching: cw,
        favorites: favs,
        recent: recents,
        folders: foldersList,
      });
    } catch (err: any) {
      console.error('Failed to load library:', err);
    }
  },

  scanMedia: async (): Promise<ScanResult> => {
    set({ isScanning: true, scanError: null });
    try {
      const scanResult = await scanDeviceVideos();
      if (scanResult.errors.length > 0 && scanResult.addedCount === 0) {
        set({ scanError: scanResult.errors[0] });
      }
      await get().loadLibrary();
      return scanResult;
    } catch (err: any) {
      const msg = err?.message || 'Scanning failed';
      set({ scanError: msg });
      return { addedCount: 0, totalFound: 0, errors: [msg] };
    } finally {
      set({ isScanning: false });
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  selectFolder: (folder: string | null) => {
    set({ selectedFolder: folder });
  },

  setViewLayout: (layout: 'grid' | 'list') => {
    set({ viewLayout: layout });
  },

  setSort: async (by: 'name' | 'date' | 'duration' | 'size', direction?: 'asc' | 'desc') => {
    const dir = direction || (get().sortBy === by && get().sortDirection === 'asc' ? 'desc' : 'asc');
    set({ sortBy: by, sortDirection: dir });
    await get().loadLibrary();
  },

  toggleFavorite: async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    await dbToggleFavorite(id, newStatus);
    await get().loadLibrary();
  },

  renameFolder: async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || oldName === trimmed) return;
    await dbRenameFolder(oldName, trimmed);
    if (get().selectedFolder === oldName) {
      set({ selectedFolder: trimmed });
    }
    await get().loadLibrary();
  },

  moveMediaToFolder: async (mediaId: string, targetFolder: string) => {
    const trimmed = targetFolder.trim();
    if (!trimmed) return;
    await dbMoveMediaToFolder(mediaId, trimmed);
    await get().loadLibrary();
  },
}));
