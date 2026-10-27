import { usePlaybackStore } from '../../src/store/usePlaybackStore';
import { MockPlayerAdapter } from '../../src/native/player/MockPlayerAdapter';
import { MediaItem } from '../../src/types/media';

describe('Verification of 12 Seeking, Performance, and Cleanup Scenarios', () => {
  let mockAdapter: MockPlayerAdapter;

  const video150s: MediaItem = {
    id: 'video_150s',
    sourceType: 'local_file',
    sourceReference: 'file:///storage/video_150s.mp4',
    displayName: 'Nature_150s.mp4',
    durationMs: 150000, // 150 seconds
    sizeBytes: 100000000,
    width: 1920,
    height: 1080,
    mimeType: 'video/mp4',
    container: 'MP4',
    dateAdded: Date.now(),
    lastSeenAt: Date.now(),
    availabilityStatus: 'available',
    thumbnailStatus: 'none',
    thumbnailUri: null,
    lastPositionMs: 0,
    lastPlayedAt: null,
    isFavorite: false,
    folderName: 'Movies',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const video200s: MediaItem = {
    ...video150s,
    id: 'video_200s',
    displayName: 'Documentary_200s.mp4',
    sourceReference: 'file:///storage/video_200s.mp4',
    durationMs: 200000, // 200 seconds
  };

  beforeEach(() => {
    mockAdapter = new MockPlayerAdapter();
    mockAdapter.setSimulatedDuration(150000);
    usePlaybackStore.getState().init(mockAdapter);
  });

  afterEach(async () => {
    await usePlaybackStore.getState().reset();
  });

  // Scenario 1: Forward seek from 17s in a 150s video -> arrives at 32s with 15s interval
  it('Scenario 1: Forward seek from 17s in a 150s video arrives at 32s with 15s interval', async () => {
    await usePlaybackStore.getState().loadMedia(video150s, false);
    await usePlaybackStore.getState().seekTo(17000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(17000);

    // Skip forward 15s
    await usePlaybackStore.getState().skipBy(15);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(32000);

    // Wait for debounced native dispatch (35ms + margin)
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(mockAdapter.getProgress().currentTimeMs).toBe(32000);
  });

  // Scenario 2: Backward seek from 32s in the same video -> returns to 17s
  it('Scenario 2: Backward seek from 32s returns to 17s', async () => {
    await usePlaybackStore.getState().loadMedia(video150s, false);
    await usePlaybackStore.getState().seekTo(32000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(32000);

    // Skip backward 15s
    await usePlaybackStore.getState().skipBy(-15);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(17000);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(mockAdapter.getProgress().currentTimeMs).toBe(17000);
  });

  // Scenario 3: Rapid forward taps (3 taps from 17s) -> correctly arrives at 62s (17 + 15 + 15 + 15)
  it('Scenario 3: Three rapid forward taps from 17s correctly accumulate to 62s', async () => {
    await usePlaybackStore.getState().loadMedia(video150s, false);
    await usePlaybackStore.getState().seekTo(17000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(17000);

    // Three consecutive rapid taps without awaiting between them
    const tap1 = usePlaybackStore.getState().skipBy(15);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(32000);

    const tap2 = usePlaybackStore.getState().skipBy(15);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(47000);

    const tap3 = usePlaybackStore.getState().skipBy(15);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(62000);

    await Promise.all([tap1, tap2, tap3]);

    // Debounce wait
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(usePlaybackStore.getState().currentTimeMs).toBe(62000);
    expect(mockAdapter.getProgress().currentTimeMs).toBe(62000);
  });

  // Scenario 4: Backward seek near beginning (e.g. at 7s with 15s interval) -> lands cleanly at 00:00
  it('Scenario 4: Backward seek near beginning clamps cleanly to 0 without underflow', async () => {
    await usePlaybackStore.getState().loadMedia(video150s, false);
    await usePlaybackStore.getState().seekTo(7000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(7000);

    await usePlaybackStore.getState().skipBy(-15);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(mockAdapter.getProgress().currentTimeMs).toBe(0);
  });

  // Scenario 5: Forward seek near end (e.g. at 142s in a 150s video) -> lands cleanly at end boundary
  it('Scenario 5: Forward seek near end clamps cleanly to duration boundary', async () => {
    await usePlaybackStore.getState().loadMedia(video150s, false);
    await usePlaybackStore.getState().seekTo(142000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(142000);

    await usePlaybackStore.getState().skipBy(15);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(150000);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(mockAdapter.getProgress().currentTimeMs).toBe(150000);
  });

  // Scenario 6: Scrubbing from 20s to 85s -> timecode label updates immediately during drag, video seeks cleanly on release
  it('Scenario 6: Scrubbing updates timecode immediately during drag and commits on release', async () => {
    await usePlaybackStore.getState().loadMedia(video150s, false);
    await usePlaybackStore.getState().play();
    expect(usePlaybackStore.getState().state).toBe('playing');

    await usePlaybackStore.getState().seekTo(20000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(20000);

    // User starts scrubbing
    usePlaybackStore.getState().startScrubbing();
    expect(usePlaybackStore.getState().isScrubbing).toBe(true);

    // User drags finger to 50s
    usePlaybackStore.getState().moveScrubbing(50000);
    expect(usePlaybackStore.getState().scrubPositionMs).toBe(50000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(50000);

    // User drags finger to 85s
    usePlaybackStore.getState().moveScrubbing(85000);
    expect(usePlaybackStore.getState().scrubPositionMs).toBe(85000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(85000);

    // User releases finger
    await usePlaybackStore.getState().endScrubbing(85000);
    expect(usePlaybackStore.getState().isScrubbing).toBe(false);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(85000);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(mockAdapter.getProgress().currentTimeMs).toBe(85000);
    expect(usePlaybackStore.getState().state).toBe('playing');
  });

  // Scenario 7: Normal playback advances naturally from 30s to 35s without progress jumping backward
  it('Scenario 7: Normal playback advances without jumping backward', async () => {
    await usePlaybackStore.getState().loadMedia(video150s, false);
    await usePlaybackStore.getState().seekTo(30000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(30000);

    // Simulate native progress updates
    mockAdapter.seekTo(32000);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(usePlaybackStore.getState().currentTimeMs).toBe(32000);

    mockAdapter.seekTo(35000);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(usePlaybackStore.getState().currentTimeMs).toBe(35000);
  });

  // Scenario 8: Paused video seek -> video seeks to the target, preview updates, and playback remains paused
  it('Scenario 8: Paused video seek maintains paused state', async () => {
    await usePlaybackStore.getState().loadMedia(video150s, false);
    await usePlaybackStore.getState().pause();
    expect(usePlaybackStore.getState().state).toBe('paused');

    await usePlaybackStore.getState().seekTo(45000);
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(usePlaybackStore.getState().currentTimeMs).toBe(45000);
    expect(mockAdapter.getProgress().currentTimeMs).toBe(45000);
    expect(usePlaybackStore.getState().state).toBe('paused');
    expect(mockAdapter.getState()).toBe('paused');
  });

  // Scenario 9: Exiting the player stops playback and audio immediately
  it('Scenario 9: Exiting the player stops playback and audio immediately', async () => {
    await usePlaybackStore.getState().loadMedia(video150s, true);
    expect(usePlaybackStore.getState().state).toBe('playing');

    // Simulate exit cleanup (calling reset)
    await usePlaybackStore.getState().reset();

    expect(usePlaybackStore.getState().state).toBe('idle');
    expect(usePlaybackStore.getState().currentTimeMs).toBe(0);
    expect(usePlaybackStore.getState().currentMedia).toBeNull();
    expect(['idle', 'disposed']).toContain(mockAdapter.getState());
  });

  // Scenario 10: Rapidly switching between videos unloads previous and resets progress
  it('Scenario 10: Switching media resets progress and invalidates previous session tokens', async () => {
    const queue = [video150s, video200s];
    usePlaybackStore.getState().setQueue(queue, 0);

    await usePlaybackStore.getState().loadMedia(video150s, true);
    await usePlaybackStore.getState().seekTo(60000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(60000);

    const tokenBefore = mockAdapter.getSessionToken();

    // Switch to next media
    await usePlaybackStore.getState().playNext();

    expect(usePlaybackStore.getState().currentMedia?.id).toBe('video_200s');
    expect(usePlaybackStore.getState().currentTimeMs).toBe(0);
    expect(mockAdapter.getSessionToken()).toBeGreaterThan(tokenBefore);
  });

  // Scenario 11: Previous/next queue navigation with boundary handling
  it('Scenario 11: Queue navigation properly handles boundaries and track restart threshold', async () => {
    const queue = [video150s, video200s];
    usePlaybackStore.getState().setQueue(queue, 0);
    await usePlaybackStore.getState().loadMedia(video150s, false);

    // At index 0, playPrevious at 1000ms stays at index 0 (clamped to beginning)
    await usePlaybackStore.getState().seekTo(1000);
    await usePlaybackStore.getState().playPrevious();
    expect(usePlaybackStore.getState().queueIndex).toBe(0);

    // At index 0, playNext advances to index 1
    await usePlaybackStore.getState().playNext();
    expect(usePlaybackStore.getState().queueIndex).toBe(1);
    expect(usePlaybackStore.getState().currentMedia?.id).toBe('video_200s');

    // At index 1, playNext at boundary does not crash or advance past end
    await usePlaybackStore.getState().playNext();
    expect(usePlaybackStore.getState().queueIndex).toBe(1);

    // When at index 1 and currentTimeMs > 3000ms, playPrevious restarts current track
    await usePlaybackStore.getState().seekTo(15000);
    await usePlaybackStore.getState().playPrevious();
    expect(usePlaybackStore.getState().queueIndex).toBe(1);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(0);

    // When at index 1 and currentTimeMs <= 3000ms, playPrevious goes back to index 0
    await usePlaybackStore.getState().seekTo(2000);
    await usePlaybackStore.getState().playPrevious();
    expect(usePlaybackStore.getState().queueIndex).toBe(0);
    expect(usePlaybackStore.getState().currentMedia?.id).toBe('video_150s');
  });

  // Scenario 12: Repeated seek/play/pause stress test does not duplicate listeners or desync UI
  it('Scenario 12: Repeated seek/play/pause stress test maintains UI state sync', async () => {
    await usePlaybackStore.getState().loadMedia(video150s, false);

    for (let i = 0; i < 10; i++) {
      await usePlaybackStore.getState().seekTo(i * 5000);
      await usePlaybackStore.getState().play();
      await usePlaybackStore.getState().pause();
      await usePlaybackStore.getState().skipBy(15);
    }

    // Allow pending timers to settle
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(usePlaybackStore.getState().currentTimeMs).toBeGreaterThan(0);
    expect(usePlaybackStore.getState().error).toBeNull();
    expect(usePlaybackStore.getState().isScrubbing).toBe(false);
  });
});
