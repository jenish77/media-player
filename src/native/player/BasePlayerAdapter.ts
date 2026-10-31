import {
  PlayerState,
  PlaybackOptions,
  PlaybackProgress,
  SubtitleStyle,
  PlayerEventType,
  PlayerEventMap,
} from '../../types/player';
import { AspectRatioMode } from '../../types/media';
import { IPlayerAdapter } from './playerTypes';
import { PlayerCapabilities, getDefaultCapabilities } from './capabilities';
import { clamp } from '../../utils/edgeCaseHandlers';

export abstract class BasePlayerAdapter implements IPlayerAdapter {
  protected state: PlayerState = 'idle';
  protected progress: PlaybackProgress = {
    currentTimeMs: 0,
    durationMs: 0,
    bufferedPositionMs: 0,
  };
  protected currentSource: string | null = null;
  protected sessionToken: number = 0;
  protected capabilities: PlayerCapabilities = getDefaultCapabilities();
  protected aspectRatio: AspectRatioMode = 'fit';
  protected playbackRate: number = 1.0;
  protected volume: number = 1.0;
  protected subtitleDelayMs: number = 0;
  protected audioDelayMs: number = 0;

  private listeners: {
    [K in PlayerEventType]?: Set<(data: any) => void>;
  } = {};

  getState(): PlayerState {
    return this.state;
  }

  getProgress(): PlaybackProgress {
    return { ...this.progress };
  }

  getCapabilities(): PlayerCapabilities {
    return { ...this.capabilities };
  }

  getCurrentSource(): string | null {
    return this.currentSource;
  }

  getSessionToken(): number {
    return this.sessionToken;
  }

  isPlaying(): boolean {
    return this.state === 'playing';
  }

  setScrubbing(_isScrubbing: boolean): void {}

  protected setState(newState: PlayerState): void {
    if (this.state === newState) return;
    const previousState = this.state;
    this.state = newState;
    this.emit('stateChange', { previousState, currentState: newState });
  }

  protected updateProgress(currentTimeMs: number, durationMs: number, bufferedMs?: number): void {
    const safeDuration = Math.max(0, durationMs || 0);
    const safeCurrent = safeDuration > 0 ? clamp(currentTimeMs, 0, safeDuration) : Math.max(0, currentTimeMs);
    const safeBuffered = Math.max(safeCurrent, bufferedMs || safeCurrent);

    // Filter redundant sub-60ms updates when duration and buffer have not changed noticeably
    if (
      Math.abs(safeCurrent - this.progress.currentTimeMs) < 60 &&
      safeDuration === this.progress.durationMs &&
      Math.abs(safeBuffered - this.progress.bufferedPositionMs) < 100
    ) {
      return;
    }

    this.progress = {
      currentTimeMs: safeCurrent,
      durationMs: safeDuration,
      bufferedPositionMs: safeBuffered,
    };

    this.emit('progress', this.progress);
  }

  addListener<K extends PlayerEventType>(
    event: K,
    listener: (data: PlayerEventMap[K]) => void
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event]!.add(listener);

    return () => {
      this.listeners[event]?.delete(listener);
    };
  }

  protected emit<K extends PlayerEventType>(event: K, data: PlayerEventMap[K]): void {
    const eventListeners = this.listeners[event];
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (err) {
          console.error(`Error in player listener for ${event}:`, err);
        }
      });
    }
  }

  protected nextSessionToken(): number {
    this.sessionToken += 1;
    return this.sessionToken;
  }

  abstract load(source: string, options?: PlaybackOptions): Promise<void>;
  abstract play(): Promise<void>;
  abstract pause(): Promise<void>;
  abstract togglePlayback(): Promise<void>;
  abstract seekTo(positionMs: number, resumeIfPlaying?: boolean): Promise<void>;
  abstract seekBy(seconds: number, resumeIfPlaying?: boolean): Promise<void>;
  abstract setRate(rate: number): Promise<void>;
  abstract setVolume(volume: number): Promise<void>;
  abstract setAudioTrack(trackId: string): Promise<void>;
  abstract setSubtitleTrack(trackId: string | null): Promise<void>;
  abstract loadExternalSubtitle(uri: string): Promise<void>;
  abstract setSubtitleStyle(style: SubtitleStyle): Promise<void>;
  abstract setSubtitleDelay(milliseconds: number): Promise<void>;
  abstract setAudioDelay(milliseconds: number): Promise<void>;
  abstract setAspectRatio(mode: AspectRatioMode): Promise<void>;
  abstract dispose(): Promise<void>;
}
