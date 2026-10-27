import { getDatabase } from './db';
import { Playlist, PlaylistItem } from '../../types/media';

export async function createPlaylist(name: string): Promise<Playlist> {
  const db = await getDatabase();
  const id = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  await db.runAsync(
    'INSERT INTO playlists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [id, name, now, now]
  );

  return { id, name, createdAt: now, updatedAt: now, itemCount: 0 };
}

export async function getAllPlaylists(): Promise<Playlist[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM playlists ORDER BY name COLLATE NOCASE ASC');
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    itemCount: 0,
  }));
}

export async function deletePlaylist(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM playlist_items WHERE playlist_id = ?', [id]);
  await db.runAsync('DELETE FROM playlists WHERE id = ?', [id]);
}

export async function addMediaToPlaylist(playlistId: string, mediaItemId: string): Promise<void> {
  const db = await getDatabase();
  const id = `pli_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const existing = await db.getAllAsync<any>(
    'SELECT position FROM playlist_items WHERE playlist_id = ? ORDER BY position DESC LIMIT 1',
    [playlistId]
  );
  const nextPos = existing.length > 0 ? (existing[0].position || 0) + 1 : 0;

  await db.runAsync(
    'INSERT INTO playlist_items (id, playlist_id, media_item_id, position) VALUES (?, ?, ?, ?)',
    [id, playlistId, mediaItemId, nextPos]
  );
}

export async function getPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT pi.*, m.display_name, m.duration_ms, m.thumbnail_uri, m.source_reference
     FROM playlist_items pi
     LEFT JOIN media_items m ON pi.media_item_id = m.id
     WHERE pi.playlist_id = ?
     ORDER BY pi.position ASC`,
    [playlistId]
  );

  return rows.map((r) => ({
    id: r.id,
    playlistId: r.playlist_id,
    mediaItemId: r.media_item_id,
    position: r.position,
    mediaItem: r.display_name
      ? {
          id: r.media_item_id,
          displayName: r.display_name,
          durationMs: r.duration_ms,
          thumbnailUri: r.thumbnail_uri,
          sourceReference: r.source_reference,
        } as any
      : undefined,
  }));
}

export async function removeMediaFromPlaylist(playlistId: string, mediaItemId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'DELETE FROM playlist_items WHERE playlist_id = ? AND media_item_id = ?',
    [playlistId, mediaItemId]
  );
}
