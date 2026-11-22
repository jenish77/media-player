import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MediaItem, SourceType } from '../../types/media';
import { extractFileName, extractFileExtension, extractFolderName, getContainerFromExtension } from '../../utils/pathUtils';
import { resolveStableUri } from '../../utils/uriResolver';
import { upsertMediaItemsBatch } from '../database/mediaRepository';
import { isSupportedThumbnailUri } from '../thumbnailService';
import { isExpoGo } from '../../utils/environment';

let LegacyMediaLibrary: any = null;
let ModernMediaLibrary: any = null;
let DocumentPicker: any = null;
let FileSystem: any = null;

try {
  LegacyMediaLibrary = require('expo-media-library/legacy');
} catch (e1) {}

try {
  ModernMediaLibrary = require('expo-media-library');
} catch (e2) {}

try {
  DocumentPicker = require('expo-document-picker');
} catch (e3) {}

try {
  FileSystem = require('expo-file-system');
} catch (e4) {}

const SAF_FOLDERS_STORAGE_KEY = 'nova_saf_directories_v1';

export interface ScanResult {
  addedCount: number;
  totalFound: number;
  errors: string[];
}

/**
 * Checks and requests video media library permissions.
 * In Expo Go on Android, expo-media-library intentionally rejects VIDEO/PHOTO
 * granular permissions (only AUDIO is allowed). We detect this and return false
 * gracefully so the UI can offer the file/folder picker instead.
 */
export async function requestMediaPermissions(): Promise<boolean> {
  // In Expo Go on Android, expo-media-library blocks VIDEO permissions internally.
  // Skip the doomed request to avoid noisy error logs and misleading permission dialogs.
  if (isExpoGo && Platform.OS === 'android') {
    console.log('[Permissions] Expo Go detected – skipping MediaLibrary permission request (blocked by Expo Go runtime). Use file/folder picker instead.');
    return false;
  }

  const lib = LegacyMediaLibrary || ModernMediaLibrary;
  if (!lib) return false;

  const isGranted = (p: any) =>
    Boolean(
      p &&
      (p.granted === true ||
        p.status === 'granted' ||
        p.accessPrivileges === 'all' ||
        p.accessPrivileges === 'limited')
    );

  // Strategy 1: Android 13+ granular permission for video
  try {
    if (typeof lib.getPermissionsAsync === 'function') {
      const perm = await lib.getPermissionsAsync(false, ['video']);
      if (isGranted(perm)) return true;

      if (perm?.canAskAgain !== false && typeof lib.requestPermissionsAsync === 'function') {
        const req = await lib.requestPermissionsAsync(false, ['video']);
        if (isGranted(req)) return true;
      }
    }
  } catch (e1) {}

  // Strategy 2: Standard non-granular permission (Android <= 12 or iOS)
  try {
    if (typeof lib.getPermissionsAsync === 'function') {
      const perm = await lib.getPermissionsAsync(false);
      if (isGranted(perm)) return true;

      if (perm?.canAskAgain !== false && typeof lib.requestPermissionsAsync === 'function') {
        const req = await lib.requestPermissionsAsync(false);
        if (isGranted(req)) return true;
      }
    }
  } catch (e2) {}

  // Strategy 3: Modern MediaLibrary next module
  try {
    if (ModernMediaLibrary?.getPermissionsAsync) {
      const perm = await ModernMediaLibrary.getPermissionsAsync(false, ['video']);
      if (isGranted(perm)) return true;
    }
  } catch (e3) {}

  return false;
}

/**
 * Retrieves list of persistent SAF folder URIs saved by the user.
 */
