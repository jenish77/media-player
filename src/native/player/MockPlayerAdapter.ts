import { BasePlayerAdapter } from './BasePlayerAdapter';
import {
  PlaybackOptions,
  SubtitleStyle,
  AudioTrack,
  SubtitleTrack,
} from '../../types/player';
import { AspectRatioMode } from '../../types/media';

export class MockPlayerAdapter extends BasePlayerAdapter {
  private timer: any = null;
  private audioTracks: AudioTrack[] = [];
  private subtitleTracks: SubtitleTrack[] = [];
  private selectedAudioTrack: string | null = null;
  private selectedSubtitleTrack: string | null = null;
  private simulatedDurationMs: number = 120000; // 2 minutes default

  setSimulatedDuration(durationMs: number): void {
    this.simulatedDurationMs = durationMs;
  }

  async load(source: string, options?: PlaybackOptions): Promise<void> {
    this.stopPlaybackTimer();
    const token = this.nextSessionToken();
    this.currentSource = source;
    this.setState('loading');

    // Simulate async media probe & decoder setup
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Ensure session hasn't been superseded
    if (this.sessionToken !== token) return;

    // Simulate tracks
    this.audioTracks = [
      { id: 'audio-1', label: 'English (AAC Stereo)', language: 'en', selected: true },
      { id: 'audio-2', label: 'Spanish (AC3 5.1)', language: 'es', selected: false },
    ];

    this.subtitleTracks = [
      { id: 'sub-1', label: 'English [CC]', language: 'en', selected: false, format: 'embedded' },
      { id: 'sub-2', label: 'Spanish', language: 'es', selected: false, format: 'embedded' },
    ];

    if (options?.externalSubtitleUri) {
      this.subtitleTracks.push({
        id: 'sub-ext',
        label: 'External Subtitle',
        selected: true,
        isExternal: true,
        uri: options.externalSubtitleUri,
        format: 'srt',
      });
      this.selectedSubtitleTrack = 'sub-ext';
    }

    const startPos = options?.startPositionMs || 0;
    this.updateProgress(startPos, this.simulatedDurationMs, startPos + 10000);
    this.setState('ready');

    this.emit('tracksChanged', {
      audioTracks: [...this.audioTracks],
      subtitleTracks: [...this.subtitleTracks],
    });

    if (options?.autoPlay) {
      await this.play();
    }
  }

  async play(): Promise<void> {
    if (this.state === 'disposed') return;
    this.setState('playing');
    this.startPlaybackTimer();
  }

  async pause(): Promise<void> {
    if (this.state === 'disposed') return;
    this.stopPlaybackTimer();
    this.setState('paused');
  }

  async togglePlayback(): Promise<void> {
    if (this.state === 'playing') {
      await this.pause();
    } else {
      await this.play();
    }
  }

  private pendingSeekTargetMs: number | null = null;

  async seekTo(positionMs: number, resumeIfPlaying?: boolean): Promise<void> {
    if (this.state === 'disposed') return;
    const wasPlaying = typeof resumeIfPlaying === 'boolean' ? resumeIfPlaying : this.isPlaying();
    const clamped = Math.max(0, Math.min(positionMs, this.simulatedDurationMs));
    this.pendingSeekTargetMs = null;
    this.updateProgress(clamped, this.simulatedDurationMs, clamped + 10000);

    if (clamped >= this.simulatedDurationMs && this.simulatedDurationMs > 0) {
      this.stopPlaybackTimer();
      this.setState('completed');
      this.emit('completed', undefined as any);
    } else if (wasPlaying) {
      this.setState('playing');
      this.startPlaybackTimer();
    } else {
      this.stopPlaybackTimer();
      this.setState('paused');
    }
  }

  async seekBy(seconds: number, resumeIfPlaying?: boolean): Promise<void> {
    const current =
      this.pendingSeekTargetMs !== null ? this.pendingSeekTargetMs : this.progress.currentTimeMs;
    const target = Math.max(0, Math.min(current + seconds * 1000, this.simulatedDurationMs));
    this.pendingSeekTargetMs = target;
    await this.seekTo(target, resumeIfPlaying);
  }

  async setRate(rate: number): Promise<void> {
    this.playbackRate = rate;
  }

  getRate(): number {
    return this.playbackRate;
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = Math.max(0, Math.min(volume, 1.0));
  }

  getVolume(): number {
    return this.volume;
  }

  async setAudioTrack(trackId: string): Promise<void> {
    this.selectedAudioTrack = trackId;
    this.audioTracks.forEach((t) => (t.selected = t.id === trackId));
    this.emit('tracksChanged', {
      audioTracks: [...this.audioTracks],
      subtitleTracks: [...this.subtitleTracks],
    });
  }

  async setSubtitleTrack(trackId: string | null): Promise<void> {
    this.selectedSubtitleTrack = trackId;
    this.subtitleTracks.forEach((t) => (t.selected = t.id === trackId));
    this.emit('tracksChanged', {
      audioTracks: [...this.audioTracks],
      subtitleTracks: [...this.subtitleTracks],
    });
  }

  async loadExternalSubtitle(uri: string): Promise<void> {
    const extTrack: SubtitleTrack = {
      id: `sub-ext-${Date.now()}`,
      label: 'External Track',
      selected: true,
      isExternal: true,
      uri,
      format: 'srt',
    };
    this.subtitleTracks.push(extTrack);
    await this.setSubtitleTrack(extTrack.id);
  }

  async setSubtitleStyle(_style: SubtitleStyle): Promise<void> {
    // Style applied in state/UI overlay
  }

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
    this.stopPlaybackTimer();
    this.setState('disposed');
  }

  // Trigger error simulation for testing
  simulateError(code: string, message: string, recoverable: boolean): void {
    this.stopPlaybackTimer();
    this.setState(recoverable ? 'recoverableError' : 'fatalError');
    this.emit('error', { code, message, recoverable });
  }

  // Trigger progress simulation for testing
  simulateProgressUpdate(currentTimeMs: number, durationMs?: number, bufferedMs?: number): void {
    const dur = durationMs ?? this.simulatedDurationMs;
    const buf = bufferedMs ?? currentTimeMs + 5000;
    this.updateProgress(currentTimeMs, dur, buf);
  }

  private startPlaybackTimer(): void {
    this.stopPlaybackTimer();
    this.timer = setInterval(() => {
      const nextTime = this.progress.currentTimeMs + 250 * this.playbackRate;
      if (nextTime >= this.simulatedDurationMs && this.simulatedDurationMs > 0) {
        this.updateProgress(this.simulatedDurationMs, this.simulatedDurationMs);
        this.stopPlaybackTimer();
        this.setState('completed');
        this.emit('completed', undefined as any);
      } else {
        this.updateProgress(nextTime, this.simulatedDurationMs, nextTime + 5000);
      }
    }, 250);
    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  private stopPlaybackTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
