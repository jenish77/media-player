import { BasePlayerAdapter } from './BasePlayerAdapter';
import {
  PlaybackOptions,
  SubtitleStyle,
  AudioTrack,
  SubtitleTrack,
} from '../../types/player';
import { AspectRatioMode } from '../../types/media';

let expoVideoModule: any = null;
try {
  expoVideoModule = require('expo-video');
} catch (e) {
  // expo-video may be unavailable in some mock or bare testing environments
}

export class ExpoVideoAdapter extends BasePlayerAdapter {
  private player: any = null;
  private nativeSubscriptions: any[] = [];
  private audioTracks: AudioTrack[] = [];
  private subtitleTracks: SubtitleTrack[] = [];
  private currentOptions?: PlaybackOptions;
  private progressPollTimer: any = null;
  private isSeeking: boolean = false;
  private wasPlayingBeforeSeek: boolean = false;
  private seekSessionId: number = 0;
  private pendingSeekTargetMs: number | null = null;

  getNativePlayer(): any {
    return this.player;
  }

  override isPlaying(): boolean {
    if (this.player && typeof this.player.playing === 'boolean') {
      return this.player.playing;
    }
    return this.state === 'playing';
  }

  async load(source: string, options?: PlaybackOptions): Promise<void> {
    const token = this.nextSessionToken();
    this.currentSource = source;
    this.currentOptions = options;
    this.setState('loading');

    try {
      if (this.player) {
        this.cleanupNativePlayer();
      }

      if (expoVideoModule?.createVideoPlayer) {
        const videoSource =
          typeof source === 'string' && (source.startsWith('content://') || source.startsWith('file://'))
            ? { uri: source }
            : source;
        this.player = expoVideoModule.createVideoPlayer(videoSource);

        // Crucial: Expo Video defaults timeUpdateEventInterval to 0 (which disables time updates).
        // Set to 0.25 (every 250ms) to ensure continuous, accurate timecode and scrubber events.
        try {
          this.player.timeUpdateEventInterval = 0.25;
        } catch (e) {}

        // Enable fast seek tolerance to seek to nearest keyframe and eliminate decode freezing
        try {
          this.player.seekTolerance = { toleranceBefore: 0.5, toleranceAfter: 0.5 };
        } catch (e) {}

        if (options?.autoPlay) {
          this.player.play();
        }

        if (options?.rate) {
          this.player.playbackRate = options.rate;
        }

        if (options?.startPositionMs && options.startPositionMs > 0) {
          this.player.currentTime = options.startPositionMs / 1000;
        }

        try {
          this.player.volume = this.volume;
          if (this.volume <= 0) {
            this.player.muted = true;
          }
        } catch (e) {}

        this.setupNativeListeners(token);
      } else {
        // Fallback for non-native test environments
        this.setState('ready');
      }
    } catch (err: any) {
      this.setState('fatalError');
      this.emit('error', {
        code: 'LOAD_FAILED',
        message: 'Could not load video source.',
        recoverable: false,
        technicalDetails: String(err),
      });
    }
  }

