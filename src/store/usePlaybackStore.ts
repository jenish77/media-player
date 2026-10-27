import { create } from 'zustand';
import { MediaItem, AspectRatioMode } from '../types/media';
import {
  PlayerState,
  PlaybackProgress,
  AudioTrack,
  SubtitleTrack,
  SubtitleCue,
  PlayerError,
} from '../types/player';
import { getDefaultPlayerAdapter, IPlayerAdapter } from '../native/player/PlayerAdapter';
import { playbackPersistence } from '../services/playbackPersistence';
import { parseSubtitleFile } from '../utils/subtitleParser';
import { clamp, validateMediaFile, getPlaybackResumeAction } from '../utils/edgeCaseHandlers';

let BrightnessModule: any = null;
try {
  BrightnessModule = require('expo-brightness');
} catch (e) {}

interface PlaybackState {
  state: PlayerState;
  currentMedia: MediaItem | null;
  currentTimeMs: number;
  durationMs: number;
  bufferedMs: number;
  playbackRate: number;
  volume: number;
  brightness: number;
  aspectRatio: AspectRatioMode;
  isLocked: boolean;
  areControlsVisible: boolean;
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  activeAudioTrackId: string | null;
  activeSubtitleTrackId: string | null;
  subtitleCues: SubtitleCue[];
  subtitleDelayMs: number;
  audioDelayMs: number;
  error: PlayerError | null;
  autoHideTimer: ReturnType<typeof setTimeout> | null;
  nativePlayer: any;
  isScrubbing: boolean;
  scrubPositionMs: number;
  orientationMode: 'auto' | 'portrait' | 'landscape';
  queue: MediaItem[];
  queueIndex: number;

  // Actions
  init: (adapter?: IPlayerAdapter) => void;
  loadMedia: (media: MediaItem, resumeFromPosition?: boolean) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seekTo: (positionMs: number, resumeIfPlaying?: boolean) => Promise<void>;
  skipBy: (seconds: number) => Promise<void>;
  startScrubbing: () => void;
  moveScrubbing: (positionMs: number) => void;
  endScrubbing: (positionMs: number) => Promise<void>;
  setOrientationMode: (mode: 'auto' | 'portrait' | 'landscape') => void;
  cycleOrientationMode: () => 'auto' | 'portrait' | 'landscape';
  toggleOrientation: () => 'portrait' | 'landscape';
  setPlaybackRate: (rate: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setBrightness: (brightness: number) => Promise<void>;
  setAspectRatio: (mode: AspectRatioMode) => Promise<void>;
  toggleLock: () => void;
  toggleControls: () => void;
  hideControls: () => void;
  showControlsTemporarily: (durationMs?: number) => void;
  setAudioTrack: (trackId: string) => Promise<void>;
  setSubtitleTrack: (trackId: string | null) => Promise<void>;
  loadExternalSubtitleText: (text: string, filename?: string) => Promise<void>;
  setSubtitleDelay: (ms: number) => Promise<void>;
  setAudioDelay: (ms: number) => Promise<void>;
  dismissError: () => void;
  reset: () => Promise<void>;
  setQueue: (items: MediaItem[], startIndex?: number) => void;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
}

let activeAdapter: IPlayerAdapter = getDefaultPlayerAdapter();
let unsubscribeEvents: (() => void)[] = [];
let authoritativeSeekTargetMs: number | null = null;
let seekDispatchTimer: ReturnType<typeof setTimeout> | null = null;
let seekReconciliationTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSeekResolvers: Array<() => void> = [];
let wasPlayingBeforeSeek: boolean | null = null;
let wasPlayingBeforeScrub: boolean | null = null;
let isTogglingPlay = false;
let isSwitchingMedia = false;

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  state: 'idle',
  currentMedia: null,
  currentTimeMs: 0,
  durationMs: 0,
  bufferedMs: 0,
  playbackRate: 1.0,
  volume: 1.0,
  brightness: 0.5,
  aspectRatio: 'fit',
  isLocked: false,
  areControlsVisible: true,
  audioTracks: [],
  subtitleTracks: [],
  activeAudioTrackId: null,
  activeSubtitleTrackId: null,
  subtitleCues: [],
  subtitleDelayMs: 0,
  audioDelayMs: 0,
  error: null,
  autoHideTimer: null,
  nativePlayer: null,
  isScrubbing: false,
  scrubPositionMs: 0,
  orientationMode: 'auto',
  queue: [],
  queueIndex: -1,

