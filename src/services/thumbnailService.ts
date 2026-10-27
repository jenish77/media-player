import { Platform } from 'react-native';
import { MediaItem } from '../types/media';
import { updateThumbnail } from './database/mediaRepository';

let ExpoVideo: any = null;
try {
  ExpoVideo = require('expo-video');
} catch (e) {}

export interface ThumbnailResult {
  uri: string | null;
  status: 'ready' | 'failed';
}

// In-memory cache for instant O(1) synchronous hits on scroll
const memoryCache = new Map<string, any>();

// Concurrency limiter so scrolling across items does not exhaust CPU/threads
class ThumbnailQueue {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  private readonly maxConcurrent = 3;

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const res = await task();
          resolve(res);
        } catch (e) {
          reject(e);
        }
      });
      this.processNext();
    });
  }

  private processNext() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }
    this.activeCount++;
    const nextTask = this.queue.shift();
    if (nextTask) {
      nextTask().finally(() => {
        this.activeCount--;
        this.processNext();
      });
    }
  }
}

const queue = new ThumbnailQueue();
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Validates whether a URI represents a standard raster image file or Android media thumbnail.
 */
export function isImageUri(uri?: any): boolean {
  if (!uri) return false;
  if (typeof uri === 'object') return true;
  if (typeof uri !== 'string') return false;
  if (uri.startsWith('ph://')) return false;

  const lower = uri.toLowerCase();
  const clean = lower.split('?')[0];

  // Raw video files cannot be treated as raster images directly
  if (
    clean.endsWith('.mp4') ||
    clean.endsWith('.mov') ||
    clean.endsWith('.mkv') ||
    clean.endsWith('.avi') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.3gp') ||
    clean.endsWith('.flv') ||
    clean.endsWith('.wmv') ||
    clean.endsWith('.ts')
  ) {
    return false;
  }

  return (
    clean.endsWith('.jpg') ||
    clean.endsWith('.jpeg') ||
    clean.endsWith('.png') ||
    clean.endsWith('.webp') ||
    clean.includes('videothumbnails') ||
    clean.includes('thumbnails') ||
    clean.includes('/thumbnail') ||
    clean.startsWith('data:image/')
  );
}

/**
 * Validates whether a URI or object can be rendered as a thumbnail by expo-image.
 * Supports raster images, Android content URIs, and iOS PhotoKit (ph://) video identifiers.
 */
export function isSupportedThumbnailUri(uri?: any): boolean {
  if (!uri) return false;
  if (typeof uri === 'object') return true;
  if (typeof uri !== 'string') return false;
  if (uri.startsWith('ph://')) return true;
  if (uri.includes('/thumbnail')) return true;
  return isImageUri(uri);
}

/**
 * Resolves or extracts a video thumbnail for a given MediaItem.
 * Returns the cached or newly generated image URI / VideoThumbnail object, or null on failure.
 */
export async function getThumbnailForMedia(media: MediaItem): Promise<any> {
  if (!media || !media.id) return null;

  // 1. Check in-memory cache
  if (memoryCache.has(media.id)) {
    const cached = memoryCache.get(media.id);
    if (cached) return cached;
  }

  // 2. Check if media already has a valid thumbnail URI
  if (media.thumbnailUri && isSupportedThumbnailUri(media.thumbnailUri)) {
    memoryCache.set(media.id, media.thumbnailUri);
    return media.thumbnailUri;
  }

  // 3. iOS PhotoKit asset: sourceReference is ph://... which expo-image renders directly via PhotoKit
  if (media.sourceReference && media.sourceReference.startsWith('ph://')) {
    memoryCache.set(media.id, media.sourceReference);
    updateThumbnail(media.id, media.sourceReference, 'ready').catch(() => {});
    return media.sourceReference;
  }

  // 4. Android MediaStore asset: construct thumbnail content URI if numeric ID is present
  if (Platform.OS === 'android' && media.sourceReference) {
    const numericId = media.id?.replace('media_', '');
    if (numericId && !isNaN(Number(numericId))) {
      const androidThumbUri = `content://media/external/video/media/${numericId}/thumbnail`;
      memoryCache.set(media.id, androidThumbUri);
      updateThumbnail(media.id, androidThumbUri, 'ready').catch(() => {});
      return androidThumbUri;
    }
  }

  // 5. Prevent duplicate simultaneous extraction tasks for the same media
  if (inFlightRequests.has(media.id)) {
    return inFlightRequests.get(media.id)!;
  }

  const extractionPromise = queue.add(async () => {
    try {
      const source = media.sourceReference;
      if (!source) return null;

      // Extract frame using modern expo-video player
      if (ExpoVideo && typeof ExpoVideo.createVideoPlayer === 'function') {
        const durationMs = media.durationMs || 5000;
        const durationSec = durationMs > 0 ? durationMs / 1000 : 5;
        // Frame time in SECONDS (within first second or 15% of clip)
        const captureTimeSec = Math.max(0.1, Math.min(1.0, durationSec * 0.15));

        const videoSource =
          typeof source === 'string' && (source.startsWith('content://') || source.startsWith('file://'))
            ? { uri: source }
            : source;

        let player: any = null;
        try {
          player = ExpoVideo.createVideoPlayer(videoSource);
          if (player && typeof player.generateThumbnailsAsync === 'function') {
            const results = await player.generateThumbnailsAsync([captureTimeSec], {
              maxWidth: 360,
              maxHeight: 200,
            });

            if (Array.isArray(results) && results.length > 0) {
              const thumb = results[0];
              if (thumb) {
                let resolvedThumb: any = thumb;
                if (typeof thumb === 'string') {
                  resolvedThumb = thumb;
                  updateThumbnail(media.id, thumb, 'ready').catch(() => {});
                } else if (thumb && typeof thumb.uri === 'string') {
                  resolvedThumb = thumb.uri;
                  updateThumbnail(media.id, thumb.uri, 'ready').catch(() => {});
                } else {
                  resolvedThumb = thumb;
                }
                memoryCache.set(media.id, resolvedThumb);
                return resolvedThumb;
              }
            }
          }
        } catch (playerErr) {
          // Fall through safely to source fallback
        } finally {
          if (player && typeof player.release === 'function') {
            try {
              player.release();
            } catch (_) {}
          }
        }
      }

      // Fallback: On Android, sourceReference itself can be decoded by Glide
      if (Platform.OS === 'android' && source && (source.startsWith('content://') || source.startsWith('file://'))) {
        memoryCache.set(media.id, source);
        return source;
      }

      return null;
    } catch (err) {
      return null;
    } finally {
      inFlightRequests.delete(media.id);
    }
  });

  inFlightRequests.set(media.id, extractionPromise);
  return extractionPromise;
}

/**
 * Pre-generates thumbnails for a slice of items in the background
 */
export function preloadThumbnails(items: MediaItem[], limit = 16): void {
  if (!items || items.length === 0) return;
  const slice = items.slice(0, limit);
  slice.forEach((item) => {
    getThumbnailForMedia(item).catch(() => {});
  });
}