export async function getSavedSafDirectories(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SAF_FOLDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Saves a new SAF folder URI for persistent automatic scanning.
 */
export async function saveSafDirectory(dirUri: string): Promise<void> {
  try {
    const existing = await getSavedSafDirectories();
    if (!existing.includes(dirUri)) {
      existing.push(dirUri);
      await AsyncStorage.setItem(SAF_FOLDERS_STORAGE_KEY, JSON.stringify(existing));
    }
  } catch (e) {
    console.warn('Failed to save SAF directory:', e);
  }
}

/**
 * Scans saved persistent Storage Access Framework (SAF) directories for videos.
 */
export async function scanPersistentSafDirectories(): Promise<any[]> {
  const assets: any[] = [];
  if (Platform.OS !== 'android') return assets;

  try {
    const SAF = FileSystem?.StorageAccessFramework || require('expo-file-system/legacy')?.StorageAccessFramework;
    if (!SAF || typeof SAF.readDirectoryAsync !== 'function') return assets;

    const directories = await getSavedSafDirectories();
    const videoExts = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv', '.ts', '.3gp'];

    for (const dirUri of directories) {
      try {
        const fileUris: string[] = await SAF.readDirectoryAsync(dirUri);
        for (const fileUri of fileUris) {
          const lower = fileUri.toLowerCase();
          const isVideo = videoExts.some((ext) => lower.includes(ext) || lower.endsWith(ext));
          if (!isVideo) continue;

          let filename = decodeURIComponent(fileUri.split('%2F').pop() || fileUri.split('/').pop() || 'video.mp4');
          if (filename.includes(':')) {
            filename = filename.split(':').pop() || filename;
          }

          assets.push({
            id: `saf_${encodeURIComponent(fileUri).slice(-16)}`,
            uri: fileUri,
            filename,
            duration: 0,
            creationTime: Date.now(),
          });
        }
      } catch (dirErr) {
        console.warn(`Failed to read SAF directory ${dirUri}:`, dirErr);
      }
    }
  } catch (err) {
    console.warn('scanPersistentSafDirectories error:', err);
  }

  return assets;
}

/**
 * Scans local device media (Android MediaStore / iOS Photos / SAF Directories) for video assets.
 * Automatically runs on app launch, refresh, and manual scan.
 */
export async function scanDeviceVideos(): Promise<ScanResult> {
  const result: ScanResult = { addedCount: 0, totalFound: 0, errors: [] };
  const lib = LegacyMediaLibrary || ModernMediaLibrary;

  let hasPermission = false;
  try {
    hasPermission = await requestMediaPermissions();
  } catch (e) {
    console.warn('Permission query warning:', e);
  }

  let rawAssets: any[] = [];

  // In Expo Go on Android, MediaLibrary scanning is blocked.
  // Skip directly to SAF folder scanning to avoid error noise.
  if (isExpoGo && Platform.OS === 'android') {
    console.log('[scanDeviceVideos] Expo Go detected – skipping MediaLibrary scan, checking SAF folders only.');
  } else if (lib) {
    // Attempt 1: LegacyMediaLibrary.getAssetsAsync
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
        console.log('LegacyMediaLibrary scan attempt:', legacyErr?.message);
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
            } catch (itemErr) {}
          }
        }
      } catch (queryErr: any) {
        console.log('ModernMediaLibrary.Query scan attempt:', queryErr?.message);
      }
    }

    // Attempt 3: Direct lib.getAssetsAsync fallback
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
        console.log('Direct getAssetsAsync scan attempt:', directErr?.message);
      }
    }
  }

  // Also scan persistent SAF folders
  try {
    const safAssets = await scanPersistentSafDirectories();
    if (safAssets.length > 0) {
      rawAssets.push(...safAssets);
    }
  } catch (safErr) {}

  // If no assets were found and permission was not granted
  if (rawAssets.length === 0 && !hasPermission) {
    if (isExpoGo && Platform.OS === 'android') {
      result.errors.push(
        'Automated gallery scanning is restricted in the Expo Go client.\nTap the Folder icon (top right) to select a video folder to auto-scan or pick video files directly.'
      );
    } else {
      result.errors.push(
        'Media permission was not granted. Please allow Video permissions in Android Settings.'
      );
    }
    return result;
  }

  const now = Date.now();
  const mediaItems: MediaItem[] = [];

  for (const asset of rawAssets) {
    if (!asset.uri) continue;
    const filename = asset.filename || extractFileName(asset.uri);
    const ext = extractFileExtension(filename);
    const container = getContainerFromExtension(ext);
    const sourceType: SourceType = Platform.OS === 'android' ? 'android_mediastore' : 'ios_photos';

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
      sourceReference: resolveStableUri(asset.uri),
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

  return result;
}

/**
 * Prompts user to select a folder via Storage Access Framework (SAF) and saves it
 * for automatic scanning across app restarts.
 */
export async function pickFolderFromDirectoryPicker(): Promise<ScanResult> {
  const result: ScanResult = { addedCount: 0, totalFound: 0, errors: [] };
  if (Platform.OS !== 'android') return result;

  try {
    const SAF = FileSystem?.StorageAccessFramework || require('expo-file-system/legacy')?.StorageAccessFramework;
    if (!SAF || typeof SAF.requestDirectoryPermissionsAsync !== 'function') {
      result.errors.push('Storage Access Framework is not available on this device');
      return result;
    }

    const perm = await SAF.requestDirectoryPermissionsAsync();
    if (!perm.granted || !perm.directoryUri) {
      return result;
    }

    await saveSafDirectory(perm.directoryUri);
    return await scanDeviceVideos();
  } catch (err: any) {
    result.errors.push(err?.message || 'Failed to select folder');
    return result;
  }
}

/**
 * Opens system document picker to select external video file(s).
 */
export async function pickVideoFromDocumentPicker(): Promise<MediaItem | null> {
  if (!DocumentPicker) {
    throw new Error('DocumentPicker is not available');
  }

  const res = await DocumentPicker.getDocumentAsync({
    type: ['video/*', 'application/x-matroska', 'video/mp4', 'video/mkv', 'video/webm'],
    copyToCacheDirectory: true,
    multiple: true,
  });

  if (res.canceled || !res.assets || res.assets.length === 0) {
    return null;
  }

  const now = Date.now();
  const itemsToAdd: MediaItem[] = [];

  for (const asset of res.assets) {
    if (!asset.uri) continue;
    const filename = asset.name || extractFileName(asset.uri);
    const ext = extractFileExtension(filename);
    const sourceType: SourceType = Platform.OS === 'android' ? 'android_saf' : 'ios_document';

    let resolvedUri = asset.uri;
    // In Expo Go on Android, guarantee a direct file:// cache URI for ExoPlayer
    if (isExpoGo && Platform.OS === 'android' && !resolvedUri.startsWith('file://')) {
      try {
        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const dest = `${FileSystem?.cacheDirectory || ''}${Date.now()}_${safeName}`;
        if (FileSystem?.copyAsync) {
          await FileSystem.copyAsync({ from: resolvedUri, to: dest });
          resolvedUri = dest;
        }
      } catch (cacheErr) {
        console.warn('[pickVideoFromDocumentPicker] Cache copy warning:', cacheErr);
      }
    }

    itemsToAdd.push({
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sourceType,
      sourceReference: resolvedUri,
      displayName: filename,
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
      folderName: 'Imported Videos',
      createdAt: now,
      updatedAt: now,
    });
  }

  if (itemsToAdd.length > 0) {
    await upsertMediaItemsBatch(itemsToAdd);
    return itemsToAdd[0];
  }

  return null;
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
