import {
  getDatabase,
  upsertMediaItem,
  getAllMediaItems,
  getMediaItemById,
  updatePlaybackPosition,
  toggleFavorite,
  getFavorites,
  getContinueWatching,
  deleteMediaItem,
  getFolders,
  renameFolder,
  moveMediaToFolder,
  createPlaylist,
  getAllPlaylists,
  addMediaToPlaylist,
  getPlaylistItems,
  deletePlaylist,
  loadAppSettings,
  saveAppSettings,
} from '../../src/services/database';
import { MediaItem } from '../../src/types/media';

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    await getDatabase();
  });

  const sampleMedia1: MediaItem = {
    id: 'test_m1',
    sourceType: 'android_mediastore',
    sourceReference: 'content://media/external/video/media/101',
    displayName: 'The Dark Knight.mp4',
    durationMs: 9000000,
    sizeBytes: 2147483648,
    width: 1920,
    height: 1080,
    mimeType: 'video/mp4',
    container: 'MP4',
    dateAdded: 1680000000000,
    lastSeenAt: 1680000000000,
    availabilityStatus: 'available',
    thumbnailStatus: 'ready',
    thumbnailUri: 'content://thumb/101',
    lastPositionMs: 0,
    lastPlayedAt: null,
    isFavorite: false,
    folderName: 'Movies',
    createdAt: 1680000000000,
    updatedAt: 1680000000000,
  };

  const sampleMedia2: MediaItem = {
    id: 'test_m2',
    sourceType: 'local_file',
    sourceReference: 'file:///storage/anime/episode_01.mkv',
    displayName: 'Attack on Titan S01E01.mkv',
    durationMs: 1440000,
    sizeBytes: 800000000,
    width: 1920,
    height: 1080,
    mimeType: 'video/mkv',
    container: 'MKV',
    dateAdded: 1681000000000,
    lastSeenAt: 1681000000000,
    availabilityStatus: 'available',
    thumbnailStatus: 'none',
    thumbnailUri: null,
    lastPositionMs: 500000, // Watched ~8 minutes (meaningful progress)
    lastPlayedAt: 1682000000000,
    isFavorite: true,
    folderName: 'Anime',
    createdAt: 1681000000000,
    updatedAt: 1682000000000,
  };

  it('inserts and retrieves media items', async () => {
    await upsertMediaItem(sampleMedia1);
    await upsertMediaItem(sampleMedia2);

    const items = await getAllMediaItems();
    expect(items.length).toBeGreaterThanOrEqual(2);

    const fetched = await getMediaItemById('test_m1');
    expect(fetched).not.toBeNull();
    expect(fetched?.displayName).toBe('The Dark Knight.mp4');
    expect(fetched?.container).toBe('MP4');
  });

  it('queries continue watching items with meaningful progress', async () => {
    const cw = await getContinueWatching();
    expect(cw.length).toBeGreaterThanOrEqual(1);
    expect(cw.some((m) => m.id === 'test_m2')).toBe(true);
  });

  it('toggles favorites and retrieves favorite list', async () => {
    await toggleFavorite('test_m1', true);
    const favs = await getFavorites();
    expect(favs.some((m) => m.id === 'test_m1')).toBe(true);

    await toggleFavorite('test_m1', false);
  });

  it('updates playback position', async () => {
    await updatePlaybackPosition('test_m1', 450000);
    const updated = await getMediaItemById('test_m1');
    expect(updated?.lastPositionMs).toBe(450000);
    expect(updated?.lastPlayedAt).not.toBeNull();
  });

  it('groups items into folders', async () => {
    const folders = await getFolders();
    expect(folders.length).toBeGreaterThanOrEqual(2);
    expect(folders.some((f) => f.name === 'Movies')).toBe(true);
    expect(folders.some((f) => f.name === 'Anime')).toBe(true);
  });

  it('renames a folder and moves media between folders', async () => {
    // Rename 'Anime' folder to 'Japanese Animation'
    await renameFolder('Anime', 'Japanese Animation');
    let item = await getMediaItemById('test_m2');
    expect(item?.folderName).toBe('Japanese Animation');

    // Move 'test_m2' to 'Favorites'
    await moveMediaToFolder('test_m2', 'Favorites');
    item = await getMediaItemById('test_m2');
    expect(item?.folderName).toBe('Favorites');

    const folders = await getFolders();
    expect(folders.some((f) => f.name === 'Favorites')).toBe(true);
  });

  it('deletes media items', async () => {
    await deleteMediaItem('test_m1');
    const item = await getMediaItemById('test_m1');
    expect(item).toBeNull();
  });

  it('manages playlists and playlist items', async () => {
    const playlist = await createPlaylist('Action Favorites');
    expect(playlist.name).toBe('Action Favorites');

    const playlists = await getAllPlaylists();
    expect(playlists.some((p) => p.id === playlist.id)).toBe(true);

    await addMediaToPlaylist(playlist.id, 'test_m2');
    const items = await getPlaylistItems(playlist.id);
    expect(items.length).toBe(1);
    expect(items[0].mediaItemId).toBe('test_m2');

    await deletePlaylist(playlist.id);
    const afterDelete = await getAllPlaylists();
    expect(afterDelete.some((p) => p.id === playlist.id)).toBe(false);
  });

  it('persists and retrieves app settings', async () => {
    const defaults = await loadAppSettings();
    expect(defaults.theme).toBe('dark');
    expect(defaults.defaultPlaybackRate).toBe(1.0);

    await saveAppSettings({ defaultPlaybackRate: 1.5, defaultSkipIntervalSeconds: 15 });
    const updated = await loadAppSettings();
    expect(updated.defaultPlaybackRate).toBe(1.5);
    expect(updated.defaultSkipIntervalSeconds).toBe(15);
    expect(updated.theme).toBe('dark'); // unchanged default preserved
  });
});
