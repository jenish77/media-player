import { Platform } from 'react-native';
import { MediaItem, SourceType } from '../../types/media';
import { extractFileName, extractFileExtension, extractFolderName, getContainerFromExtension } from '../../utils/pathUtils';
import { upsertMediaItemsBatch, upsertMediaItem } from '../database/mediaRepository';
import { isImageUri, isSupportedThumbnailUri } from '../thumbnailService';

let LegacyMediaLibrary: any = null;
let ModernMediaLibrary: any = null;
let DocumentPicker: any = null;

try {
  LegacyMediaLibrary = require('expo-media-library/legacy');
} catch (e1) {
  try {
    LegacyMediaLibrary = require('expo-media-library/build/legacy/MediaLibrary');
  } catch (e2) {}
}

try {
  ModernMediaLibrary = require('expo-media-library');
} catch (e3) {}

try {
  DocumentPicker = require('expo-document-picker');
} catch (e4) {}

export interface ScanResult {
  addedCount: number;
  totalFound: number;
  errors: string[];
}

/**
 * Checks and requests video media library permissions.
 */
export async function requestMediaPermissions(): Promise<boolean> {
  const lib = LegacyMediaLibrary || ModernMediaLibrary;
  if (!lib) return false;

  const isGranted = (p: any) =>
    !!p &&
    (p.granted === true ||
      p.status === 'granted' ||
      p.accessPrivileges === 'all' ||
      p.accessPrivileges === 'limited');

  try {
    let perm: any = null;
    if (typeof lib.getPermissionsAsync === 'function') {
      try {
        perm = await lib.getPermissionsAsync(false, ['video']);
      } catch {
        perm = await lib.getPermissionsAsync();
      }
    }

    if (isGranted(perm)) {
      return true;
    }

    if (perm?.canAskAgain !== false && typeof lib.requestPermissionsAsync === 'function') {
      let req: any = null;
      try {
        req = await lib.requestPermissionsAsync(false, ['video']);
      } catch {
        req = await lib.requestPermissionsAsync();
      }
      return isGranted(req);
    }

    return false;
  } catch (err) {
    console.warn('Failed to check media permissions:', err);
    return false;
  }
}

/**
 * Scans local device media (Android MediaStore / iOS Photos) for video assets.
 */
