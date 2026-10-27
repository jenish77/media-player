export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS media_items (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_reference TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  duration_ms INTEGER,
  size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  mime_type TEXT,
  container TEXT,
  date_added INTEGER,
  last_seen_at INTEGER NOT NULL,
  availability_status TEXT NOT NULL DEFAULT 'available',
  thumbnail_status TEXT NOT NULL DEFAULT 'none',
  thumbnail_uri TEXT,
  last_position_ms INTEGER NOT NULL DEFAULT 0,
  last_played_at INTEGER,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  folder_name TEXT NOT NULL DEFAULT 'Videos',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_last_played ON media_items(last_played_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_is_favorite ON media_items(is_favorite);
CREATE INDEX IF NOT EXISTS idx_media_folder ON media_items(folder_name);
CREATE INDEX IF NOT EXISTS idx_media_availability ON media_items(availability_status);

CREATE TABLE IF NOT EXISTS playback_preferences (
  media_item_id TEXT PRIMARY KEY,
  playback_rate REAL NOT NULL DEFAULT 1.0,
  audio_track_preference TEXT,
  subtitle_preference TEXT,
  subtitle_delay_ms INTEGER NOT NULL DEFAULT 0,
  audio_delay_ms INTEGER NOT NULL DEFAULT 0,
  aspect_ratio_mode TEXT NOT NULL DEFAULT 'fit',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_items (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL,
  media_item_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (media_item_id) REFERENCES media_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_playlist_items_pos ON playlist_items(playlist_id, position);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;