  init: (customAdapter?: IPlayerAdapter) => {
    if (customAdapter) {
      activeAdapter = customAdapter;
    }

    // Clean up existing subscriptions to prevent duplicate event listeners
    unsubscribeEvents.forEach((unsub) => {
      try {
        unsub();
      } catch (e) {}
    });
    unsubscribeEvents = [];

    const unSubState = activeAdapter.addListener('stateChange', ({ currentState }) => {
      set({ state: currentState });
      if (currentState === 'playing') {
        get().showControlsTemporarily();
      }
    });

    const unSubProg = activeAdapter.addListener('progress', (progress: PlaybackProgress) => {
      // 1. While user is actively dragging the scrubber slider, never overwrite finger position
      if (get().isScrubbing) {
        set({
          durationMs: progress.durationMs,
          bufferedMs: progress.bufferedPositionMs,
        });
        return;
      }

      // 2. While a seek is pending or reconciling, ignore stale pre-seek time updates
      if (authoritativeSeekTargetMs !== null) {
        const diff = Math.abs(progress.currentTimeMs - authoritativeSeekTargetMs);
        if (diff < 750) {
          // Native player has caught up to the seek target
          authoritativeSeekTargetMs = null;
          if (seekReconciliationTimer) {
            clearTimeout(seekReconciliationTimer);
            seekReconciliationTimer = null;
          }
        } else {
          // Reject stale pre-seek time updates so UI never jumps backward
          set({
            durationMs: progress.durationMs,
            bufferedMs: Math.max(progress.bufferedPositionMs, get().currentTimeMs),
          });
          return;
        }
      }

      set({
        currentTimeMs: progress.currentTimeMs,
        scrubPositionMs: progress.currentTimeMs,
        durationMs: progress.durationMs,
        bufferedMs: progress.bufferedPositionMs,
      });

      const media = get().currentMedia;
      if (media && progress.currentTimeMs > 0) {
        playbackPersistence.recordProgress(media.id, progress.currentTimeMs);
      }
    });

    const unSubTracks = activeAdapter.addListener('tracksChanged', ({ audioTracks, subtitleTracks }) => {
      const selectedAudio = audioTracks.find((t) => t.selected)?.id || null;
      const selectedSub = subtitleTracks.find((t) => t.selected)?.id || null;
      set({
        audioTracks,
        subtitleTracks,
        activeAudioTrackId: selectedAudio,
        activeSubtitleTrackId: selectedSub,
      });
    });

    const unSubErr = activeAdapter.addListener('error', (err: PlayerError) => {
      set({ error: err, state: err.recoverable ? 'recoverableError' : 'fatalError' });
    });

    const unSubComp = activeAdapter.addListener('completed', () => {
      set({ state: 'completed', areControlsVisible: true });
      const media = get().currentMedia;
      if (media) {
        playbackPersistence.saveImmediate(media.id, 0); // Reset position on completion
      }
    });

    unsubscribeEvents.push(unSubState, unSubProg, unSubTracks, unSubErr, unSubComp);
  },

