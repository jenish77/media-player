import { Platform } from 'react-native';
import { MediaItem } from '../types/media';
import { updateMediaDuration } from './database/mediaRepository';

let ExpoVideo: any = null;
try {
  ExpoVideo = require('expo-video');
} catch (e) {}

let LegacyMediaLibrary: any = null;
try {
  LegacyMediaLibrary = require('expo-media-library/legacy');
} catch (e) {}

// In-memory cache for fast O(1) synchronous hits
const durationCache = new Map<string, number>();
const inFlightRequests = new Map<string, Promise<number | null>>();

// Lightweight queue to prevent overwhelming device decoder when checking multiple videos
class MetadataQueue {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  private readonly maxConcurrent = 1;

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

const metadataQueue = new MetadataQueue();

/**
 * Resolves video duration (in milliseconds) for a given MediaItem.
 * Uses Android MediaStore metadata first, falling back to ExpoVideo player probe.
 */
export async function resolveMediaDuration(media: MediaItem): Promise<number | null> {
  if (!media || !media.id) return null;

  // 1. If media item already has duration > 0, cache and return
  if (media.durationMs && media.durationMs > 0) {
    durationCache.set(media.id, media.durationMs);
    return media.durationMs;
  }

  // 2. Check in-memory cache
  if (durationCache.has(media.id)) {
    const cached = durationCache.get(media.id);
    if (cached && cached > 0) return cached;
  }

  // 3. Deduplicate simultaneous in-flight requests
  if (inFlightRequests.has(media.id)) {
    return inFlightRequests.get(media.id)!;
  }

  const promise = metadataQueue.add(async (): Promise<number | null> => {
    // Strategy A: Android MediaStore query via getAssetInfoAsync if numeric ID is present
    if (Platform.OS === 'android' && media.id) {
      const numericId = media.id.replace('media_', '');
      if (numericId && !isNaN(Number(numericId)) && LegacyMediaLibrary?.getAssetInfoAsync) {
        try {
          const info = await LegacyMediaLibrary.getAssetInfoAsync(numericId);
          if (info && typeof info.duration === 'number' && info.duration > 0) {
            const durationMs = Math.round(info.duration * 1000);
            durationCache.set(media.id, durationMs);
            media.durationMs = durationMs;
            await updateMediaDuration(media.id, durationMs);
            return durationMs;
          }
        } catch (e) {
          // Fall through to player probe
        }
      }
    }

    // Strategy B: ExpoVideo player source probe (works on all Android files, SAF URIs, file URIs, content URIs)
    if (ExpoVideo && typeof ExpoVideo.createVideoPlayer === 'function' && media.sourceReference) {
      let player: any = null;
      try {
        const source = media.sourceReference;
        const videoSource =
          typeof source === 'string' && (source.startsWith('content://') || source.startsWith('file://'))
            ? { uri: source }
            : source;

        player = ExpoVideo.createVideoPlayer(videoSource);
        if (player) {
          // If duration is already immediately available on creation
          if (typeof player.duration === 'number' && player.duration > 0) {
            const durationMs = Math.round(player.duration * 1000);
            durationCache.set(media.id, durationMs);
            media.durationMs = durationMs;
            await updateMediaDuration(media.id, durationMs);
            return durationMs;
          }

          // Otherwise await duration with timeout
          const durationPromise = new Promise<number | null>((resolve) => {
            let resolved = false;
            let sub: any = null;
            let timeoutTimer: any = null;
            let pollInterval: any = null;

            const cleanup = () => {
              if (resolved) return;
              resolved = true;
              if (sub) {
                try { sub.remove(); } catch (_) {}
              }
              if (timeoutTimer) clearTimeout(timeoutTimer);
              if (pollInterval) clearInterval(pollInterval);
            };

            if (typeof player.addListener === 'function') {
              try {
                sub = player.addListener('sourceLoad', (payload: any) => {
                  const dur = payload?.duration || player.duration;
                  if (typeof dur === 'number' && dur > 0) {
                    cleanup();
                    resolve(Math.round(dur * 1000));
                  }
                });
              } catch (_) {}
            }

            pollInterval = setInterval(() => {
              if (typeof player.duration === 'number' && player.duration > 0) {
                const dur = player.duration;
                cleanup();
                resolve(Math.round(dur * 1000));
              }
            }, 100);

            timeoutTimer = setTimeout(() => {
              const finalDur =
                typeof player.duration === 'number' && player.duration > 0
                  ? Math.round(player.duration * 1000)
                  : null;
              cleanup();
              resolve(finalDur);
            }, 1200);
          });

          const resolvedMs = await durationPromise;
          if (resolvedMs && resolvedMs > 0) {
            durationCache.set(media.id, resolvedMs);
            media.durationMs = resolvedMs;
            await updateMediaDuration(media.id, resolvedMs);
            return resolvedMs;
          }
        }
      } catch (err) {
        // Probe failed
      } finally {
        if (player && typeof player.release === 'function') {
          try { player.release(); } catch (_) {}
        }
      }
    }

    return null;
  });

  inFlightRequests.set(media.id, promise);
  try {
    return await promise;
  } finally {
    inFlightRequests.delete(media.id);
  }
}

/**
 * Preloads durations in background queue for items that have missing/zero duration.
 */
export function preloadDurations(items: MediaItem[], limit: number = 24): void {
  const missing = items.filter((item) => !item.durationMs || item.durationMs <= 0).slice(0, limit);
  missing.forEach((item) => {
    resolveMediaDuration(item).catch(() => {});
  });
}
