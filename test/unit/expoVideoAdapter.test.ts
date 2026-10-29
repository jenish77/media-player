import { ExpoVideoAdapter } from '../../src/native/player/ExpoVideoAdapter';

describe('ExpoVideoAdapter Seek Lifecycle & ReconcileSeek Unit Tests', () => {
  let adapter: ExpoVideoAdapter;
  let mockNativePlayer: any;
  let listeners: Record<string, Function[]> = {};

  let simulatedCurrentTime = 10;
  let lockCurrentTime = false;

  beforeEach(() => {
    listeners = {};
    simulatedCurrentTime = 10;
    lockCurrentTime = false;
    mockNativePlayer = {
      get currentTime() {
        return simulatedCurrentTime;
      },
      set currentTime(val: number) {
        if (!lockCurrentTime) {
          simulatedCurrentTime = val;
        }
      },
      duration: 180,
      playing: true,
      status: 'readyToPlay',
      addListener: jest.fn().mockImplementation((event: string, callback: Function) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
        return {
          remove: () => {
            listeners[event] = (listeners[event] || []).filter((cb) => cb !== callback);
          },
        };
      }),
      play: jest.fn().mockImplementation(() => {
        mockNativePlayer.playing = true;
      }),
      pause: jest.fn().mockImplementation(() => {
        mockNativePlayer.playing = false;
      }),
      release: jest.fn(),
    };

    adapter = new ExpoVideoAdapter();
    (adapter as any).player = mockNativePlayer;
    (adapter as any).sessionToken = 1;
    (adapter as any).progress.durationMs = 180000;
    (adapter as any).progress.currentTimeMs = 10000;
    (adapter as any).setupNativeListeners(1);
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  it('1. Backward seek initializes PendingSeek with status=pending and direction=backward', async () => {
    await adapter.seekTo(5000, true);

    const activeSeek = adapter.getActiveSeek();
    expect(activeSeek).not.toBeNull();
    expect(activeSeek?.targetPositionMs).toBe(5000);
    expect(activeSeek?.previousPositionMs).toBe(10000);
    expect(activeSeek?.direction).toBe('backward');
    expect(activeSeek?.status).toBe('pending');
    expect(activeSeek?.wasPlaying).toBe(true);

    const diagnostic = adapter.getLastSeekDiagnostic();
    expect(diagnostic?.status).toBe('pending');
    expect(diagnostic?.firstFrameAfterSeekAt).toBeNull();
  });

  it('2. Direction-aware backward seek rejects stale pre-seek timeUpdates and acknowledges at target', async () => {
    await adapter.seekTo(4000, true);
    expect(adapter.getActiveSeek()?.status).toBe('pending');

    // Simulate stale pre-seek timeUpdate still at 10s (target is 4s, diff is 6s > 1000ms)
    const timeListeners = listeners['timeUpdate'] || [];
    timeListeners.forEach((cb) => cb({ currentTime: 10, bufferedPosition: 12 }));

    // Seek MUST remain active and pending!
    expect(adapter.getActiveSeek()?.status).toBe('pending');

    // Simulate timeUpdate at target (4.2s)
    timeListeners.forEach((cb) => cb({ currentTime: 4.2, bufferedPosition: 6 }));

    // Seek is now acknowledged!
    expect(adapter.getActiveSeek()).toBeNull();
    const diagnostic = adapter.getLastSeekDiagnostic();
    expect(diagnostic?.seekCompleted).toBe(true);
    expect(diagnostic?.status).toBe('acknowledged');
    expect(diagnostic?.actualPositionAfterSeekMs).toBe(4200);
    expect(diagnostic?.firstFrameAfterSeekAt).toBeNull(); // Never fabricated
    expect(mockNativePlayer.play).toHaveBeenCalled();
  });

  it('3. User pause while seek is pending updates wasPlaying intent and stays paused upon seek completion', async () => {
    await adapter.seekTo(30000, true);
    expect(adapter.getActiveSeek()?.wasPlaying).toBe(true);

    // User pauses while seek is in flight
    await adapter.pause();
    expect(adapter.getActiveSeek()?.wasPlaying).toBe(false);

    // Simulate native seek acknowledgment via timeUpdate
    const timeListeners = listeners['timeUpdate'] || [];
    timeListeners.forEach((cb) => cb({ currentTime: 30, bufferedPosition: 35 }));

    expect(adapter.getActiveSeek()).toBeNull();
    expect(adapter.getState()).toBe('paused');
    expect(mockNativePlayer.pause).toHaveBeenCalled();
  });

  it('4. Watchdog marks failed without forcing play when native player is stuck at old position', () => {
    jest.useFakeTimers();

    lockCurrentTime = true;
    simulatedCurrentTime = 10;
    adapter.seekTo(90000, false);
    expect(adapter.getActiveSeek()?.status).toBe('pending');

    // Advance 1250ms past watchdog
    jest.advanceTimersByTime(1250);

    expect(adapter.getActiveSeek()).toBeNull();
    const diagnostic = adapter.getLastSeekDiagnostic();
    expect(diagnostic?.watchdogTriggered).toBe(true);
    expect(diagnostic?.seekCompleted).toBe(false);
    expect(diagnostic?.status).toBe('failed');
    expect(diagnostic?.actualPositionAfterSeekMs).toBe(10000);

    jest.useRealTimers();
  });

  it('5. Watchdog marks timedOut and preserves buffering state when player is loading/buffering', () => {
    jest.useFakeTimers();

    lockCurrentTime = true;
    simulatedCurrentTime = 10;
    mockNativePlayer.status = 'loading';
    adapter.seekTo(90000, false);

    jest.advanceTimersByTime(1250);

    expect(adapter.getActiveSeek()).toBeNull();
    const diagnostic = adapter.getLastSeekDiagnostic();
    expect(diagnostic?.watchdogTriggered).toBe(true);
    expect(diagnostic?.seekCompleted).toBe(false);
    expect(diagnostic?.status).toBe('timedOut');
    expect(diagnostic?.isBuffering).toBe(true);
    expect(adapter.getState()).toBe('buffering');

    jest.useRealTimers();
  });

  it('6. Watchdog acknowledges seek if native player reached target within tolerance', () => {
    jest.useFakeTimers();

    lockCurrentTime = true;
    simulatedCurrentTime = 50.2; // 50,200ms
    adapter.seekTo(50000, false);

    jest.advanceTimersByTime(1250);

    expect(adapter.getActiveSeek()).toBeNull();
    const diagnostic = adapter.getLastSeekDiagnostic();
    expect(diagnostic?.watchdogTriggered).toBe(true);
    expect(diagnostic?.seekCompleted).toBe(true);
    expect(diagnostic?.status).toBe('acknowledged');
    expect(diagnostic?.actualPositionAfterSeekMs).toBe(50200);

    jest.useRealTimers();
  });

  it('7. playToEnd reconciles seek cleanly to durationMs', () => {
    adapter.seekTo(179000, true);
    expect(adapter.getActiveSeek()?.status).toBe('pending');

    const endListeners = listeners['playToEnd'] || [];
    endListeners.forEach((cb) => cb());

    expect(adapter.getActiveSeek()).toBeNull();
    expect(adapter.getState()).toBe('completed');
    const diagnostic = adapter.getLastSeekDiagnostic();
    expect(diagnostic?.seekCompleted).toBe(true);
    expect(diagnostic?.status).toBe('acknowledged');
    expect(diagnostic?.actualPositionAfterSeekMs).toBe(180000);
  });
});
