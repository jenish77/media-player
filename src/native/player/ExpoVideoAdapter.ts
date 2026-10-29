import { BasePlayerAdapter } from './BasePlayerAdapter';
import {
  PlaybackOptions,
  SubtitleStyle,
  AudioTrack,
  SubtitleTrack,
  PendingSeek,
  SeekDiagnosticEvent,
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
  private hasNativeTimeListener: boolean = false;
  private lastNativeTimeUpdate: number = 0;
  private isSeeking: boolean = false;
  private wasPlayingBeforeSeek: boolean = false;
  private seekSessionId: number = 0;
  private seekRequestId: number = 0;
  private pendingSeekTargetMs: number | null = null;
  private activeSeek: PendingSeek | null = null;
  private lastSeekDiagnostic: SeekDiagnosticEvent | null = null;
  private seekWatchdogTimer: any = null;

  getLastSeekDiagnostic(): SeekDiagnosticEvent | null {
    return this.lastSeekDiagnostic;
  }

  getActiveSeek(): PendingSeek | null {
    return this.activeSeek;
  }

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

  private reconcileSeek(
    eventSource: string,
    nativeCurrentMs: number,
    options?: { isTimeout?: boolean; isError?: boolean; errorMessage?: string; isEnded?: boolean }
  ): boolean {
    if (!this.isSeeking || !this.activeSeek) {
      return false;
    }

    const { requestId, targetPositionMs, previousPositionMs, direction, wasPlaying } =
      this.activeSeek;
    const durationMs = this.progress.durationMs;

    // 1. Error path
    if (options?.isError) {
      if (this.seekWatchdogTimer) {
        clearTimeout(this.seekWatchdogTimer);
        this.seekWatchdogTimer = null;
      }
      this.activeSeek.status = 'failed';
      this.activeSeek.error = options.errorMessage || 'Native seek error';
      if (this.lastSeekDiagnostic && this.lastSeekDiagnostic.requestId === requestId) {
        this.lastSeekDiagnostic.seekCompleted = false;
        this.lastSeekDiagnostic.actualPositionAfterSeekMs = nativeCurrentMs;
        this.lastSeekDiagnostic.status = 'failed';
      }
      this.isSeeking = false;
      this.pendingSeekTargetMs = null;
      this.activeSeek = null;
      this.updateProgress(nativeCurrentMs, durationMs);
      return true;
    }

    // 2. PlayToEnd / Ended path
    if (options?.isEnded) {
      if (this.seekWatchdogTimer) {
        clearTimeout(this.seekWatchdogTimer);
        this.seekWatchdogTimer = null;
      }
      const completedAt = Date.now();
      this.activeSeek.status = 'acknowledged';
      this.activeSeek.acknowledgedAt = completedAt;
      if (this.lastSeekDiagnostic && this.lastSeekDiagnostic.requestId === requestId) {
        this.lastSeekDiagnostic.nativeSeekCompletedAt = completedAt;
        this.lastSeekDiagnostic.actualPositionAfterSeekMs = durationMs;
        this.lastSeekDiagnostic.firstFrameAfterSeekAt = null;
        this.lastSeekDiagnostic.seekCompleted = true;
        this.lastSeekDiagnostic.playbackState = 'completed';
        this.lastSeekDiagnostic.status = 'acknowledged';
      }
      this.isSeeking = false;
      this.pendingSeekTargetMs = null;
      this.activeSeek = null;
      return true;
    }

    // 3. Timeout / Watchdog path
    if (options?.isTimeout) {
      const posDiff = Math.abs(nativeCurrentMs - targetPositionMs);
      const isBuffering = this.state === 'buffering' || this.player?.status === 'loading';
      const reachedTarget =
        posDiff <= 1000 ||
        (targetPositionMs === 0 && nativeCurrentMs <= 1000) ||
        (durationMs > 0 && targetPositionMs >= durationMs - 500 && nativeCurrentMs >= durationMs - 1000);

      if (this.lastSeekDiagnostic && this.lastSeekDiagnostic.requestId === requestId) {
        this.lastSeekDiagnostic.watchdogTriggered = true;
        this.lastSeekDiagnostic.isBuffering = isBuffering;
      }

      if (reachedTarget) {
        console.log(
          `[SeekDiagnostic] Watchdog confirmed native player reached target (${nativeCurrentMs}ms). Completing seek.`
        );
        const completedAt = Date.now();
        this.activeSeek.status = 'acknowledged';
        this.activeSeek.acknowledgedAt = completedAt;
        if (this.lastSeekDiagnostic && this.lastSeekDiagnostic.requestId === requestId) {
          this.lastSeekDiagnostic.seekCompleted = true;
          this.lastSeekDiagnostic.actualPositionAfterSeekMs = nativeCurrentMs;
          this.lastSeekDiagnostic.nativeSeekCompletedAt = completedAt;
          this.lastSeekDiagnostic.firstFrameAfterSeekAt = null;
          this.lastSeekDiagnostic.playbackState = wasPlaying ? 'playing' : 'paused';
          this.lastSeekDiagnostic.status = 'acknowledged';
        }
        this.isSeeking = false;
        this.pendingSeekTargetMs = null;
        this.activeSeek = null;
        this.updateProgress(nativeCurrentMs, durationMs);
        if (wasPlaying) {
          try {
            this.player?.play();
          } catch (e) {}
          this.setState('playing');
          this.startProgressPolling(this.sessionToken);
        } else {
          try {
            this.player?.pause();
          } catch (e) {}
          this.setState('paused');
          this.stopProgressPolling();
        }
        return true;
      }

      if (isBuffering) {
        console.log(
          `[SeekDiagnostic] Player is still buffering at ${nativeCurrentMs}ms. Preserving buffering state.`
        );
        this.activeSeek.status = 'timedOut';
        if (this.lastSeekDiagnostic && this.lastSeekDiagnostic.requestId === requestId) {
          this.lastSeekDiagnostic.seekCompleted = false;
          this.lastSeekDiagnostic.status = 'timedOut';
        }
        this.isSeeking = false;
        this.pendingSeekTargetMs = null;
        this.activeSeek = null;
        this.setState('buffering');
        return false;
      }

      console.warn(
        `[SeekDiagnostic] Player stuck at ${nativeCurrentMs}ms (target=${targetPositionMs}ms). Marking failed.`
      );
      this.activeSeek.status = 'failed';
      this.activeSeek.error = 'Watchdog timeout: target not reached';
      if (this.lastSeekDiagnostic && this.lastSeekDiagnostic.requestId === requestId) {
        this.lastSeekDiagnostic.actualPositionAfterSeekMs = nativeCurrentMs;
        this.lastSeekDiagnostic.seekCompleted = false;
        this.lastSeekDiagnostic.status = 'failed';
      }
      this.isSeeking = false;
      this.pendingSeekTargetMs = null;
      this.activeSeek = null;
      this.updateProgress(nativeCurrentMs, durationMs);
      return false;
    }

    // 4. Normal Native Event (readyToPlay, timeUpdate, progressPoll)
    let isAcknowledged = false;
    let isStale = false;

    if (direction === 'backward') {
      if (nativeCurrentMs > targetPositionMs + 1000) {
        isStale = true;
      } else if (Math.abs(nativeCurrentMs - targetPositionMs) <= 1000) {
        isAcknowledged = true;
      } else if (
        wasPlaying &&
        nativeCurrentMs >= targetPositionMs - 500 &&
        nativeCurrentMs <= targetPositionMs + 2500 &&
        nativeCurrentMs < previousPositionMs - 300
      ) {
        isAcknowledged = true;
      } else if (targetPositionMs === 0 && nativeCurrentMs <= 1000) {
        isAcknowledged = true;
      }
    } else if (direction === 'forward') {
      if (targetPositionMs > previousPositionMs + 1000 && nativeCurrentMs < previousPositionMs + 300) {
        isStale = true;
      } else if (Math.abs(nativeCurrentMs - targetPositionMs) <= 1000) {
        isAcknowledged = true;
      } else if (
        wasPlaying &&
        nativeCurrentMs >= targetPositionMs - 1000 &&
        nativeCurrentMs <= targetPositionMs + 2500
      ) {
        isAcknowledged = true;
      } else if (durationMs > 0 && targetPositionMs >= durationMs - 500 && nativeCurrentMs >= durationMs - 1000) {
        isAcknowledged = true;
      }
    } else {
      if (Math.abs(nativeCurrentMs - targetPositionMs) <= 1000) {
        isAcknowledged = true;
      }
    }

    if (isStale && !isAcknowledged) {
      console.log(
        `[SeekDiagnostic] Stale pre-seek ${eventSource} rejected: current=${nativeCurrentMs}ms, prev=${previousPositionMs}ms, target=${targetPositionMs}ms, dir=${direction}`
      );
      return false;
    }

    if (!isAcknowledged) {
      return false;
    }

    // Acknowledged!
    const completedAt = Date.now();
    console.log(
      `[SeekDiagnostic] Seek #${requestId} acknowledged via ${eventSource}: current=${nativeCurrentMs}ms, target=${targetPositionMs}ms, latency=${completedAt - this.activeSeek.requestedAt}ms`
    );

    if (this.seekWatchdogTimer) {
      clearTimeout(this.seekWatchdogTimer);
      this.seekWatchdogTimer = null;
    }

    this.activeSeek.status = 'acknowledged';
    this.activeSeek.acknowledgedAt = completedAt;

    if (this.lastSeekDiagnostic && this.lastSeekDiagnostic.requestId === requestId) {
      this.lastSeekDiagnostic.nativeSeekCompletedAt = completedAt;
      this.lastSeekDiagnostic.actualPositionAfterSeekMs = nativeCurrentMs;
      this.lastSeekDiagnostic.firstFrameAfterSeekAt = null; // Do NOT fabricate!
      this.lastSeekDiagnostic.seekCompleted = true;
      this.lastSeekDiagnostic.playbackState = wasPlaying ? 'playing' : 'paused';
      this.lastSeekDiagnostic.status = 'acknowledged';
    }

    this.isSeeking = false;
    this.pendingSeekTargetMs = null;
    this.activeSeek = null;

    this.updateProgress(nativeCurrentMs, durationMs);

    if (wasPlaying) {
      try {
        this.player?.play();
      } catch (e) {}
      this.setState('playing');
      this.startProgressPolling(this.sessionToken);
    } else {
      try {
        this.player?.pause();
      } catch (e) {}
      this.setState('paused');
      this.stopProgressPolling();
    }

    return true;
  }

  private setupNativeListeners(token: number): void {
    if (!this.player) return;

    try {
      const statusSub = this.player.addListener('statusChange', (status: any) => {
        if (this.sessionToken !== token) return;

        if (status.status === 'readyToPlay') {
          const durationMs = (this.player.duration || 0) * 1000;
          const currentMs = (this.player.currentTime || 0) * 1000;
          console.log(`[ExpoVideoAdapter] statusChange readyToPlay: currentMs=${currentMs}, isSeeking=${this.isSeeking}`);

          if (this.isSeeking && this.activeSeek) {
            const acknowledged = this.reconcileSeek('readyToPlay', currentMs);
            if (!acknowledged) {
              return;
            }
          } else {
            this.updateProgress(currentMs, durationMs);
            this.setState(this.isPlaying() ? 'playing' : 'ready');
          }
        } else if (status.status === 'loading') {
          if (!this.isSeeking) {
            this.setState('loading');
          }
        } else if (status.status === 'error') {
          this.reconcileSeek('error', 0, {
            isError: true,
            errorMessage: status.error?.message || 'Playback error occurred.',
          });
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

        // While seeking, ExoPlayer transiently pauses during buffer initialization.
        // Do not demote state to 'paused' if user playback intent was to be playing.
        if (this.isSeeking && this.wasPlayingBeforeSeek && !isPlaying) {
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
        this.hasNativeTimeListener = true;
        this.lastNativeTimeUpdate = Date.now();
        const currentMs = (event.currentTime || 0) * 1000;
        const durationMs = (this.player.duration || 0) * 1000;
        const bufferedMs = (event.bufferedPosition || event.currentTime || 0) * 1000;

        if (this.isSeeking && this.activeSeek !== null) {
          const acknowledged = this.reconcileSeek('timeUpdate', currentMs);
          if (!acknowledged) {
            if (durationMs > 0) {
              this.progress.durationMs = durationMs;
              this.progress.bufferedPositionMs = Math.max(this.progress.currentTimeMs, bufferedMs);
              this.emit('progress', this.progress);
            }
            return;
          }
          return;
        }

        this.updateProgress(currentMs, durationMs, bufferedMs);
      });

      const endSub = this.player.addListener('playToEnd', () => {
        if (this.sessionToken !== token) return;
        if (this.isSeeking && this.activeSeek) {
          this.reconcileSeek('playToEnd', this.progress.durationMs, { isEnded: true });
        }
        this.stopProgressPolling();
        this.setState('completed');
        this.emit('completed', undefined as any);
      });

      this.nativeSubscriptions.push(statusSub, playingSub, timeSub, endSub);
      this.hasNativeTimeListener = true;
    } catch (e) {
      console.warn('Native listener attachment skipped in current environment');
    }
  }

  private cleanupNativePlayer(): void {
    if (this.seekWatchdogTimer) {
      clearTimeout(this.seekWatchdogTimer);
      this.seekWatchdogTimer = null;
    }
    this.stopProgressPolling();
    this.hasNativeTimeListener = false;
    this.lastNativeTimeUpdate = 0;
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
    this.activeSeek = null;
  }

  private startProgressPolling(token: number): void {
    this.stopProgressPolling();
    this.progressPollTimer = setInterval(() => {
      if (this.sessionToken !== token || !this.player || this.state !== 'playing') {
        this.stopProgressPolling();
        return;
      }
      // If native timeUpdate is already firing regularly (within 600ms), avoid redundant updates
      if (this.hasNativeTimeListener && Date.now() - this.lastNativeTimeUpdate < 600) {
        return;
      }
      try {
        const currentSec = this.player.currentTime || 0;
        const durationSec = this.player.duration || 0;
        const currentMs = currentSec * 1000;
        const durationMs = durationSec * 1000;
        const bufferedMs = (this.player.bufferedPosition || currentSec) * 1000;

        if (this.isSeeking && this.activeSeek !== null) {
          const acknowledged = this.reconcileSeek('progressPoll', currentMs);
          if (!acknowledged) {
            return;
          }
          return;
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
    if (this.activeSeek) {
      this.activeSeek.wasPlaying = true;
    }
    this.wasPlayingBeforeSeek = true;
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
    if (this.activeSeek) {
      this.activeSeek.wasPlaying = false;
    }
    this.wasPlayingBeforeSeek = false;
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
    const currentSeekSession = ++this.seekSessionId;
    const currentRequestId = ++this.seekRequestId;

    if (this.seekWatchdogTimer) {
      clearTimeout(this.seekWatchdogTimer);
      this.seekWatchdogTimer = null;
    }

    const durationMs = this.progress.durationMs;
    // Clamping: allow seeking to exact bounds [0, durationMs]
    const safeTargetMs =
      durationMs > 0 ? Math.max(0, Math.min(positionMs, durationMs)) : Math.max(0, positionMs);

    const previousPositionMs = this.progress.currentTimeMs;
    const diff = safeTargetMs - previousPositionMs;
    let direction: 'forward' | 'backward' | 'stationary' = 'stationary';
    if (diff > 50) direction = 'forward';
    else if (diff < -50) direction = 'backward';

    this.isSeeking = true;
    this.wasPlayingBeforeSeek = wasPlaying;
    this.pendingSeekTargetMs = safeTargetMs;

    this.activeSeek = {
      requestId: currentRequestId,
      sessionId: currentSeekSession,
      targetPositionMs: safeTargetMs,
      previousPositionMs,
      direction,
      wasPlaying,
      requestedAt: Date.now(),
      status: 'pending',
    };

    this.lastSeekDiagnostic = {
      requestId: currentRequestId,
      sessionId: currentSeekSession,
      mediaId: this.currentSource,
      requestedPositionMs: positionMs,
      safeTargetPositionMs: safeTargetMs,
      previousNativePositionMs: previousPositionMs,
      seekDirection: direction,
      wasPlayingBeforeSeek: wasPlaying,
      seekRequestedAt: this.activeSeek.requestedAt,
      nativeSeekCompletedAt: null,
      actualPositionAfterSeekMs: null,
      firstFrameAfterSeekAt: null,
      isBuffering: false,
      playbackState: this.state,
      watchdogTriggered: false,
      seekCompleted: false,
      status: 'pending',
    };

    console.log(
      `[SeekDiagnostic] Native seekTo requested: req=${currentRequestId}, targetMs=${positionMs}, safeTargetMs=${safeTargetMs}, prevMs=${previousPositionMs}, dir=${direction}, wasPlaying=${wasPlaying}, session=${currentSeekSession}`
    );

    const seconds = safeTargetMs / 1000;
    if (this.player) {
      try {
        try {
          this.player.seekTolerance = { toleranceBefore: 0.5, toleranceAfter: 0.5 };
        } catch (e) {}

        this.player.currentTime = seconds;
        if (wasPlaying) {
          this.player.play();
        }
      } catch (e) {
        console.warn('[SeekDiagnostic] ExpoVideoAdapter seek error:', e);
      }
    }

    if (wasPlaying) {
      this.setState('playing');
      this.startProgressPolling(this.sessionToken);
    } else {
      this.setState('paused');
      this.stopProgressPolling();
    }

    const token = this.sessionToken;
    const targetReqId = currentRequestId;
    const targetSessId = currentSeekSession;

    // Robust 1200ms watchdog timeout routed through single reconcileSeek
    this.seekWatchdogTimer = setTimeout(() => {
      if (
        this.sessionToken === token &&
        this.activeSeek &&
        this.activeSeek.requestId === targetReqId &&
        this.activeSeek.sessionId === targetSessId &&
        this.isSeeking
      ) {
        const nativeCurrentMs = (this.player?.currentTime || 0) * 1000;
        this.reconcileSeek('watchdog', nativeCurrentMs, { isTimeout: true });
      }
    }, 1200);
  }

  async seekBy(seconds: number, resumeIfPlaying?: boolean): Promise<void> {
    const currentMs =
      this.pendingSeekTargetMs !== null ? this.pendingSeekTargetMs : this.progress.currentTimeMs;
    const durationMs = this.progress.durationMs;
    const rawTarget = currentMs + seconds * 1000;
    const targetMs =
      durationMs > 0
        ? Math.max(0, Math.min(rawTarget, durationMs))
        : Math.max(0, rawTarget);

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
