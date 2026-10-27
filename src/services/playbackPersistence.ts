import { updatePlaybackPosition } from './database/mediaRepository';
import { throttle } from '../utils/edgeCaseHandlers';

class PlaybackPersistenceManager {
  private currentMediaId: string | null = null;
  private lastSavedPositionMs: number = 0;

  // Throttled database writer (at most once every 2500ms)
  private throttledSave = throttle(async (mediaId: string, positionMs: number) => {
    try {
      await updatePlaybackPosition(mediaId, positionMs);
      this.lastSavedPositionMs = positionMs;
    } catch (err) {
      console.warn('Failed to save playback progress:', err);
    }
  }, 2500);

  setActiveMedia(mediaId: string | null): void {
    // Flush any pending progress before changing media
    if (this.currentMediaId && this.lastSavedPositionMs > 0) {
      this.saveImmediate(this.currentMediaId, this.lastSavedPositionMs);
    }
    this.currentMediaId = mediaId;
    this.lastSavedPositionMs = 0;
  }

  recordProgress(mediaId: string, positionMs: number): void {
    if (this.currentMediaId !== mediaId) {
      this.currentMediaId = mediaId;
    }
    this.lastSavedPositionMs = positionMs;
    this.throttledSave(mediaId, positionMs);
  }

  async saveImmediate(mediaId: string, positionMs: number): Promise<void> {
    try {
      await updatePlaybackPosition(mediaId, positionMs);
      this.lastSavedPositionMs = positionMs;
    } catch (err) {
      console.warn('Failed immediate playback progress save:', err);
    }
  }

  flush(): void {
    if (this.currentMediaId && this.lastSavedPositionMs > 0) {
      this.saveImmediate(this.currentMediaId, this.lastSavedPositionMs);
    }
  }
}

export const playbackPersistence = new PlaybackPersistenceManager();
