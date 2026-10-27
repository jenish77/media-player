import { CREATE_TABLES_SQL, SCHEMA_VERSION } from './schema';

export interface IDatabaseConnection {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T>(sql: string, params?: any[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: any[]): Promise<T | null>;
  runAsync(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowId: number }>;
}

let dbInstance: IDatabaseConnection | null = null;

// In-memory mock connection for Node/Jest testing environments
export class MemoryDatabaseConnection implements IDatabaseConnection {
  private tables: { [tableName: string]: any[] } = {
    schema_version: [],
    media_items: [],
    playback_preferences: [],
    playlists: [],
    playlist_items: [],
    app_settings: [],
  };

  async execAsync(_sql: string): Promise<void> {
    // In-memory schema initialized
  }

  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    const cleanSql = sql.trim().toLowerCase();

    if (cleanSql.includes('from media_items')) {
      let list = [...this.tables.media_items];

      if (cleanSql.includes('where is_favorite = 1')) {
        list = list.filter((m) => m.is_favorite === 1);
      } else if (cleanSql.includes('where last_played_at is not null')) {
        list = list.filter((m) => m.last_played_at !== null && m.last_played_at > 0);
      } else if (cleanSql.includes('where folder_name =')) {
        const folder = params[0];
        list = list.filter((m) => m.folder_name === folder);
      } else if (cleanSql.includes('where id =')) {
        const id = params[0];
        list = list.filter((m) => m.id === id);
      } else if (cleanSql.includes('where last_position_ms > 5000')) {
        list = list.filter((m) => m.last_position_ms > 5000);
      }

      if (cleanSql.includes('order by last_played_at desc')) {
        list.sort((a, b) => (b.last_played_at || 0) - (a.last_played_at || 0));
      } else if (cleanSql.includes('order by date_added desc')) {
        list.sort((a, b) => (b.date_added || 0) - (a.date_added || 0));
      } else if (cleanSql.includes('order by display_name collate nocase asc')) {
        list.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
      }

      return list as unknown as T[];
    }

    if (cleanSql.includes('from playlist_items')) {
      let items = [...this.tables.playlist_items];
      if (cleanSql.includes('where pi.playlist_id =') || cleanSql.includes('where playlist_id =')) {
        const pId = params[0];
        items = items.filter((i) => i.playlist_id === pId);
      }
      return items.map((i) => {
        const media = this.tables.media_items.find((m) => m.id === i.media_item_id);
        return {
          id: i.id,
          playlist_id: i.playlist_id,
          media_item_id: i.media_item_id,
          position: i.position,
          display_name: media?.display_name,
          duration_ms: media?.duration_ms,
          thumbnail_uri: media?.thumbnail_uri,
          source_reference: media?.source_reference,
        };
      }) as unknown as T[];
    }

    if (cleanSql.includes('from playlists')) {
      return [...this.tables.playlists] as unknown as T[];
    }

    if (cleanSql.includes('from app_settings')) {
      return [...this.tables.app_settings] as unknown as T[];
    }

    return [];
  }