  loadMedia: async (media: MediaItem, resumeFromPosition: boolean = true) => {
    get().init();
    playbackPersistence.setActiveMedia(media.id);

    // Cancel pending seek timers from prior sessions
    if (seekDispatchTimer) {
      clearTimeout(seekDispatchTimer);
      seekDispatchTimer = null;
    }
    if (seekReconciliationTimer) {
      clearTimeout(seekReconciliationTimer);
      seekReconciliationTimer = null;
    }
    authoritativeSeekTargetMs = null;
    wasPlayingBeforeSeek = null;
    wasPlayingBeforeScrub = null;

    // Validate media file
    const validation = validateMediaFile(media);
    if (!validation.isValid) {
      set({
        currentMedia: media,
        state: validation.recoverable ? 'recoverableError' : 'fatalError',
        error: {
          code: validation.errorCode || 'INVALID_MEDIA',
          message: validation.errorMessage || 'Unable to open media file.',
          recoverable: validation.recoverable,
        },
      });
      return;
    }

    // Calculate start position
    let startPos = 0;
    if (resumeFromPosition && media.lastPositionMs > 0) {
      const action = getPlaybackResumeAction(media.durationMs, media.lastPositionMs);
      if (action === 'resume') {
        startPos = media.lastPositionMs;
      }
    }

    set({
      currentMedia: media,
      state: 'loading',
      currentTimeMs: startPos,
      scrubPositionMs: startPos,
      durationMs: media.durationMs || 0,
      bufferedMs: startPos,
      error: null,
      areControlsVisible: true,
      subtitleCues: [],
    });

    try {
      await activeAdapter.load(media.sourceReference, {
        startPositionMs: startPos,
        rate: get().playbackRate,
        autoPlay: true,
      });
      const nativeInstance = (activeAdapter as any).getNativePlayer
        ? (activeAdapter as any).getNativePlayer()
        : null;
      set({ nativePlayer: nativeInstance });
    } catch (err: any) {
      set({
        state: 'fatalError',
        error: {
          code: 'ADAPTER_LOAD_FAILED',
          message: 'Playback engine failed to initialize the file.',
          recoverable: false,
          technicalDetails: String(err),
        },
      });
    }
  },

  play: async () => {
    if (get().isLocked) return;
    if (get().state === 'completed') {
      await get().seekTo(0, true);
    }
    await activeAdapter.play();
    get().showControlsTemporarily(4000);
  },

  pause: async () => {
    if (get().isLocked) return;
    const timer = get().autoHideTimer;
    if (timer) clearTimeout(timer);
    await activeAdapter.pause();
    const media = get().currentMedia;
    if (media) {
      playbackPersistence.saveImmediate(media.id, get().currentTimeMs);
    }
    set({ areControlsVisible: true, autoHideTimer: null });
  },

  togglePlay: async () => {
    if (get().isLocked) return;
    if (isTogglingPlay) return;
    isTogglingPlay = true;
    try {
      const isCurrentlyPlaying = activeAdapter.isPlaying
        ? activeAdapter.isPlaying()
        : get().state === 'playing';

      if (get().state === 'completed') {
        await get().seekTo(0, true);
        await activeAdapter.play();
        get().showControlsTemporarily(4000);
      } else if (isCurrentlyPlaying) {
        await get().pause();
      } else {
        await get().play();
      }
    } finally {
      isTogglingPlay = false;
    }
  },

  seekTo: async (positionMs: number, resumeIfPlaying?: boolean) => {
    if (get().isLocked) return;
    if (seekDispatchTimer) {
      clearTimeout(seekDispatchTimer);
      seekDispatchTimer = null;
    }
    if (seekReconciliationTimer) {
      clearTimeout(seekReconciliationTimer);
      seekReconciliationTimer = null;
    }

    const duration = get().durationMs;
    const clamped = duration > 0 ? clamp(positionMs, 0, duration) : Math.max(0, positionMs);
    const wasPlaying =
      typeof resumeIfPlaying === 'boolean'
        ? resumeIfPlaying
        : wasPlayingBeforeSeek ?? (activeAdapter.isPlaying ? activeAdapter.isPlaying() : get().state === 'playing');

    wasPlayingBeforeSeek = null;
    authoritativeSeekTargetMs = clamped;

    // Immediate optimistic UI update (0ms delay)
    set({ currentTimeMs: clamped, scrubPositionMs: clamped });

    try {
      await activeAdapter.seekTo(clamped, wasPlaying);
    } catch (err) {
      console.warn('seekTo error:', err);
    } finally {
      // Reconcile seek target window: after 400ms, unlock authoritative position
      seekReconciliationTimer = setTimeout(() => {
        if (authoritativeSeekTargetMs === clamped) {
          authoritativeSeekTargetMs = null;
        }
      }, 400);
    }

    const media = get().currentMedia;
    if (media) {
      playbackPersistence.recordProgress(media.id, clamped);
    }
  },

