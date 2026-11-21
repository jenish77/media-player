import { Platform } from 'react-native';
import { isExpoGo } from './environment';

let FileSystem: any = null;
try {
  FileSystem = require('expo-file-system');
} catch (e) {}

/**
 * Resolves a content URI to a stable, readable form for Android.
 *
 * In standalone production APKs: Document provider URIs
 * (content://com.android.providers.media.documents/document/video%3A<id>)
 * have ephemeral permissions that expire on process restart. Converting to
 * MediaStore URIs (content://media/external/video/media/<id>) allows long-term
 * access with READ_MEDIA_VIDEO permission.
 *
 * In Expo Go: Document provider URIs MUST NOT be converted to MediaStore URIs,
 * because Expo Go does not have READ_MEDIA_VIDEO in its manifest. SAF permissions
 * are granted only to the specific document URI.
 */
export function resolveStableUri(uri: string): string {
  if (Platform.OS !== 'android') return uri;
  if (!uri) return uri;

  // In Expo Go, never rewrite SAF / DocumentPicker URIs to MediaStore URIs
  if (isExpoGo) {
    return uri;
  }

  // Pattern: content://com.android.providers.media.documents/document/video%3A<numericId>
  // or:      content://com.android.providers.media.documents/document/video:<numericId>
  const docProviderPattern =
    /^content:\/\/com\.android\.providers\.media\.documents\/document\/video(?:%3A|:)(\d+)/i;
  const match = uri.match(docProviderPattern);

  if (match && match[1]) {
    const mediaId = match[1];
    return `content://media/external/video/media/${mediaId}`;
  }

  return uri;
}

/**
 * Checks if the given URI is a document-provider URI that may lose permissions on app restart.
 */
export function isEphemeralDocumentUri(uri: string): boolean {
  if (Platform.OS !== 'android') return false;
  if (!uri) return false;
  return uri.startsWith('content://com.android.providers.media.documents/');
}

/**
 * Extracts the numeric MediaStore ID from a content://media/external/video/media/<id> URI.
 * Returns null if the URI doesn't match.
 */
export function extractMediaStoreId(uri: string): string | null {
  if (!uri) return null;
  const match = uri.match(/^content:\/\/media\/external\/video\/media\/(\d+)/);
  return match ? match[1] : null;
}

let LegacyMediaLibrary: any = null;
let ModernMediaLibrary: any = null;

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

function toFileUri(pathOrUri?: string | null): string | null {
  if (!pathOrUri || typeof pathOrUri !== 'string') return null;
  if (pathOrUri.startsWith('file://')) return pathOrUri;
  if (pathOrUri.startsWith('/')) return `file://${pathOrUri}`;
  return null;
}

/**
 * Resolves a content:// URI to a local file:// URI.
 *
 * In Expo Go on Android:
 * ExoPlayer running inside host.exp.exponent cannot read raw content://media/external/...
 * URIs without READ_MEDIA_VIDEO permission. For DocumentPicker content:// URIs,
 * copying to cache directory provides a persistent file:// URI that ExoPlayer can play.
 *
 * In Standalone APK:
 * Resolves via MediaLibrary getAssetInfoAsync or returns the persistent content URI.
 */
export async function resolvePlayableUri(uri: string): Promise<string> {
  if (!uri) return uri;
  if (Platform.OS !== 'android') return uri;

  // file:// URIs are already directly playable by ExoPlayer
  if (uri.startsWith('file://')) return uri;

  // --- EXPO GO SPECIFIC RESOLUTION ---
  if (isExpoGo) {
    // If it's a content URI, try caching it locally to produce a file:// URI
    if (uri.startsWith('content://') && FileSystem?.cacheDirectory) {
      try {
        const dest = `${FileSystem.cacheDirectory}play_${Date.now()}.mp4`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        console.log('[resolvePlayableUri] Cached content URI to file in Expo Go:', dest);
        return dest;
      } catch (cacheErr: any) {
        console.warn('[resolvePlayableUri] Failed to cache content URI in Expo Go:', cacheErr?.message);
        if (uri.startsWith('content://media/external/')) {
          throw new Error(
            'Expo Go cannot stream videos directly from the Android MediaStore gallery due to Android 13+ sandboxing.\n\nPlease tap "Open Video" to select and play this video using the system file picker.'
          );
        }
      }
    }
    return uri;
  }

  // --- STANDALONE / PRODUCTION BUILD RESOLUTION ---
  const stableUri = resolveStableUri(uri);
  const mediaId = extractMediaStoreId(stableUri);

  // 1. Try legacy MediaLibrary API
  if (LegacyMediaLibrary && typeof LegacyMediaLibrary.getAssetInfoAsync === 'function') {
    if (mediaId) {
      try {
        const assetInfo = await LegacyMediaLibrary.getAssetInfoAsync(mediaId, {
          shouldDownloadFromNetwork: false,
        });
        const fileUri = toFileUri(assetInfo?.uri) || toFileUri(assetInfo?.localUri);
        if (fileUri) {
          console.log('[resolvePlayableUri] Resolved via LegacyMediaLibrary by mediaId:', fileUri);
          return fileUri;
        }
      } catch (err) {}
    }

    try {
      const assetInfo = await LegacyMediaLibrary.getAssetInfoAsync(stableUri, {
        shouldDownloadFromNetwork: false,
      });
      const fileUri = toFileUri(assetInfo?.uri) || toFileUri(assetInfo?.localUri);
      if (fileUri) {
        console.log('[resolvePlayableUri] Resolved via LegacyMediaLibrary by stableUri:', fileUri);
        return fileUri;
      }
    } catch (err) {}
  }

  // 2. Try modern MediaLibrary class API (Expo SDK 58 next)
  if (ModernMediaLibrary?.Asset) {
    try {
      const target = mediaId || stableUri;
      const assetInstance = new ModernMediaLibrary.Asset(target);
      if (typeof assetInstance.getUri === 'function') {
        const directUri = await assetInstance.getUri();
        const fileUri = toFileUri(directUri);
        if (fileUri) {
          console.log('[resolvePlayableUri] Resolved via ModernMediaLibrary getUri:', fileUri);
          return fileUri;
        }
      }
      if (typeof assetInstance.getInfo === 'function') {
        const info = await assetInstance.getInfo();
        const fileUri = toFileUri(info?.uri) || toFileUri(info?.localUri);
        if (fileUri) {
          console.log('[resolvePlayableUri] Resolved via ModernMediaLibrary getInfo:', fileUri);
          return fileUri;
        }
      }
    } catch (modernErr) {}
  }

  // Fallback: return the stable URI for Android native ContentResolver in standalone builds
  return stableUri;
}
