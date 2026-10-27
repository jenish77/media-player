import { MockPlayerAdapter } from '../../src/native/player/MockPlayerAdapter';
import { PlayerState } from '../../src/types/player';

describe('Playback State Machine & MockPlayerAdapter', () => {
  let adapter: MockPlayerAdapter;

  beforeEach(() => {
    adapter = new MockPlayerAdapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  it('initializes in idle state', () => {
    expect(adapter.getState()).toBe('idle');
    expect(adapter.getCurrentSource()).toBeNull();
  });

  it('transitions from idle -> loading -> ready on load', async () => {
    const states: PlayerState[] = [];
    adapter.addListener('stateChange', ({ currentState }) => {
      states.push(currentState);
    });

    await adapter.load('file:///storage/video.mp4', { startPositionMs: 0 });

    expect(states).toContain('loading');
    expect(states).toContain('ready');
    expect(adapter.getState()).toBe('ready');
    expect(adapter.getCurrentSource()).toBe('file:///storage/video.mp4');
  });

  it('increments session token on each load', async () => {
    expect(adapter.getSessionToken()).toBe(0);
    await adapter.load('file:///video1.mp4');
    expect(adapter.getSessionToken()).toBe(1);
    await adapter.load('file:///video2.mp4');
    expect(adapter.getSessionToken()).toBe(2);
  });

  it('transitions ready -> playing -> paused -> playing', async () => {
    await adapter.load('file:///video.mp4');

    await adapter.play();
    expect(adapter.getState()).toBe('playing');

    await adapter.pause();
    expect(adapter.getState()).toBe('paused');

    await adapter.togglePlayback();
    expect(adapter.getState()).toBe('playing');
  });

  it('clamps seek positions to duration bounds', async () => {
    adapter.setSimulatedDuration(60000); // 60s
    await adapter.load('file:///video.mp4');

    await adapter.seekTo(30000);
    expect(adapter.getProgress().currentTimeMs).toBe(30000);

    // Negative seek clamped to 0
    await adapter.seekTo(-5000);
    expect(adapter.getProgress().currentTimeMs).toBe(0);

    // Beyond duration clamped and marks completed
    await adapter.seekTo(75000);
    expect(adapter.getState()).toBe('completed');
  });

  it('supports seekBy with configurable intervals (e.g. 30 seconds)', async () => {
    adapter.setSimulatedDuration(120000); // 120s
    await adapter.load('file:///video.mp4');
    await adapter.seekTo(20000); // at 20s

    await adapter.seekBy(30); // skip forward 30s
    expect(adapter.getProgress().currentTimeMs).toBe(50000);

    await adapter.seekBy(-30); // skip backward 30s
    expect(adapter.getProgress().currentTimeMs).toBe(20000);
  });

  it('emits typed errors and sets error states', async () => {
    const errorListener = jest.fn();
    adapter.addListener('error', errorListener);

    adapter.simulateError('CORRUPT_HEADER', 'Malformed container header', false);

    expect(adapter.getState()).toBe('fatalError');
    expect(errorListener).toHaveBeenCalledWith({
      code: 'CORRUPT_HEADER',
      message: 'Malformed container header',
      recoverable: false,
    });
  });

  it('unsubscribes listeners cleanly', async () => {
    const listener = jest.fn();
    const unsubscribe = adapter.addListener('stateChange', listener);

    await adapter.load('file:///test.mp4');
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    unsubscribe();

    await adapter.play();
    expect(listener).not.toHaveBeenCalled();
  });
});
