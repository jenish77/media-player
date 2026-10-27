import { create } from 'zustand';
import { Playlist, PlaylistItem } from '../types/media';
import {
  getAllPlaylists,
  createPlaylist as dbCreatePlaylist,
  deletePlaylist as dbDeletePlaylist,
  getPlaylistItems,
  addMediaToPlaylist,
  removeMediaFromPlaylist,
} from '../services/database/playlistRepository';

interface PlaylistState {
  playlists: Playlist[];
  currentPlaylist: Playlist | null;
  playlistItems: PlaylistItem[];
  isLoading: boolean;

  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  selectPlaylist: (playlist: Playlist | null) => Promise<void>;
  addItemToPlaylist: (playlistId: string, mediaItemId: string) => Promise<void>;
  removeItemFromPlaylist: (playlistId: string, mediaItemId: string) => Promise<void>;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  currentPlaylist: null,
  playlistItems: [],
  isLoading: false,

  loadPlaylists: async () => {
    set({ isLoading: true });
    try {
      const lists = await getAllPlaylists();
      set({ playlists: lists, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createPlaylist: async (name: string) => {
    const created = await dbCreatePlaylist(name);
    await get().loadPlaylists();
    return created;
  },

  deletePlaylist: async (id: string) => {
    await dbDeletePlaylist(id);
    if (get().currentPlaylist?.id === id) {
      set({ currentPlaylist: null, playlistItems: [] });
    }
    await get().loadPlaylists();
  },

  selectPlaylist: async (playlist: Playlist | null) => {
    set({ currentPlaylist: playlist });
    if (playlist) {
      const items = await getPlaylistItems(playlist.id);
      set({ playlistItems: items });
    } else {
      set({ playlistItems: [] });
    }
  },

  addItemToPlaylist: async (playlistId: string, mediaItemId: string) => {
    await addMediaToPlaylist(playlistId, mediaItemId);
    if (get().currentPlaylist?.id === playlistId) {
      await get().selectPlaylist(get().currentPlaylist);
    }
  },

  removeItemFromPlaylist: async (playlistId: string, mediaItemId: string) => {
    await removeMediaFromPlaylist(playlistId, mediaItemId);
    if (get().currentPlaylist?.id === playlistId) {
      await get().selectPlaylist(get().currentPlaylist);
    }
  },
}));
