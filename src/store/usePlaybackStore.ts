import { create } from 'zustand';
import { MediaItem, AspectRatioMode } from '../types/media';
import {
  PlayerState,
  PlaybackProgress,
  AudioTrack,
  SubtitleTrack,
  SubtitleCue,
  PlayerError,
  PendingSeek,
  SeekDiagnosticEvent,
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
  isSeeking: boolean;
  previewPositionMs: number | null;
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
  getLastSeekDiagnostic: () => SeekDiagnosticEvent | null;
  getActiveSeek: () => PendingSeek | null;
}

let activeAdapter: IPlayerAdapter = getDefaultPlayerAdapter();
let unsubscribeEvents: (() => void)[] = [];
let activeSeekSession = 0;
let seekRequestIdCounter = 0;
let authoritativeSeekTargetMs: number | null = null;
let activeSeek: PendingSeek | null = null;
let lastSeekDiagnostic: SeekDiagnosticEvent | null = null;
let seekDispatchTimer: ReturnType<typeof setTimeout> | null = null;
let seekWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSeekResolvers: Array<() => void> = [];
let seekPlaybackIntent: boolean | null = null;
let wasPlayingBeforeScrub: boolean | null = null;
let isTogglingPlay = false;
let isSwitchingMedia = false;

const clearPendingSeekTimers = () => {
  if (seekDispatchTimer) {
    clearTimeout(seekDispatchTimer);
    seekDispatchTimer = null;
  }
  if (seekWatchdogTimer) {
    clearTimeout(seekWatchdogTimer);
    seekWatchdogTimer = null;
  }
  activeSeek = null;
  const resolvers = [...pendingSeekResolvers];
  pendingSeekResolvers = [];
  resolvers.forEach((r) => r());
};

const finalizeSeek = (
  sessionId: number,
  requestId: number,
  actualPositionMs: number,
  shouldResume: boolean,
  set: (partial: Partial<PlaybackState> | ((state: PlaybackState) => Partial<PlaybackState>)) => void,
  get: () => PlaybackState,
  options?: { isTimeout?: boolean; isError?: boolean }
) => {
  if (activeSeekSession !== sessionId || (activeSeek && activeSeek.requestId !== requestId)) {
    return; // Stale session or request, ignore
  }
  if (seekWatchdogTimer) {
    clearTimeout(seekWatchdogTimer);
    seekWatchdogTimer = null;
  }

  const completedAt = Date.now();
  const targetMs = authoritativeSeekTargetMs ?? (activeSeek?.targetPositionMs ?? actualPositionMs);
  const posDiff = Math.abs(actualPositionMs - targetMs);
  const reachedTarget =
    posDiff <= 1500 ||
    (targetMs === 0 && actualPositionMs <= 1000) ||
    (get().durationMs > 0 && targetMs >= get().durationMs - 500 && actualPositionMs >= get().durationMs - 1000);

  const isFailedOrTimeout = options?.isError || (options?.isTimeout && !reachedTarget);

  if (lastSeekDiagnostic && lastSeekDiagnostic.requestId === requestId) {
    lastSeekDiagnostic.nativeSeekCompletedAt = completedAt;
    lastSeekDiagnostic.actualPositionAfterSeekMs = actualPositionMs;
    lastSeekDiagnostic.firstFrameAfterSeekAt = null; // Do NOT fabricate
    lastSeekDiagnostic.seekCompleted = !isFailedOrTimeout;
    lastSeekDiagnostic.playbackState = shouldResume ? 'playing' : 'paused';
    lastSeekDiagnostic.status = isFailedOrTimeout
      ? options?.isError
        ? 'failed'
        : 'timedOut'
      : 'acknowledged';
    if (options?.isTimeout) {
      lastSeekDiagnostic.watchdogTriggered = true;
    }
  }

  activeSeek = null;
  authoritativeSeekTargetMs = null;
  seekPlaybackIntent = null;

  if (isFailedOrTimeout) {
    // Seek timed out or failed without reaching target!
    // Clear preview/seeking, keep currentTimeMs at actual native position where player actually stayed
    set({
      isSeeking: false,
      previewPositionMs: null,
      currentTimeMs: actualPositionMs,
      scrubPositionMs: actualPositionMs,
    });
    return;
  }

  const currentState = get().state;
  if (shouldResume && currentState !== 'completed') {
    activeAdapter.play().catch(() => {});
    set({
      isSeeking: false,
      previewPositionMs: null,
      currentTimeMs: actualPositionMs,
      scrubPositionMs: actualPositionMs,
      state: 'playing',
    });
  } else {
    if (currentState !== 'completed') {
      activeAdapter.pause().catch(() => {});
      set({
        isSeeking: false,
        previewPositionMs: null,
        currentTimeMs: actualPositionMs,
        scrubPositionMs: actualPositionMs,
        state: 'paused',
      });
    } else {
      set({
        isSeeking: false,
        previewPositionMs: null,
        currentTimeMs: actualPositionMs,
        scrubPositionMs: actualPositionMs,
      });
    }
  }

  const media = get().currentMedia;
  if (media && actualPositionMs > 0) {
    playbackPersistence.recordProgress(media.id, actualPositionMs);
  }
};