  skipBy: async (seconds: number) => {
    if (get().isLocked) return;
    const duration = get().durationMs;
    const isPlayingNow = activeAdapter.isPlaying
      ? activeAdapter.isPlaying()
      : get().state === 'playing';

    if (wasPlayingBeforeSeek === null) {
      wasPlayingBeforeSeek = isPlayingNow;
    }

    // Authoritative accumulation:
    // If rapid taps occur while a seek is pending, accumulate from latest intended target!
    const basePosition =
      authoritativeSeekTargetMs !== null ? authoritativeSeekTargetMs : get().currentTimeMs;

    const rawTarget = basePosition + seconds * 1000;
    const clampedTarget = duration > 0 ? clamp(rawTarget, 0, duration) : Math.max(0, rawTarget);

    authoritativeSeekTargetMs = clampedTarget;

    // Immediate optimistic UI feedback (0ms delay)
    set({ currentTimeMs: clampedTarget, scrubPositionMs: clampedTarget });
    get().showControlsTemporarily();

    const media = get().currentMedia;
    if (media) {
      playbackPersistence.recordProgress(media.id, clampedTarget);
    }

    // Throttled native seek dispatch with latest-target strategy (debounced by 35ms)
    if (seekDispatchTimer) {
      clearTimeout(seekDispatchTimer);
      seekDispatchTimer = null;
    }

    return new Promise<void>((resolve) => {
      pendingSeekResolvers.push(resolve);
      seekDispatchTimer = setTimeout(async () => {
        seekDispatchTimer = null;
        const resolvers = [...pendingSeekResolvers];
        pendingSeekResolvers = [];

        const targetToExecute = authoritativeSeekTargetMs;
        if (targetToExecute === null) {
          resolvers.forEach((r) => r());
          return;
        }

        const shouldResume = wasPlayingBeforeSeek ?? isPlayingNow;
        wasPlayingBeforeSeek = null;

        try {
          await activeAdapter.seekTo(targetToExecute, shouldResume);
        } catch (err) {
          console.warn('Native seek dispatch error:', err);
        } finally {
          if (seekReconciliationTimer) {
            clearTimeout(seekReconciliationTimer);
          }
          seekReconciliationTimer = setTimeout(() => {
            if (authoritativeSeekTargetMs === targetToExecute) {
              authoritativeSeekTargetMs = null;
            }
          }, 400);
          resolvers.forEach((r) => r());
        }
      }, 35);
    });
  },

  startScrubbing: () => {
    if (get().isLocked) return;
    if (seekDispatchTimer) {
      clearTimeout(seekDispatchTimer);
      seekDispatchTimer = null;
      const resolvers = [...pendingSeekResolvers];
      pendingSeekResolvers = [];
      resolvers.forEach((r) => r());
    }
    wasPlayingBeforeScrub =
      get().state === 'playing' || (activeAdapter.isPlaying ? activeAdapter.isPlaying() : false);
    const timer = get().autoHideTimer;
    if (timer) clearTimeout(timer);
    set({ isScrubbing: true, scrubPositionMs: get().currentTimeMs, areControlsVisible: true, autoHideTimer: null });
  },

  moveScrubbing: (positionMs: number) => {
    if (get().isLocked) return;
    const duration = get().durationMs;
    const clamped = duration > 0 ? clamp(positionMs, 0, duration) : Math.max(0, positionMs);
    set({ scrubPositionMs: clamped, currentTimeMs: clamped, areControlsVisible: true });
  },

  endScrubbing: async (positionMs: number) => {
    if (get().isLocked) return;
    if (!get().isScrubbing) {
      return;
    }
    const duration = get().durationMs;
    const clamped = duration > 0 ? clamp(positionMs, 0, duration) : Math.max(0, positionMs);
    const shouldResume =
      wasPlayingBeforeScrub ??
      (get().state === 'playing' || (activeAdapter.isPlaying ? activeAdapter.isPlaying() : false));
    wasPlayingBeforeScrub = null;
    set({ isScrubbing: false, currentTimeMs: clamped, scrubPositionMs: clamped });
    await get().seekTo(clamped, shouldResume);
    if (shouldResume) {
      get().showControlsTemporarily(4000);
    } else {
      set({ areControlsVisible: true, autoHideTimer: null });
    }
  },

  setOrientationMode: (mode: 'auto' | 'portrait' | 'landscape') => {
    set({ orientationMode: mode });
  },