  private setupNativeListeners(token: number): void {
    if (!this.player) return;

    try {
      const statusSub = this.player.addListener('statusChange', (status: any) => {
        if (this.sessionToken !== token) return;

        if (status.status === 'readyToPlay') {
          const durationMs = (this.player.duration || 0) * 1000;
          const currentMs = (this.player.currentTime || 0) * 1000;
          this.updateProgress(currentMs, durationMs);

          if (this.isSeeking && this.wasPlayingBeforeSeek) {
            try {
              this.player.play();
            } catch (e) {}
            this.setState('playing');
            this.startProgressPolling(token);
          } else if (!this.isSeeking) {
            this.setState(this.isPlaying() ? 'playing' : 'ready');
          }
        } else if (status.status === 'loading') {
          if (!this.isSeeking) {
            this.setState('loading');
          }
        } else if (status.status === 'error') {
          this.setState('fatalError');
          this.emit('error', {
            code: 'PLAYBACK_ERROR',
            message: status.error?.message || 'Playback error occurred.',
            recoverable: false,
          });
        }
      });

      const playingSub = this.player.addListener('playingChange', (payload: any) => {
        if (this.sessionToken !== token) return;
        const isPlaying = typeof payload === 'boolean' ? payload : Boolean(payload?.isPlaying);

        // If player emitted a transient pause while seeking but video was playing, do not demote to paused
        if (this.isSeeking && this.wasPlayingBeforeSeek && !isPlaying) {
          try {
            this.player.play();
          } catch (e) {}
          return;
        }

        this.setState(isPlaying ? 'playing' : 'paused');
        if (isPlaying) {
          this.startProgressPolling(token);
        } else {
          this.stopProgressPolling();
        }
      });

      const timeSub = this.player.addListener('timeUpdate', (event: any) => {
        if (this.sessionToken !== token) return;
        const currentMs = (event.currentTime || 0) * 1000;
        const durationMs = (this.player.duration || 0) * 1000;
        const bufferedMs = (event.bufferedPosition || event.currentTime || 0) * 1000;

        // While seeking, reject timeUpdate events that report pre-seek timestamps
        if (this.isSeeking && this.pendingSeekTargetMs !== null) {
          const diff = Math.abs(currentMs - this.pendingSeekTargetMs);
          if (diff < 750) {
            this.isSeeking = false;
            this.pendingSeekTargetMs = null;
          } else {
            if (durationMs > 0) {
              this.progress.durationMs = durationMs;
              this.progress.bufferedPositionMs = Math.max(this.progress.currentTimeMs, bufferedMs);
              this.emit('progress', this.progress);
            }
            return;
          }
        }

        this.updateProgress(currentMs, durationMs, bufferedMs);
      });

      const endSub = this.player.addListener('playToEnd', () => {
        if (this.sessionToken !== token) return;
        this.setState('completed');
        this.emit('completed', undefined as any);
      });

      this.nativeSubscriptions.push(statusSub, playingSub, timeSub, endSub);
    } catch (e) {
      console.warn('Native listener attachment skipped in current environment');
    }
  }

  private cleanupNativePlayer(): void {
    this.stopProgressPolling();
    if (this.player) {
      try {
        if (typeof this.player.pause === 'function') {
          this.player.pause();
        }
      } catch (e) {}
    }
    this.nativeSubscriptions.forEach((sub) => {
      try {
        if (typeof sub?.remove === 'function') {
          sub.remove();
        }
      } catch (e) {}
    });
    this.nativeSubscriptions = [];
    if (this.player) {
      try {
        if (typeof this.player.release === 'function') {
          this.player.release();
        }
      } catch (e) {}
    }
    this.player = null;
    this.isSeeking = false;
    this.pendingSeekTargetMs = null;
  }

  private startProgressPolling(token: number): void {
    this.stopProgressPolling();
    this.progressPollTimer = setInterval(() => {
      if (this.sessionToken !== token || !this.player || this.state !== 'playing') {
        this.stopProgressPolling();
        return;
      }
      try {
        const currentSec = this.player.currentTime || 0;
        const durationSec = this.player.duration || 0;
        const currentMs = currentSec * 1000;
        const durationMs = durationSec * 1000;
        const bufferedMs = (this.player.bufferedPosition || currentSec) * 1000;

        if (this.isSeeking && this.pendingSeekTargetMs !== null) {
          const diff = Math.abs(currentMs - this.pendingSeekTargetMs);
          if (diff < 750) {
            this.isSeeking = false;
            this.pendingSeekTargetMs = null;
          } else {
            return;
          }
        }

        if (durationMs > 0) {
          this.updateProgress(currentMs, durationMs, bufferedMs);
        }
      } catch (e) {}
    }, 250);
    if (this.progressPollTimer && typeof this.progressPollTimer.unref === 'function') {
      this.progressPollTimer.unref();
    }
  }

  private stopProgressPolling(): void {
    if (this.progressPollTimer) {
      clearInterval(this.progressPollTimer);
      this.progressPollTimer = null;
    }
  }

  async play(): Promise<void> {
    if (this.player) {
      // If video has finished (or is within 0.3s of end), restart from 0
      const isAtEnd =
        this.state === 'completed' ||
        (this.player.duration > 0 && this.player.currentTime >= this.player.duration - 0.3);

      try {
        if (isAtEnd) {
          if (typeof this.player.replay === 'function') {
            this.player.replay();
          } else {
            this.player.currentTime = 0;
            this.player.play();
          }
        } else {
          this.player.play();
        }
      } catch (e) {
        console.warn('ExpoVideoAdapter play error:', e);
      }
    }
    this.setState('playing');
    this.startProgressPolling(this.sessionToken);
  }