export async function scanDeviceVideos(): Promise<ScanResult> {
  const result: ScanResult = { addedCount: 0, totalFound: 0, errors: [] };

  const lib = LegacyMediaLibrary || ModernMediaLibrary;
  if (!lib) {
    result.errors.push('MediaLibrary native module unavailable');
    return result;
  }

  const hasPermission = await requestMediaPermissions();
  if (!hasPermission) {
    result.errors.push('Media permission was denied. Please grant Video/Media permissions to Nova Player');
    return result;
  }

  try {
    let rawAssets: any[] = [];

    // Attempt 1: LegacyMediaLibrary.getAssetsAsync (Expo SDK legacy package)
    if (LegacyMediaLibrary && typeof LegacyMediaLibrary.getAssetsAsync === 'function') {
      try {
        const legacyRes = await LegacyMediaLibrary.getAssetsAsync({
          mediaType: ['video'],
          first: 2000,
          sortBy: LegacyMediaLibrary.SortBy?.creationTime
            ? [[LegacyMediaLibrary.SortBy.creationTime, false]]
            : undefined,
        });
        if (legacyRes && Array.isArray(legacyRes.assets) && legacyRes.assets.length > 0) {
          rawAssets = legacyRes.assets;
        }
      } catch (legacyErr: any) {
        console.warn('LegacyMediaLibrary.getAssetsAsync failed, trying Query API:', legacyErr?.message);
      }
    }

    // Attempt 2: ModernMediaLibrary.Query API (Expo SDK 58 next)
    if (rawAssets.length === 0 && ModernMediaLibrary?.Query) {
      try {
        const query = new ModernMediaLibrary.Query();
        const mediaTypeField = ModernMediaLibrary.AssetField?.MEDIA_TYPE || 'mediaType';
        const videoType = ModernMediaLibrary.MediaType?.VIDEO ?? 'video';

        const queryResults = await query
          .eq(mediaTypeField, videoType)
          .limit(2000)
          .exe();

        if (Array.isArray(queryResults)) {
          for (const item of queryResults) {
            try {
              const uri = typeof item.getUri === 'function' ? await item.getUri() : item.uri;
              if (!uri) continue;
              const filename =
                typeof item.getFilename === 'function'
                  ? await item.getFilename()
                  : item.filename || extractFileName(uri);
              const duration =
                typeof item.getDuration === 'function' ? await item.getDuration() : item.duration;
              const width = typeof item.getWidth === 'function' ? await item.getWidth() : item.width;
              const height = typeof item.getHeight === 'function' ? await item.getHeight() : item.height;
              const creationTime =
                typeof item.getCreationTime === 'function'
                  ? await item.getCreationTime()
                  : item.creationTime;

              rawAssets.push({
                id: item.id,
                uri,
                filename,
                duration,
                width,
                height,
                creationTime,
              });
            } catch (itemErr) {
              console.warn('Failed to parse query asset:', itemErr);
            }
          }
        }
      } catch (queryErr: any) {
        console.warn('ModernMediaLibrary.Query failed:', queryErr?.message);
      }
    }

    // Attempt 3: Direct lib.getAssetsAsync fallback (for Jest mocks and standard environments)
    if (rawAssets.length === 0 && typeof lib.getAssetsAsync === 'function') {
      try {
        const fallbackRes = await lib.getAssetsAsync({
          mediaType: ['video'],
          first: 2000,
        });
        if (fallbackRes && Array.isArray(fallbackRes.assets)) {
          rawAssets = fallbackRes.assets;
        }
      } catch (directErr: any) {
        console.warn('Direct getAssetsAsync failed:', directErr?.message);
      }
    }

    const now = Date.now();
    const mediaItems: MediaItem[] = [];

    for (const asset of rawAssets) {
      if (!asset.uri) continue;
      const filename = asset.filename || extractFileName(asset.uri);
      const ext = extractFileExtension(filename);
      const container = getContainerFromExtension(ext);
      const sourceType: SourceType = Platform.OS === 'android' ? 'android_mediastore' : 'ios_photos';

      // Set thumbnailUri:
      // 1. Explicit asset.thumbnailUri if valid
      // 2. iOS PhotoKit: ph://... (expo-image renders directly)
      // 3. Android MediaStore: content://media/external/video/media/{id}/thumbnail or asset.uri
      let safeThumbnailUri: string | null = null;
      if (asset.thumbnailUri && isSupportedThumbnailUri(asset.thumbnailUri)) {
        safeThumbnailUri = asset.thumbnailUri;
      } else if (asset.uri && asset.uri.startsWith('ph://')) {
        safeThumbnailUri = asset.uri;
      } else if (Platform.OS === 'android') {
        if (asset.id && !isNaN(Number(asset.id))) {
          safeThumbnailUri = `content://media/external/video/media/${asset.id}/thumbnail`;
        } else if (asset.uri && (asset.uri.startsWith('content://') || asset.uri.startsWith('file://'))) {
          safeThumbnailUri = asset.uri;
        }
      }

      mediaItems.push({
        id: `media_${asset.id || Math.random().toString(36).substring(2, 9)}`,
        sourceType,
        sourceReference: asset.uri,
        displayName: filename,
        durationMs: asset.duration ? Math.round(asset.duration * 1000) : null,
        sizeBytes: null,
        width: asset.width || null,
        height: asset.height || null,
        mimeType: ext ? `video/${ext}` : 'video/*',
        container,
        dateAdded: asset.creationTime ? asset.creationTime * (asset.creationTime < 1e11 ? 1000 : 1) : now,
        lastSeenAt: now,
        availabilityStatus: 'available',
        thumbnailStatus: safeThumbnailUri ? 'ready' : 'none',
        thumbnailUri: safeThumbnailUri,
        lastPositionMs: 0,
        lastPlayedAt: null,
        isFavorite: false,
        folderName: extractFolderName(asset.uri),
        createdAt: now,
        updatedAt: now,
      });
    }

    if (mediaItems.length > 0) {
      await upsertMediaItemsBatch(mediaItems);
      result.addedCount = mediaItems.length;
      result.totalFound = mediaItems.length;
    }
  } catch (err: any) {
    result.errors.push(err?.message || 'Error occurred while scanning device videos');
  }

  return result;
}

/**
 * Opens system document picker to select an external video or subtitle file.
 */
export async function pickVideoFromDocumentPicker(): Promise<MediaItem | null> {
  if (!DocumentPicker) {
    throw new Error('DocumentPicker is not available');
  }

  const res = await DocumentPicker.getDocumentAsync({
    type: ['video/*', 'application/x-matroska', 'video/mp4', 'video/mkv', 'video/webm'],
    copyToCacheDirectory: false,
  });

  if (res.canceled || !res.assets || res.assets.length === 0) {
    return null;
  }

  const asset = res.assets[0];
  const now = Date.now();
  const ext = extractFileExtension(asset.name);
  const sourceType: SourceType = Platform.OS === 'android' ? 'android_saf' : 'ios_document';

  const mediaItem: MediaItem = {
    id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    sourceType,
    sourceReference: asset.uri,
    displayName: asset.name,
    durationMs: null,
    sizeBytes: asset.size || null,
    width: null,
    height: null,
    mimeType: asset.mimeType || (ext ? `video/${ext}` : 'video/*'),
    container: getContainerFromExtension(ext),
    dateAdded: now,
    lastSeenAt: now,
    availabilityStatus: 'available',
    thumbnailStatus: 'none',
    thumbnailUri: null,
    lastPositionMs: 0,
    lastPlayedAt: null,
    isFavorite: false,
    folderName: 'Selected Documents',
    createdAt: now,
    updatedAt: now,
  };

  await upsertMediaItem(mediaItem);
  return mediaItem;
}

/**
 * Opens system document picker to select an external subtitle file (.srt, .vtt, .ass).
 */
export async function pickSubtitleFile(): Promise<{ uri: string; name: string } | null> {
  if (!DocumentPicker) {
    throw new Error('DocumentPicker is not available');
  }

  const res = await DocumentPicker.getDocumentAsync({
    type: ['text/plain', 'text/vtt', 'application/x-subrip', '*/*'],
    copyToCacheDirectory: true,
  });

  if (res.canceled || !res.assets || res.assets.length === 0) {
    return null;
  }

  const asset = res.assets[0];
  return {
    uri: asset.uri,
    name: asset.name,
  };
}