  cycleOrientationMode: () => {
    const modes: ('auto' | 'landscape' | 'portrait')[] = ['auto', 'landscape', 'portrait'];
    const current = get().orientationMode;
    const nextIndex = (modes.indexOf(current) + 1) % modes.length;
    const next = modes[nextIndex];
    set({ orientationMode: next });
    get().showControlsTemporarily(4000);
    return next;
  },

  toggleOrientation: () => {
    const current = get().orientationMode;
    const next = current === 'landscape' ? 'portrait' : 'landscape';
    set({ orientationMode: next });
    get().showControlsTemporarily(4000);
    return next;
  },

  setPlaybackRate: async (rate: number) => {
    if (get().isLocked) return;
    const safeRate = clamp(rate, 0.25, 3.0);
    set({ playbackRate: safeRate });
    await activeAdapter.setRate(safeRate);
    get().showControlsTemporarily(4000);
  },

  setVolume: async (vol: number) => {
    if (get().isLocked) return;
    const safeVol = clamp(vol, 0.0, 1.0);
    set({ volume: safeVol });
    await activeAdapter.setVolume(safeVol);
  },

  setBrightness: async (bright: number) => {
    if (get().isLocked) return;
    const safeBright = clamp(bright, 0.0, 1.0);
    set({ brightness: safeBright });
    try {
      if (BrightnessModule?.setBrightnessAsync) {
        await BrightnessModule.setBrightnessAsync(safeBright);
      }
    } catch (e) {}
  },

  setAspectRatio: async (mode: AspectRatioMode) => {
    if (get().isLocked) return;
    set({ aspectRatio: mode });
    await activeAdapter.setAspectRatio(mode);
    get().showControlsTemporarily(4000);
  },

  toggleLock: () => {
    const nextLocked = !get().isLocked;
    const existing = get().autoHideTimer;
    if (existing) {
      clearTimeout(existing);
    }
    set({ isLocked: nextLocked, autoHideTimer: null });
    if (nextLocked) {
      set({ areControlsVisible: false });
    } else {
      get().showControlsTemporarily(4000);
    }
  },

  toggleControls: () => {
    if (get().isLocked) return;
    const nextVisible = !get().areControlsVisible;
    if (nextVisible) {
      get().showControlsTemporarily(4000);
    } else {
      get().hideControls();
    }
  },

  hideControls: () => {
    if (get().isLocked) return;
    const timer = get().autoHideTimer;
    if (timer) clearTimeout(timer);
    set({ areControlsVisible: false, autoHideTimer: null });
  },

  showControlsTemporarily: (durationMs: number = 4000) => {
    if (get().isLocked) return;
    const existing = get().autoHideTimer;
    if (existing) clearTimeout(existing);

    // If paused or currently scrubbing, keep controls visible indefinitely without an auto-hide timer
    if (get().state === 'paused' || get().isScrubbing) {
      set({ areControlsVisible: true, autoHideTimer: null });
      return;
    }

    const newTimer = setTimeout(() => {
      if (!get().isScrubbing && !get().isLocked && get().state !== 'paused') {
        set({ areControlsVisible: false, autoHideTimer: null });
      }
    }, durationMs);

    if (newTimer && typeof (newTimer as any).unref === 'function') {
      (newTimer as any).unref();
    }

    set({ areControlsVisible: true, autoHideTimer: newTimer });
  },

  setAudioTrack: async (trackId: string) => {
    if (get().isLocked) return;
    set({ activeAudioTrackId: trackId });
    await activeAdapter.setAudioTrack(trackId);
  },

  setSubtitleTrack: async (trackId: string | null) => {
    if (get().isLocked) return;
    set({ activeSubtitleTrackId: trackId });
    await activeAdapter.setSubtitleTrack(trackId);
  },

  loadExternalSubtitleText: async (text: string, filename?: string) => {
    if (get().isLocked) return;
    const cues = parseSubtitleFile(text, filename);
    set({ subtitleCues: cues, activeSubtitleTrackId: 'external_custom' });
  },

  setSubtitleDelay: async (ms: number) => {
    if (get().isLocked) return;
    set({ subtitleDelayMs: ms });
    await activeAdapter.setSubtitleDelay(ms);
  },

  setAudioDelay: async (ms: number) => {
    if (get().isLocked) return;
    set({ audioDelayMs: ms });
    await activeAdapter.setAudioDelay(ms);
  },