  async pause(): Promise<void> {
    this.stopProgressPolling();
    if (this.player) {
      try {
        this.player.pause();
      } catch (e) {
        console.warn('ExpoVideoAdapter pause error:', e);
      }
    }
    this.setState('paused');
  }

  async togglePlayback(): Promise<void> {
    if (this.isPlaying()) {
      await this.pause();
    } else {
      await this.play();
    }
  }

  async seekTo(positionMs: number, resumeIfPlaying?: boolean): Promise<void> {
    if (this.state === 'disposed') return;
    const wasPlaying = typeof resumeIfPlaying === 'boolean' ? resumeIfPlaying : this.isPlaying();
    this.isSeeking = true;
    this.wasPlayingBeforeSeek = wasPlaying;
    this.pendingSeekTargetMs = positionMs;
    const currentSeekSession = ++this.seekSessionId;

    const seconds = Math.max(0, positionMs / 1000);
    if (this.player) {
      try {
        this.player.currentTime = seconds;
        if (wasPlaying) {
          this.player.play();
        }
      } catch (e) {
        console.warn('ExpoVideoAdapter seek error:', e);
      }
    }
    const duration = this.progress.durationMs;
    this.updateProgress(positionMs, duration);

    if (wasPlaying) {
      this.setState('playing');
      this.startProgressPolling(this.sessionToken);
    } else {
      this.setState('paused');
      this.stopProgressPolling();
    }

    setTimeout(() => {
      if (this.seekSessionId === currentSeekSession) {
        this.isSeeking = false;
        this.pendingSeekTargetMs = null;
        if (this.wasPlayingBeforeSeek && this.player) {
          try {
            this.player.play();
          } catch (e) {}
          this.setState('playing');
        }
      }
    }, 600);
  }

  async seekBy(seconds: number, resumeIfPlaying?: boolean): Promise<void> {
    const currentMs =
      this.pendingSeekTargetMs !== null ? this.pendingSeekTargetMs : this.progress.currentTimeMs;
    const durationMs = this.progress.durationMs;
    const targetMs =
      durationMs > 0
        ? Math.max(0, Math.min(currentMs + seconds * 1000, durationMs))
        : Math.max(0, currentMs + seconds * 1000);

    await this.seekTo(targetMs, resumeIfPlaying);
  }

  async setRate(rate: number): Promise<void> {
    this.playbackRate = rate;
    if (this.player) {
      this.player.playbackRate = rate;
    }
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = volume;
    if (this.player) {
      try {
        if (volume <= 0) {
          this.player.muted = true;
          this.player.volume = 0;
        } else {
          this.player.muted = false;
          this.player.volume = volume;
        }
      } catch (e) {
        console.warn('ExpoVideoAdapter setVolume error:', e);
      }
    }
  }

  async setAudioTrack(trackId: string): Promise<void> {
    this.audioTracks.forEach((t) => (t.selected = t.id === trackId));
    this.emit('tracksChanged', {
      audioTracks: [...this.audioTracks],
      subtitleTracks: [...this.subtitleTracks],
    });
  }

  async setSubtitleTrack(trackId: string | null): Promise<void> {
    this.subtitleTracks.forEach((t) => (t.selected = t.id === trackId));
    this.emit('tracksChanged', {
      audioTracks: [...this.audioTracks],
      subtitleTracks: [...this.subtitleTracks],
    });
  }

  async loadExternalSubtitle(uri: string): Promise<void> {
    const newTrack: SubtitleTrack = {
      id: `sub-ext-${Date.now()}`,
      label: 'External Subtitle',
      selected: true,
      isExternal: true,
      uri,
      format: 'srt',
    };
    this.subtitleTracks.push(newTrack);
    await this.setSubtitleTrack(newTrack.id);
  }

  async setSubtitleStyle(_style: SubtitleStyle): Promise<void> {}

  async setSubtitleDelay(milliseconds: number): Promise<void> {
    this.subtitleDelayMs = milliseconds;
  }

  async setAudioDelay(milliseconds: number): Promise<void> {
    this.audioDelayMs = milliseconds;
  }

  async setAspectRatio(mode: AspectRatioMode): Promise<void> {
    this.aspectRatio = mode;
    this.emit('aspectRatioChanged', { mode });
  }

  async dispose(): Promise<void> {
    this.cleanupNativePlayer();
    this.setState('disposed');
  }
}
