import { AspectRatioMode } from './media';

export type PlayerState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'completed'
  | 'recoverableError'
  | 'fatalError'
  | 'disposed';

export interface TrackInfo {
  id: string;
  label: string;
  language?: string;
  selected: boolean;
}

export interface AudioTrack extends TrackInfo {
  channels?: number;
  bitrate?: number;
  codec?: string;
}

export interface SubtitleTrack extends TrackInfo {
  isExternal?: boolean;
  uri?: string;
  format?: 'srt' | 'vtt' | 'ass' | 'embedded';
}

export interface SubtitleCue {
  id?: string;
  startTimeMs: number;
  endTimeMs: number;
  text: string;
}

export interface SubtitleStyle {
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  outlineColor?: string;
  bottomOffsetPercent?: number;
}

export interface PlaybackOptions {
  startPositionMs?: number;
  rate?: number;
  autoPlay?: boolean;
  audioTrackId?: string;
  subtitleTrackId?: string | null;
  externalSubtitleUri?: string;
  subtitleDelayMs?: number;
  audioDelayMs?: number;
  aspectRatio?: AspectRatioMode;
}

export interface PlaybackProgress {
  currentTimeMs: number;
  durationMs: number;
  bufferedPositionMs: number;
}

export interface PlayerError {
  code: string;
  message: string;
  recoverable: boolean;
  technicalDetails?: string;
}

export type PlayerEventType =
  | 'stateChange'
  | 'progress'
  | 'tracksChanged'
  | 'error'
  | 'completed'
  | 'aspectRatioChanged';

export interface PlayerEventMap {
  stateChange: { previousState: PlayerState; currentState: PlayerState };
  progress: PlaybackProgress;
  tracksChanged: { audioTracks: AudioTrack[]; subtitleTracks: SubtitleTrack[] };
  error: PlayerError;
  completed: void;
  aspectRatioChanged: { mode: AspectRatioMode };
}

export type SeekLifecycleStatus = 'idle' | 'pending' | 'acknowledged' | 'timedOut' | 'failed';

export interface PendingSeek {
  requestId: number;
  sessionId: number;
  targetPositionMs: number;
  previousPositionMs: number;
  direction: 'forward' | 'backward' | 'stationary';
  wasPlaying: boolean;
  status: SeekLifecycleStatus;
  requestedAt: number;
  acknowledgedAt?: number | null;
  error?: string | null;
}

export interface SeekDiagnosticEvent {
  requestId: number;
  sessionId: number;
  mediaId: string | null;
  requestedPositionMs: number;
  safeTargetPositionMs: number;
  previousNativePositionMs: number;
  seekDirection: 'forward' | 'backward' | 'stationary';
  wasPlayingBeforeSeek: boolean;
  seekRequestedAt: number;
  nativeSeekCompletedAt: number | null;
  actualPositionAfterSeekMs: number | null;
  firstFrameAfterSeekAt: number | null;
  isBuffering: boolean;
  playbackState: string;
  watchdogTriggered: boolean;
  seekCompleted: boolean;
  status: SeekLifecycleStatus;
}