  dismissError: () => {
    set({ error: null });
  },

  setQueue: (items: MediaItem[], startIndex: number = 0) => {
    const validItems = items || [];
    const validIndex = validItems.length > 0 ? Math.max(0, Math.min(startIndex, validItems.length - 1)) : -1;
    set({ queue: validItems, queueIndex: validIndex });
  },

  playNext: async () => {
    if (get().isLocked) return;
    if (isSwitchingMedia) return;
    const { queue, queueIndex } = get();
    if (!queue || queue.length === 0 || queueIndex < 0 || queueIndex + 1 >= queue.length) {
      return;
    }
    isSwitchingMedia = true;
    try {
      const nextIndex = queueIndex + 1;
      const nextMedia = queue[nextIndex];
      set({ queueIndex: nextIndex });

      // Stop current playback immediately
      try {
        await activeAdapter.pause();
      } catch (_) {}

      if (seekDispatchTimer) {
        clearTimeout(seekDispatchTimer);
        seekDispatchTimer = null;
      }
      if (seekReconciliationTimer) {
        clearTimeout(seekReconciliationTimer);
        seekReconciliationTimer = null;
      }
      authoritativeSeekTargetMs = null;
      wasPlayingBeforeSeek = null;
      wasPlayingBeforeScrub = null;

      await get().loadMedia(nextMedia, true);
      get().showControlsTemporarily(4000);
    } finally {
      isSwitchingMedia = false;
    }
  },

  playPrevious: async () => {
    if (get().isLocked) return;
    if (isSwitchingMedia) return;
    const { queue, queueIndex, currentTimeMs } = get();

    // Standard media player UX: If past 3 seconds, restart current track
    if (currentTimeMs > 3000) {
      await get().seekTo(0);
      get().showControlsTemporarily(4000);
      return;
    }

    if (!queue || queue.length === 0 || queueIndex <= 0) {
      await get().seekTo(0);
      get().showControlsTemporarily(4000);
      return;
    }

    isSwitchingMedia = true;
    try {
      const prevIndex = queueIndex - 1;
      const prevMedia = queue[prevIndex];
      set({ queueIndex: prevIndex });

      // Stop current playback immediately
      try {
        await activeAdapter.pause();
      } catch (_) {}

      if (seekDispatchTimer) {
        clearTimeout(seekDispatchTimer);
        seekDispatchTimer = null;
      }
      if (seekReconciliationTimer) {
        clearTimeout(seekReconciliationTimer);
        seekReconciliationTimer = null;
      }
      authoritativeSeekTargetMs = null;
      wasPlayingBeforeSeek = null;
      wasPlayingBeforeScrub = null;

      await get().loadMedia(prevMedia, true);
      get().showControlsTemporarily(4000);
    } finally {
      isSwitchingMedia = false;
    }
  },

  reset: async () => {
    if (seekDispatchTimer) {
      clearTimeout(seekDispatchTimer);
      seekDispatchTimer = null;
    }
    const resolvers = [...pendingSeekResolvers];
    pendingSeekResolvers = [];
    resolvers.forEach((r) => r());

    if (seekReconciliationTimer) {
      clearTimeout(seekReconciliationTimer);
      seekReconciliationTimer = null;
    }
    authoritativeSeekTargetMs = null;
    wasPlayingBeforeSeek = null;
    wasPlayingBeforeScrub = null;
    isSwitchingMedia = false;

    const timer = get().autoHideTimer;
    if (timer) clearTimeout(timer);

    const media = get().currentMedia;
    if (media && get().currentTimeMs > 0) {
      playbackPersistence.saveImmediate(media.id, get().currentTimeMs);
    }
    playbackPersistence.setActiveMedia(null);

    // Stop native playback immediately and release
    try {
      await activeAdapter.pause();
    } catch (_) {}
    await activeAdapter.dispose();

    set({
      state: 'idle',
      currentMedia: null,
      nativePlayer: null,
      currentTimeMs: 0,
      durationMs: 0,
      bufferedMs: 0,
      playbackRate: 1.0,
      volume: 1.0,
      brightness: 0.5,
      isLocked: false,
      areControlsVisible: true,
      error: null,
      subtitleCues: [],
      isScrubbing: false,
      scrubPositionMs: 0,
    });
  },
}));
