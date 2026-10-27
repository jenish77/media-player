import {
  PlayerState,
  PlaybackOptions,
  PlaybackProgress,
  SubtitleStyle,
  SubtitleTrack,
  AudioTrack,
  PlayerEventType,
  PlayerEventMap,
} from '../../types/player';
import { AspectRatioMode } from '../../types/media';
import { PlayerCapabilities } from './capabilities';

export interface IPlayerAdapter {
  getState(): PlayerState;
  getProgress(): PlaybackProgress;
  getCapabilities(): PlayerCapabilities;
  getCurrentSource(): string | null;
  getSessionToken(): number;
  isPlaying(): boolean;

  load(source: string, options?: PlaybackOptions): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  togglePlayback(): Promise<void>;
  seekTo(positionMs: number, resumeIfPlaying?: boolean): Promise<void>;
  seekBy(seconds: number, resumeIfPlaying?: boolean): Promise<void>;
  setRate(rate: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  setAudioTrack(trackId: string): Promise<void>;
  setSubtitleTrack(trackId: string | null): Promise<void>;
  loadExternalSubtitle(uri: string): Promise<void>;
  setSubtitleStyle(style: SubtitleStyle): Promise<void>;
  setSubtitleDelay(milliseconds: number): Promise<void>;
  setAudioDelay(milliseconds: number): Promise<void>;
  setAspectRatio(mode: AspectRatioMode): Promise<void>;

  addListener<K extends PlayerEventType>(
    event: K,
    listener: (data: PlayerEventMap[K]) => void
  ): () => void;

  dispose(): Promise<void>;
}