const executeCentralSeek = async (
  targetMs: number,
  resumeIfPlaying: boolean | undefined,
  set: (partial: Partial<PlaybackState> | ((state: PlaybackState) => Partial<PlaybackState>)) => void,
  get: () => PlaybackState,
  immediate: boolean = false
): Promise<void> => {
  const duration = get().durationMs;
  const clampedTarget = duration > 0 ? clamp(targetMs, 0, duration) : Math.max(0, targetMs);

  const isPlayingNow =
    get().state === 'playing' ||
    (typeof activeAdapter.isPlaying === 'function' ? activeAdapter.isPlaying() : false);
  const shouldResume =
    typeof resumeIfPlaying === 'boolean'
      ? resumeIfPlaying
      : seekPlaybackIntent !== null
      ? seekPlaybackIntent
      : isPlayingNow;

  seekPlaybackIntent = shouldResume;
  authoritativeSeekTargetMs = clampedTarget;

  const previousPositionMs = get().currentTimeMs;
  const diff = clampedTarget - previousPositionMs;
  let direction: 'forward' | 'backward' | 'stationary' = 'stationary';
  if (diff > 50) direction = 'forward';
  else if (diff < -50) direction = 'backward';

  const requestId = ++seekRequestIdCounter;
  const sessionId = ++activeSeekSession;

  activeSeek = {
    requestId,
    sessionId,
    targetPositionMs: clampedTarget,
    previousPositionMs,
    direction,
    wasPlaying: shouldResume,
    requestedAt: Date.now(),
    status: 'pending',
  };

  lastSeekDiagnostic = {
    requestId,
    sessionId,
    mediaId: get().currentMedia?.id || null,
    requestedPositionMs: targetMs,
    safeTargetPositionMs: clampedTarget,
    previousNativePositionMs: previousPositionMs,
    seekDirection: direction,
    wasPlayingBeforeSeek: shouldResume,
    seekRequestedAt: activeSeek.requestedAt,
    nativeSeekCompletedAt: null,
    actualPositionAfterSeekMs: null,
    firstFrameAfterSeekAt: null,
    isBuffering: get().state === 'buffering',
    playbackState: get().state,
    watchdogTriggered: false,
    seekCompleted: false,
    status: 'pending',
  };

  // Revive from completed state if seeking before duration
  const isCompleted = get().state === 'completed';
  const revivedState =
    isCompleted && clampedTarget < duration ? (shouldResume ? 'playing' : 'paused') : undefined;

  // Immediate optimistic UI preview feedback (0ms delay) - never overwrite currentTimeMs during seek
  set({
    isSeeking: true,
    previewPositionMs: clampedTarget,
    scrubPositionMs: clampedTarget,
    ...(revivedState ? { state: revivedState } : {}),
  });

  const media = get().currentMedia;
  if (media) {
    playbackPersistence.recordProgress(media.id, clampedTarget);
  }

  // Clear any existing debounce timer
  if (seekDispatchTimer) {
    clearTimeout(seekDispatchTimer);
    seekDispatchTimer = null;
  }

  const dispatchNative = async () => {
    const targetToExecute = authoritativeSeekTargetMs;
    const resumeToExecute = seekPlaybackIntent ?? shouldResume;
    if (targetToExecute === null) {
      const resolvers = [...pendingSeekResolvers];
      pendingSeekResolvers = [];
      resolvers.forEach((r) => r());
      return;
    }

    // 1200ms watchdog timer: guarantees recovery if native events fail or are omitted
    if (seekWatchdogTimer) {
      clearTimeout(seekWatchdogTimer);
    }
    seekWatchdogTimer = setTimeout(() => {
      if (
        activeSeek &&
        activeSeek.requestId === requestId &&
        activeSeek.sessionId === sessionId &&
        get().isSeeking
      ) {
        console.log(
          `[PlaybackStore] Seek watchdog timeout fired at 1200ms for req ${requestId}, sess ${sessionId}, target=${targetToExecute}ms`
        );
        const currentAdapterPos =
          typeof (activeAdapter as any).getProgress === 'function'
            ? (activeAdapter as any).getProgress().currentTimeMs
            : get().currentTimeMs;
        const currentResume = seekPlaybackIntent ?? activeSeek.wasPlaying;
        finalizeSeek(sessionId, requestId, currentAdapterPos, currentResume, set, get, { isTimeout: true });
      }
    }, 1200);

    try {
      await activeAdapter.seekTo(targetToExecute, resumeToExecute);
      const currentAdapterPos =
        typeof (activeAdapter as any).getProgress === 'function'
          ? (activeAdapter as any).getProgress().currentTimeMs
          : get().currentTimeMs;
      const currentResume = seekPlaybackIntent ?? activeSeek?.wasPlaying ?? shouldResume;
      if (
        activeSeek &&
        activeSeek.requestId === requestId &&
        Math.abs(currentAdapterPos - targetToExecute) <= 1500 &&
        get().isSeeking
      ) {
        finalizeSeek(sessionId, requestId, currentAdapterPos, currentResume, set, get);
      }
    } catch (err) {
      console.warn('[PlaybackStore] native seekTo error:', err);
    } finally {
      const resolvers = [...pendingSeekResolvers];
      pendingSeekResolvers = [];
      resolvers.forEach((r) => r());
    }
  };

  if (immediate) {
    return dispatchNative();
  }

  return new Promise<void>((resolve) => {
    pendingSeekResolvers.push(resolve);
    seekDispatchTimer = setTimeout(() => {
      seekDispatchTimer = null;
      dispatchNative();
    }, 35);
  });
};

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
  isSeeking: false,
  previewPositionMs: null,
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
      const prevState = get().state;
      // If native player transitions to ready or playing while seek is pending, verify position before finalizing
      if ((currentState === 'ready' || currentState === 'playing') && activeSeek !== null) {
        const currentPos = activeAdapter.getProgress().currentTimeMs;
        const target = activeSeek.targetPositionMs;
        const diff = Math.abs(currentPos - target);
        if (diff <= 1500 || (target === 0 && currentPos <= 1000)) {
          finalizeSeek(
            activeSeek.sessionId,
            activeSeek.requestId,
            currentPos,
            seekPlaybackIntent ?? (currentState === 'playing'),
            set,
            get
          );
        }
      }
      set({ state: currentState });
      if (
        currentState === 'playing' &&
        prevState !== 'playing' &&
        authoritativeSeekTargetMs === null &&
        !get().isSeeking
      ) {
        get().showControlsTemporarily();
      }
    });

    const unSubProg = activeAdapter.addListener('progress', (progress: PlaybackProgress) => {
      if (!get().currentMedia || get().state === 'idle') {
        return;
      }

      // 1. While user is actively dragging the scrubber slider, never overwrite finger position
      if (get().isScrubbing) {
        set({
          durationMs: progress.durationMs,
          bufferedMs: progress.bufferedPositionMs,
        });
        return;
      }

      // 2. While a seek is pending, check direction-aware acknowledgment
      if (activeSeek !== null && authoritativeSeekTargetMs !== null) {
        const currentMs = progress.currentTimeMs;
        const targetMs = activeSeek.targetPositionMs;
        const previousMs = activeSeek.previousPositionMs;
        const direction = activeSeek.direction;
        const durationMs = progress.durationMs;

        let isAcknowledged = false;
        let isStale = false;

        if (direction === 'backward') {
          // Target is less than previous (T < P)
          // Any update still at or above previousPositionMs (or > target + 1200) is stale pre-seek
          if (currentMs > targetMs + 1200) {
            isStale = true;
          } else if (Math.abs(currentMs - targetMs) <= 1200) {
            isAcknowledged = true;
          } else if (
            activeSeek.wasPlaying &&
            currentMs >= targetMs - 500 &&
            currentMs <= targetMs + 2500 &&
            currentMs < previousMs - 500
          ) {
            // Jumped backward below previous position and advancing from target
            isAcknowledged = true;
          } else if (targetMs === 0 && currentMs <= 1000) {
            isAcknowledged = true;
          }
        } else if (direction === 'forward') {
          // Target is greater than previous (T > P)
          // Any update still near or below previousPositionMs when target is significantly ahead is stale pre-seek
          if (targetMs > previousMs + 1000 && currentMs < previousMs + 500) {
            isStale = true;
          } else if (Math.abs(currentMs - targetMs) <= 1200) {
            isAcknowledged = true;
          } else if (
            activeSeek.wasPlaying &&
            currentMs >= targetMs - 1200 &&
            currentMs <= targetMs + 3000
          ) {
            isAcknowledged = true;
          } else if (durationMs > 0 && targetMs >= durationMs - 500 && currentMs >= durationMs - 1000) {
            isAcknowledged = true;
          }
        } else {
          // Stationary (T ≈ P)
          if (Math.abs(currentMs - targetMs) <= 1200) {
            isAcknowledged = true;
          }
        }

        if (isStale && !isAcknowledged) {
          // Reject stale pre-seek time updates so UI never jumps backward
          set({
            durationMs: progress.durationMs,
            bufferedMs: Math.max(progress.bufferedPositionMs, get().currentTimeMs),
          });
          return;
        }

        if (isAcknowledged) {
          const session = activeSeek.sessionId;
          const reqId = activeSeek.requestId;
          const resume = seekPlaybackIntent ?? activeSeek.wasPlaying;
          finalizeSeek(session, reqId, currentMs, resume, set, get);
        } else {
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
      clearPendingSeekTimers();
      authoritativeSeekTargetMs = null;
      seekPlaybackIntent = null;
      set({
        state: 'completed',
        isSeeking: false,
        isScrubbing: false,
        previewPositionMs: null,
        areControlsVisible: true,
      });
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

    // Cancel pending seek timers and increment session to invalidate prior in-flight seeks
    activeSeekSession++;
    clearPendingSeekTimers();
    authoritativeSeekTargetMs = null;
    seekPlaybackIntent = null;
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
      isSeeking: false,
      isScrubbing: false,
      previewPositionMs: null,
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
    seekPlaybackIntent = true;
    if (activeSeek) {
      activeSeek.wasPlaying = true;
    }
    await activeAdapter.play();
    get().showControlsTemporarily(4000);
  },

  pause: async () => {
    if (get().isLocked) return;
    const timer = get().autoHideTimer;
    if (timer) clearTimeout(timer);

    // Reconcile playback intent if paused while seek is pending
    seekPlaybackIntent = false;
    if (activeSeek) {
      activeSeek.wasPlaying = false;
    }

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
      if (get().isSeeking) {
        // User toggled play while seek was in-flight
        const currentIntent = seekPlaybackIntent ?? (get().state === 'playing');
        const newIntent = !currentIntent;
        seekPlaybackIntent = newIntent;
        if (activeSeek) {
          activeSeek.wasPlaying = newIntent;
        }
        if (!newIntent) {
          await activeAdapter.pause();
          set({ state: 'paused' });
        } else {
          await activeAdapter.play();
          set({ state: 'playing' });
        }
        return;
      }

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
    await executeCentralSeek(positionMs, resumeIfPlaying, set, get, true);
  },

  skipBy: async (seconds: number) => {
    if (get().isLocked) return;
    // Authoritative accumulation:
    // If rapid taps occur while a seek is pending or scrubbing, accumulate from latest intended target!
    const basePosition =
      authoritativeSeekTargetMs !== null
        ? authoritativeSeekTargetMs
        : (get().previewPositionMs ?? get().currentTimeMs);

    const targetMs = basePosition + seconds * 1000;
    get().showControlsTemporarily(4000);
    await executeCentralSeek(targetMs, undefined, set, get, false);
  },

  startScrubbing: () => {
    if (get().isLocked) return;
    // Cancel pending seek timers and clear authoritative target so scrubber takes priority
    clearPendingSeekTimers();
    authoritativeSeekTargetMs = null;
    wasPlayingBeforeScrub =
      get().state === 'playing' || (activeAdapter.isPlaying ? activeAdapter.isPlaying() : false);
    if (typeof activeAdapter.setScrubbing === 'function') {
      activeAdapter.setScrubbing(true);
    }
    const timer = get().autoHideTimer;
    if (timer) clearTimeout(timer);
    set({
      isScrubbing: true,
      scrubPositionMs: get().currentTimeMs,
      previewPositionMs: get().currentTimeMs,
      areControlsVisible: true,
      autoHideTimer: null,
    });
  },

  moveScrubbing: (positionMs: number) => {
    if (get().isLocked) return;
    const duration = get().durationMs;
    const clamped = duration > 0 ? clamp(positionMs, 0, duration) : Math.max(0, positionMs);
    set({
      scrubPositionMs: clamped,
      previewPositionMs: clamped,
      areControlsVisible: true,
    });
  },

  endScrubbing: async (positionMs: number) => {
    if (get().isLocked) return;
    if (!get().isScrubbing) {
      return;
    }
    if (typeof activeAdapter.setScrubbing === 'function') {
      activeAdapter.setScrubbing(false);
    }
    const shouldResume =
      wasPlayingBeforeScrub ??
      (get().state === 'playing' || (activeAdapter.isPlaying ? activeAdapter.isPlaying() : false));
    wasPlayingBeforeScrub = null;
    set({ isScrubbing: false });
    await get().seekTo(positionMs, shouldResume);
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

      activeSeekSession++;
      clearPendingSeekTimers();
      authoritativeSeekTargetMs = null;
      seekPlaybackIntent = null;
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

      activeSeekSession++;
      clearPendingSeekTimers();
      authoritativeSeekTargetMs = null;
      seekPlaybackIntent = null;
      wasPlayingBeforeScrub = null;

      await get().loadMedia(prevMedia, true);
      get().showControlsTemporarily(4000);
    } finally {
      isSwitchingMedia = false;
    }
  },

  reset: async () => {
    activeSeekSession++;
    clearPendingSeekTimers();
    authoritativeSeekTargetMs = null;
    seekPlaybackIntent = null;
    wasPlayingBeforeScrub = null;
    isSwitchingMedia = false;

    const timer = get().autoHideTimer;
    if (timer) clearTimeout(timer);

    const media = get().currentMedia;
    if (media && get().currentTimeMs > 0) {
      playbackPersistence.saveImmediate(media.id, get().currentTimeMs);
    }
    playbackPersistence.setActiveMedia(null);

    try {
      if (typeof activeAdapter.pause === 'function') {
        await activeAdapter.pause();
      }
    } catch (_) {}
    try {
      if (typeof activeAdapter.dispose === 'function') {
        await activeAdapter.dispose();
      }
    } catch (_) {}

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
      isSeeking: false,
      previewPositionMs: null,
    });
  },

  getLastSeekDiagnostic: () => lastSeekDiagnostic,
  getActiveSeek: () => activeSeek,
}));
