export type SourceType =
  | 'android_mediastore'
  | 'android_saf'
  | 'ios_photos'
  | 'ios_document'
  | 'local_file'
  | 'network_stream';

export type AvailabilityStatus = 'available' | 'missing' | 'cloud_only' | 'permission_denied';

export type ThumbnailStatus = 'ready' | 'generating' | 'failed' | 'none';

export interface MediaItem {
  id: string;
  sourceType: SourceType;
  sourceReference: string;
  displayName: string;
  durationMs: number | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  container: string | null;
  dateAdded: number | null;
  lastSeenAt: number;
  availabilityStatus: AvailabilityStatus;
  thumbnailStatus: ThumbnailStatus;
  thumbnailUri: string | null;
  lastPositionMs: number;
  lastPlayedAt: number | null;
  isFavorite: boolean;
  folderName: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlaybackPreferences {
  mediaItemId?: string;
  playbackRate: number;
  audioTrackPreference?: string | null;
  subtitlePreference?: string | null;
  subtitleDelayMs: number;
  audioDelayMs: number;
  aspectRatioMode: AspectRatioMode;
  updatedAt: number;
}

export type AspectRatioMode = 'fit' | 'fill' | 'stretch' | '16:9' | '4:3' | 'original';

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  itemCount?: number;
}

export interface PlaylistItem {
  id: string;
  playlistId: string;
  mediaItemId: string;
  position: number;
  mediaItem?: MediaItem;
}

export type ThemePreference = 'dark' | 'light' | 'system';

export interface AppSettings {
  theme: ThemePreference;
  defaultPlaybackRate: number;
  defaultSkipIntervalSeconds: number;
  defaultAspectRatio: AspectRatioMode;
  autoResume: boolean;
  gesturesEnabled: boolean;
  doubleTapSeekEnabled: boolean;
  swipeBrightnessEnabled: boolean;
  swipeVolumeEnabled: boolean;
  backgroundAudioEnabled: boolean;
  pipEnabled: boolean;
  subtitleFontSize: number;
  subtitleTextColor: string;
  subtitleBackgroundColor: string;
  libraryLayout: 'grid' | 'list';
  sortOrder: 'name' | 'date' | 'duration' | 'size';
  sortDirection: 'asc' | 'desc';
}
