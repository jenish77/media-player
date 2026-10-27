import { getDatabase } from './db';
import { MediaItem } from '../../types/media';

function mapRowToMediaItem(row: any): MediaItem {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceReference: row.source_reference,
    displayName: row.display_name,
    durationMs: row.duration_ms,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    mimeType: row.mime_type,
    container: row.container,
    dateAdded: row.date_added,
    lastSeenAt: row.last_seen_at,
    availabilityStatus: row.availability_status,
    thumbnailStatus: row.thumbnail_status,
    thumbnailUri: row.thumbnail_uri,
    lastPositionMs: row.last_position_ms || 0,
    lastPlayedAt: row.last_played_at,
    isFavorite: Boolean(row.is_favorite),
    folderName: row.folder_name || 'Videos',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertMediaItem(item: MediaItem): Promise<void> {
  const db = await getDatabase();
  const sql = `
    INSERT OR REPLACE INTO media_items (
      id, source_type, source_reference, display_name, duration_ms,
      size_bytes, width, height, mime_type, container,
      date_added, last_seen_at, availability_status, thumbnail_status,
      thumbnail_uri, last_position_ms, last_played_at, is_favorite,
      folder_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await db.runAsync(sql, [
    item.id,
    item.sourceType,
    item.sourceReference,
    item.displayName,
    item.durationMs,
    item.sizeBytes,
    item.width,
    item.height,
    item.mimeType,
    item.container,
    item.dateAdded,
    item.lastSeenAt,
    item.availabilityStatus,
    item.thumbnailStatus,
    item.thumbnailUri,
    item.lastPositionMs,
    item.lastPlayedAt,
    item.isFavorite ? 1 : 0,
    item.folderName,
    item.createdAt,
    item.updatedAt,
  ]);
}

export async function upsertMediaItemsBatch(items: MediaItem[]): Promise<void> {
  for (const item of items) {
    await upsertMediaItem(item);
  }
}

export async function getAllMediaItems(
  sortBy: 'name' | 'date' | 'duration' | 'size' = 'name',
  direction: 'asc' | 'desc' = 'asc'
): Promise<MediaItem[]> {
  const db = await getDatabase();
  let orderBy = 'display_name COLLATE NOCASE ASC';

  if (sortBy === 'date') {
    orderBy = `date_added ${direction.toUpperCase()}`;
  } else if (sortBy === 'duration') {
    orderBy = `duration_ms ${direction.toUpperCase()}`;
  } else if (sortBy === 'size') {
    orderBy = `size_bytes ${direction.toUpperCase()}`;
  } else {
    orderBy = `display_name COLLATE NOCASE ${direction.toUpperCase()}`;
  }

  const rows = await db.getAllAsync<any>(`SELECT * FROM media_items ORDER BY ${orderBy}`);
  return rows.map(mapRowToMediaItem);
}

export async function getMediaItemById(id: string): Promise<MediaItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM media_items WHERE id = ?', [id]);
  return row ? mapRowToMediaItem(row) : null;
}

export async function getMediaItemByReference(ref: string): Promise<MediaItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM media_items WHERE source_reference = ?', [ref]);
  return row ? mapRowToMediaItem(row) : null;
}

export async function getRecentMedia(limit: number = 20): Promise<MediaItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM media_items WHERE last_played_at IS NOT NULL ORDER BY last_played_at DESC LIMIT ?',
    [limit]
  );
  return rows.map(mapRowToMediaItem);
}

export async function getContinueWatching(): Promise<MediaItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM media_items WHERE last_position_ms > 5000 AND (duration_ms IS NULL OR last_position_ms < duration_ms * 0.95) ORDER BY last_played_at DESC LIMIT 10'
  );
  return rows.map(mapRowToMediaItem);
}

export async function getFavorites(): Promise<MediaItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM media_items WHERE is_favorite = 1 ORDER BY display_name COLLATE NOCASE ASC'
  );
  return rows.map(mapRowToMediaItem);
}

export async function updatePlaybackPosition(id: string, positionMs: number): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync(
    'UPDATE media_items SET last_position_ms = ?, last_played_at = ?, updated_at = ? WHERE id = ?',
    [positionMs, now, now, id]
  );
}

export async function toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync(
    'UPDATE media_items SET is_favorite = ?, updated_at = ? WHERE id = ?',
    [isFavorite ? 1 : 0, now, id]
  );
}

export async function updateThumbnail(
  id: string,
  thumbnailUri: string,
  status: 'ready' | 'failed' = 'ready'
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync(
    'UPDATE media_items SET thumbnail_uri = ?, thumbnail_status = ?, updated_at = ? WHERE id = ?',
    [thumbnailUri, status, now, id]
  );
}

export async function deleteMediaItem(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM media_items WHERE id = ?', [id]);
}

export async function clearWatchHistory(): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync('UPDATE media_items SET last_position_ms = 0, last_played_at = NULL, updated_at = ?', [now]);
}

export async function getFolders(): Promise<{ name: string; count: number; totalSizeBytes: number }[]> {
  const items = await getAllMediaItems('name', 'asc');
  const folderMap = new Map<string, { count: number; totalSizeBytes: number }>();

  items.forEach((item) => {
    const folder = item.folderName || 'Videos';
    const current = folderMap.get(folder) || { count: 0, totalSizeBytes: 0 };
    current.count += 1;
    current.totalSizeBytes += item.sizeBytes || 0;
    folderMap.set(folder, current);
  });

  return Array.from(folderMap.entries()).map(([name, data]) => ({
    name,
    count: data.count,
    totalSizeBytes: data.totalSizeBytes,
  }));
}

export async function getMediaByFolder(folderName: string): Promise<MediaItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM media_items WHERE folder_name = ? ORDER BY display_name COLLATE NOCASE ASC',
    [folderName]
  );
  return rows.map(mapRowToMediaItem);
}

export async function searchMedia(query: string): Promise<MediaItem[]> {
  if (!query || !query.trim()) return getAllMediaItems();
  const items = await getAllMediaItems();
  const lowerQuery = query.toLowerCase().trim();
  return items.filter((item) => item.displayName.toLowerCase().includes(lowerQuery));
}

export async function renameFolder(oldFolderName: string, newFolderName: string): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync(
    'UPDATE media_items SET folder_name = ?, updated_at = ? WHERE folder_name = ?',
    [newFolderName, now, oldFolderName]
  );
}

export async function moveMediaToFolder(mediaId: string, targetFolderName: string): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync(
    'UPDATE media_items SET folder_name = ?, updated_at = ? WHERE id = ?',
    [targetFolderName, now, mediaId]
  );
}