  async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    const all = await this.getAllAsync<T>(sql, params);
    return all.length > 0 ? all[0] : null;
  }

  async runAsync(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowId: number }> {
    const cleanSql = sql.trim().toLowerCase();

    if (cleanSql.startsWith('insert or replace into media_items') || cleanSql.startsWith('insert into media_items')) {
      const [
        id,
        source_type,
        source_reference,
        display_name,
        duration_ms,
        size_bytes,
        width,
        height,
        mime_type,
        container,
        date_added,
        last_seen_at,
        availability_status,
        thumbnail_status,
        thumbnail_uri,
        last_position_ms,
        last_played_at,
        is_favorite,
        folder_name,
        created_at,
        updated_at,
      ] = params;

      const existingIndex = this.tables.media_items.findIndex(
        (m) => m.id === id || m.source_reference === source_reference
      );

      const record = {
        id,
        source_type,
        source_reference,
        display_name,
        duration_ms,
        size_bytes,
        width,
        height,
        mime_type,
        container,
        date_added,
        last_seen_at,
        availability_status,
        thumbnail_status,
        thumbnail_uri,
        last_position_ms,
        last_played_at,
        is_favorite,
        folder_name,
        created_at,
        updated_at,
      };

      if (existingIndex >= 0) {
        this.tables.media_items[existingIndex] = record;
      } else {
        this.tables.media_items.push(record);
      }

      return { changes: 1, lastInsertRowId: 1 };
    }

    if (cleanSql.startsWith('update media_items set last_position_ms')) {
      const [pos, playedAt, updatedAt, id] = params;
      const item = this.tables.media_items.find((m) => m.id === id);
      if (item) {
        item.last_position_ms = pos;
        item.last_played_at = playedAt;
        item.updated_at = updatedAt;
        return { changes: 1, lastInsertRowId: 1 };
      }
    }

    if (cleanSql.startsWith('update media_items set is_favorite')) {
      const [fav, updatedAt, id] = params;
      const item = this.tables.media_items.find((m) => m.id === id);
      if (item) {
        item.is_favorite = fav;
        item.updated_at = updatedAt;
        return { changes: 1, lastInsertRowId: 1 };
      }
    }

    if (cleanSql.startsWith('update media_items set folder_name') && cleanSql.includes('where folder_name =')) {
      const [newFolder, updatedAt, oldFolder] = params;
      let count = 0;
      this.tables.media_items.forEach((m) => {
        if (m.folder_name === oldFolder) {
          m.folder_name = newFolder;
          m.updated_at = updatedAt;
          count++;
        }
      });
      return { changes: count, lastInsertRowId: 0 };
    }

    if (cleanSql.startsWith('update media_items set folder_name') && cleanSql.includes('where id =')) {
      const [newFolder, updatedAt, id] = params;
      const item = this.tables.media_items.find((m) => m.id === id);
      if (item) {
        item.folder_name = newFolder;
        item.updated_at = updatedAt;
        return { changes: 1, lastInsertRowId: 0 };
      }
    }

    if (cleanSql.startsWith('delete from media_items where id =')) {
      const id = params[0];
      const prevLen = this.tables.media_items.length;
      this.tables.media_items = this.tables.media_items.filter((m) => m.id !== id);
      return { changes: prevLen - this.tables.media_items.length, lastInsertRowId: 0 };
    }

    if (cleanSql.startsWith('insert into playlists') || cleanSql.startsWith('insert or replace into playlists')) {
      const [id, name, createdAt, updatedAt] = params;
      this.tables.playlists.push({ id, name, created_at: createdAt, updated_at: updatedAt });
      return { changes: 1, lastInsertRowId: 1 };
    }

    if (cleanSql.startsWith('delete from playlists where id =')) {
      const id = params[0];
      this.tables.playlists = this.tables.playlists.filter((p) => p.id !== id);
      return { changes: 1, lastInsertRowId: 0 };
    }

    if (cleanSql.startsWith('insert into playlist_items') || cleanSql.startsWith('insert or replace into playlist_items')) {
      const [id, playlist_id, media_item_id, position] = params;
      this.tables.playlist_items.push({ id, playlist_id, media_item_id, position });
      return { changes: 1, lastInsertRowId: 1 };
    }

    if (cleanSql.startsWith('delete from playlist_items where playlist_id =')) {
      const playlist_id = params[0];
      this.tables.playlist_items = this.tables.playlist_items.filter((i) => i.playlist_id !== playlist_id);
      return { changes: 1, lastInsertRowId: 0 };
    }

    if (cleanSql.startsWith('insert or replace into app_settings')) {
      const [key, value, updatedAt] = params;
      const existing = this.tables.app_settings.find((s) => s.key === key);
      if (existing) {
        existing.value = value;
        existing.updated_at = updatedAt;
      } else {
        this.tables.app_settings.push({ key, value, updated_at: updatedAt });
      }
      return { changes: 1, lastInsertRowId: 1 };
    }

    return { changes: 0, lastInsertRowId: 0 };
  }

  clearAll(): void {
    Object.keys(this.tables).forEach((k) => (this.tables[k] = []));
  }
}

export async function getDatabase(): Promise<IDatabaseConnection> {
  if (dbInstance) return dbInstance;

  try {
    const SQLite = require('expo-sqlite');
    if (SQLite && SQLite.openDatabaseAsync) {
      const nativeDb = await SQLite.openDatabaseAsync('novaplayer.db');
      await nativeDb.execAsync(CREATE_TABLES_SQL);
      dbInstance = nativeDb;
      return nativeDb;
    }
  } catch (e) {
    // Falling back to memory database for node/testing environments
  }

  const memoryDb = new MemoryDatabaseConnection();
  await memoryDb.execAsync(CREATE_TABLES_SQL);
  dbInstance = memoryDb;
  return dbInstance;
}

export function setCustomDatabase(db: IDatabaseConnection): void {
  dbInstance = db;
}
