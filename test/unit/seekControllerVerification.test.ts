import { usePlaybackStore } from '../../src/store/usePlaybackStore';
import { MockPlayerAdapter } from '../../src/native/player/MockPlayerAdapter';
import { MediaItem } from '../../src/types/media';

describe('Rigorous Verification Suite for 13 Mandatory Seek and Synchronization Scenarios', () => {
  let mockAdapter: MockPlayerAdapter;

  const testVideo: MediaItem = {
    id: 'test_video_180s',
    sourceType: 'local_file',
    sourceReference: 'file:///storage/emulated/0/Movies/test_video.mp4',
    displayName: 'TestVideo_180s.mp4',
    durationMs: 180000, // 3 minutes = 180,000 ms
    sizeBytes: 150000000,
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

  const secondVideo: MediaItem = {
    ...testVideo,
    id: 'second_video_240s',
    displayName: 'SecondVideo_240s.mp4',
    sourceReference: 'file:///storage/emulated/0/Movies/second_video.mp4',
    durationMs: 240000, // 4 minutes = 240,000 ms
  };

  beforeEach(() => {
    mockAdapter = new MockPlayerAdapter();
    mockAdapter.setSimulatedDuration(180000);
    usePlaybackStore.getState().init(mockAdapter);
  });

  afterEach(async () => {
    await usePlaybackStore.getState().reset();
  });

  // Scenario 1: Backward seek while playing
  it('Scenario 1: Backward seek while playing preserves playing intent and lands at target', async () => {
    await usePlaybackStore.getState().loadMedia(testVideo, false);
    await usePlaybackStore.getState().seekTo(60000);
    await usePlaybackStore.getState().play();
    expect(usePlaybackStore.getState().state).toBe('playing');
    expect(usePlaybackStore.getState().currentTimeMs).toBe(60000);

    mockAdapter.setSeekDelay(50);
    const seekPromise = usePlaybackStore.getState().seekTo(25000);

    // While seek is in-flight: preview updates, actual native position is preserved!
    expect(usePlaybackStore.getState().isSeeking).toBe(true);
    expect(usePlaybackStore.getState().previewPositionMs).toBe(25000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(60000);

    await seekPromise;
    await new Promise((r) => setTimeout(r, 70));

    expect(usePlaybackStore.getState().currentTimeMs).toBe(25000);
    expect(usePlaybackStore.getState().isSeeking).toBe(false);
    expect(usePlaybackStore.getState().previewPositionMs).toBeNull();
    expect(usePlaybackStore.getState().state).toBe('playing');
    expect(mockAdapter.getState()).toBe('playing');
  });

  // Scenario 2: Forward seek while playing
  it('Scenario 2: Forward seek while playing advances position and resumes playback', async () => {
    await usePlaybackStore.getState().loadMedia(testVideo, false);
    await usePlaybackStore.getState().seekTo(15000);
    await usePlaybackStore.getState().play();
    expect(usePlaybackStore.getState().state).toBe('playing');

    mockAdapter.setSeekDelay(50);
    const seekPromise = usePlaybackStore.getState().seekTo(75000);

    expect(usePlaybackStore.getState().isSeeking).toBe(true);
    expect(usePlaybackStore.getState().previewPositionMs).toBe(75000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(15000);

    await seekPromise;
    await new Promise((r) => setTimeout(r, 70));

    expect(usePlaybackStore.getState().currentTimeMs).toBe(75000);
    expect(usePlaybackStore.getState().isSeeking).toBe(false);
    expect(usePlaybackStore.getState().previewPositionMs).toBeNull();
    expect(usePlaybackStore.getState().state).toBe('playing');
    expect(mockAdapter.getState()).toBe('playing');
  });

  // Scenario 3: Backward seek while paused
  it('Scenario 3: Backward seek while paused preserves paused state without auto-resuming', async () => {
    await usePlaybackStore.getState().loadMedia(testVideo, false);
    await usePlaybackStore.getState().seekTo(80000);
    await usePlaybackStore.getState().pause();
    expect(usePlaybackStore.getState().state).toBe('paused');

    await usePlaybackStore.getState().seekTo(30000);
    await new Promise((r) => setTimeout(r, 60));

    expect(usePlaybackStore.getState().currentTimeMs).toBe(30000);
    expect(usePlaybackStore.getState().state).toBe('paused');
    expect(mockAdapter.getState()).toBe('paused');
  });

  // Scenario 4: Seeking to zero
  it('Scenario 4: Seeking to zero clamps cleanly at 0 without underflow or negative timestamps', async () => {
    await usePlaybackStore.getState().loadMedia(testVideo, false);
    await usePlaybackStore.getState().seekTo(45000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(45000);

    await usePlaybackStore.getState().seekTo(0);
    await new Promise((r) => setTimeout(r, 60));

    expect(usePlaybackStore.getState().currentTimeMs).toBe(0);
    expect(usePlaybackStore.getState().isSeeking).toBe(false);
    expect(mockAdapter.getProgress().currentTimeMs).toBe(0);
  });

  // Scenario 5: Seeking to the end of the video
  it('Scenario 5: Seeking to the end of the video clamps cleanly to duration boundary', async () => {
    await usePlaybackStore.getState().loadMedia(testVideo, false);
    const duration = testVideo.durationMs || 180000;

    await usePlaybackStore.getState().seekTo(duration + 10000);
    await new Promise((r) => setTimeout(r, 60));

    expect(usePlaybackStore.getState().currentTimeMs).toBe(duration);
    expect(usePlaybackStore.getState().isSeeking).toBe(false);
  });

  // Scenario 6: Rapid repeated 10-second skips
  it('Scenario 6: Rapid repeated 10-second skips accumulate on authoritative target', async () => {
    await usePlaybackStore.getState().loadMedia(testVideo, false);
    await usePlaybackStore.getState().seekTo(30000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(30000);

    // Three consecutive rapid 10-second forward skips
    const tap1 = usePlaybackStore.getState().skipBy(10);
    expect(usePlaybackStore.getState().previewPositionMs).toBe(40000);
    expect(usePlaybackStore.getState().isSeeking).toBe(true);

    const tap2 = usePlaybackStore.getState().skipBy(10);
    expect(usePlaybackStore.getState().previewPositionMs).toBe(50000);

    const tap3 = usePlaybackStore.getState().skipBy(10);
    expect(usePlaybackStore.getState().previewPositionMs).toBe(60000);

    // Native position is preserved at 30s while in-flight
    expect(usePlaybackStore.getState().currentTimeMs).toBe(30000);

    await Promise.all([tap1, tap2, tap3]);
    await new Promise((r) => setTimeout(r, 80));

    expect(usePlaybackStore.getState().currentTimeMs).toBe(60000);
    expect(usePlaybackStore.getState().isSeeking).toBe(false);
    expect(mockAdapter.getProgress().currentTimeMs).toBe(60000);

    // Two rapid -10s backward skips
    const back1 = usePlaybackStore.getState().skipBy(-10);
    expect(usePlaybackStore.getState().previewPositionMs).toBe(50000);

    const back2 = usePlaybackStore.getState().skipBy(-10);
    expect(usePlaybackStore.getState().previewPositionMs).toBe(40000);

    await Promise.all([back1, back2]);
    await new Promise((r) => setTimeout(r, 80));

    expect(usePlaybackStore.getState().currentTimeMs).toBe(40000);
    expect(usePlaybackStore.getState().isSeeking).toBe(false);
    expect(mockAdapter.getProgress().currentTimeMs).toBe(40000);
  });

  // Scenario 7: Pause while a seek is pending
  it('Scenario 7: Pause while a seek is pending ensures player remains paused after seek completion', async () => {
    await usePlaybackStore.getState().loadMedia(testVideo, false);
    await usePlaybackStore.getState().play();
    expect(usePlaybackStore.getState().state).toBe('playing');

    mockAdapter.setSeekDelay(60);

    const seekPromise = usePlaybackStore.getState().seekTo(50000);
    expect(usePlaybackStore.getState().isSeeking).toBe(true);

    // User taps pause while seek is pending
    await usePlaybackStore.getState().pause();
    expect(usePlaybackStore.getState().state).toBe('paused');

    await seekPromise;
    await new Promise((r) => setTimeout(r, 80));

    // Player MUST remain paused!
    expect(usePlaybackStore.getState().state).toBe('paused');
    expect(mockAdapter.getState()).toBe('paused');
    expect(usePlaybackStore.getState().currentTimeMs).toBe(50000);
    expect(usePlaybackStore.getState().isSeeking).toBe(false);
  });

  // Scenario 8: Play while a seek is pending
  it('Scenario 8: Play while a seek is pending ensures player resumes playing after seek completion', async () => {
    await usePlaybackStore.getState().loadMedia(testVideo, false);
    await usePlaybackStore.getState().pause();
    expect(usePlaybackStore.getState().state).toBe('paused');

    mockAdapter.setSeekDelay(60);

    const seekPromise = usePlaybackStore.getState().seekTo(70000);
    expect(usePlaybackStore.getState().isSeeking).toBe(true);

    // User taps play while seek is pending
    await usePlaybackStore.getState().play();
    expect(usePlaybackStore.getState().state).toBe('playing');

    await seekPromise;
    await new Promise((r) => setTimeout(r, 80));

    expect(usePlaybackStore.getState().state).toBe('playing');
    expect(mockAdapter.getState()).toBe('playing');
    expect(usePlaybackStore.getState().currentTimeMs).toBe(70000);
    expect(usePlaybackStore.getState().isSeeking).toBe(false);
  });

  // Scenario 9: A stale native event arriving after a newer seek
  it('Scenario 9: Stale native event arriving after a newer seek is rejected without corrupting UI', async () => {
    await usePlaybackStore.getState().loadMedia(testVideo, false);
    await usePlaybackStore.getState().seekTo(100000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(100000);

    mockAdapter.setSeekDelay(60);

    // Seek backward to 40s
    const seekPromise = usePlaybackStore.getState().seekTo(40000);
    expect(usePlaybackStore.getState().previewPositionMs).toBe(40000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(100000);
    expect(usePlaybackStore.getState().isSeeking).toBe(true);

    // Stale progress event at 100s arrives from native player while seek is in-flight
    mockAdapter.simulateProgressUpdate(100000, 180000, 105000);

    // currentTimeMs must NOT revert back to 100s in preview, and previewPositionMs must stay 40s!
    expect(usePlaybackStore.getState().previewPositionMs).toBe(40000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(100000);
    expect(usePlaybackStore.getState().isSeeking).toBe(true);

    await seekPromise;
    await new Promise((r) => setTimeout(r, 80));

    expect(usePlaybackStore.getState().currentTimeMs).toBe(40000);
    expect(usePlaybackStore.getState().isSeeking).toBe(false);
  });

  // Scenario 10: Watchdog timeout when the native position has not reached the target
  it('Scenario 10: Watchdog timeout when native position has not reached target preserves actual position and marks timeout', async () => {
    jest.useFakeTimers();

    const nonResponsiveAdapter = {
      ...mockAdapter,
      seekTo: jest.fn().mockImplementation(() => new Promise(() => {})),
      isPlaying: () => false,
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn().mockResolvedValue(undefined),
      addListener: jest.fn().mockReturnValue(() => {}),
      getProgress: () => ({ currentTimeMs: 15000, durationMs: 180000, bufferedPositionMs: 20000 }),
    };
    usePlaybackStore.getState().init(nonResponsiveAdapter as any);

    // Seek from 15s to 90s
    usePlaybackStore.setState({ currentTimeMs: 15000, durationMs: 180000 });
    usePlaybackStore.getState().seekTo(90000);
    expect(usePlaybackStore.getState().isSeeking).toBe(true);
    expect(usePlaybackStore.getState().previewPositionMs).toBe(90000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(15000);

    // Advance past the 1200ms watchdog
    jest.advanceTimersByTime(1250);

    // Watchdog fires: native player is still at 15s (target 90s NOT reached)
    expect(usePlaybackStore.getState().isSeeking).toBe(false);
    expect(usePlaybackStore.getState().previewPositionMs).toBeNull();
    // currentTimeMs reflects actual native position (15s), NOT false target 90s!
    expect(usePlaybackStore.getState().currentTimeMs).toBe(15000);

    const diagnostic = usePlaybackStore.getState().getLastSeekDiagnostic();
    expect(diagnostic?.watchdogTriggered).toBe(true);
    expect(diagnostic?.seekCompleted).toBe(false);
    expect(diagnostic?.status).toBe('timedOut');

    jest.useRealTimers();
  });

  // Scenario 11: Progress polling during a pending seek
  it('Scenario 11: Progress polling during a pending seek does not overwrite preview or falsely acknowledge seek', async () => {
    await usePlaybackStore.getState().loadMedia(testVideo, false);
    await usePlaybackStore.getState().seekTo(20000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(20000);

    mockAdapter.setSeekDelay(80);

    const seekPromise = usePlaybackStore.getState().seekTo(80000);
    expect(usePlaybackStore.getState().isSeeking).toBe(true);
    expect(usePlaybackStore.getState().previewPositionMs).toBe(80000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(20000);

    // Intermediate progress updates at old position (20s)
    mockAdapter.simulateProgressUpdate(20000, 180000, 25000);

    expect(usePlaybackStore.getState().isSeeking).toBe(true);
    expect(usePlaybackStore.getState().previewPositionMs).toBe(80000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(20000);

    await seekPromise;
    await new Promise((r) => setTimeout(r, 90));

    expect(usePlaybackStore.getState().currentTimeMs).toBe(80000);
    expect(usePlaybackStore.getState().isSeeking).toBe(false);
    expect(usePlaybackStore.getState().previewPositionMs).toBeNull();
  });

  // Scenario 12: Scrubber preview versus actual native position
  it('Scenario 12: Scrubber preview versus actual native position keeps actual position intact until commit', async () => {
    await usePlaybackStore.getState().loadMedia(testVideo, false);
    await usePlaybackStore.getState().seekTo(25000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(25000);

    usePlaybackStore.getState().startScrubbing();
    expect(usePlaybackStore.getState().isScrubbing).toBe(true);

    // Scrub to 110s
    usePlaybackStore.getState().moveScrubbing(110000);
    expect(usePlaybackStore.getState().scrubPositionMs).toBe(110000);
    expect(usePlaybackStore.getState().previewPositionMs).toBe(110000);
    // Crucial: currentTimeMs remains at actual native position (25s)!
    expect(usePlaybackStore.getState().currentTimeMs).toBe(25000);

    // Commit scrub
    await usePlaybackStore.getState().endScrubbing(110000);
    await new Promise((r) => setTimeout(r, 60));

    expect(usePlaybackStore.getState().isScrubbing).toBe(false);
    expect(usePlaybackStore.getState().isSeeking).toBe(false);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(110000);
    expect(usePlaybackStore.getState().previewPositionMs).toBeNull();
    expect(mockAdapter.getProgress().currentTimeMs).toBe(110000);
  });

  // Scenario 13: Player disposal while a seek is pending
  it('Scenario 13: Player disposal while a seek is pending tears down cleanly without errors or leaks', async () => {
    await usePlaybackStore.getState().loadMedia(testVideo, false);
    mockAdapter.setSeekDelay(100);

    const seekPromise = usePlaybackStore.getState().seekTo(90000);
    expect(usePlaybackStore.getState().isSeeking).toBe(true);

    // User navigates away or disposes player while seek is in-flight
    await usePlaybackStore.getState().reset();

    expect(usePlaybackStore.getState().state).toBe('idle');
    expect(usePlaybackStore.getState().isSeeking).toBe(false);
    expect(usePlaybackStore.getState().previewPositionMs).toBeNull();
    expect(usePlaybackStore.getState().currentTimeMs).toBe(0);

    await seekPromise.catch(() => {});
    await new Promise((r) => setTimeout(r, 120));

    // Confirms no post-disposal leakage
    expect(usePlaybackStore.getState().isSeeking).toBe(false);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(0);
  });

  // Supplementary Edge Cases
  it('Scenario 14: Source switching while a seek is pending cancels stale session cleanly', async () => {
    await usePlaybackStore.getState().loadMedia(testVideo, false);
    mockAdapter.setSeekDelay(60);

    usePlaybackStore.getState().skipBy(30);
    expect(usePlaybackStore.getState().isSeeking).toBe(true);

    await usePlaybackStore.getState().loadMedia(secondVideo, false);

    expect(usePlaybackStore.getState().currentMedia?.id).toBe('second_video_240s');
    expect(usePlaybackStore.getState().currentTimeMs).toBe(0);
    expect(usePlaybackStore.getState().isSeeking).toBe(false);
    expect(usePlaybackStore.getState().previewPositionMs).toBeNull();
  });

  it('Scenario 15: Seeking backward after reaching end revives state out of completed', async () => {
    await usePlaybackStore.getState().loadMedia(testVideo, false);
    const duration = testVideo.durationMs || 180000;

    await usePlaybackStore.getState().seekTo(duration);
    usePlaybackStore.setState({ state: 'completed' });
    expect(usePlaybackStore.getState().state).toBe('completed');

    await usePlaybackStore.getState().skipBy(-30);
    await new Promise((r) => setTimeout(r, 60));

    expect(usePlaybackStore.getState().currentTimeMs).toBe(duration - 30000);
    expect(usePlaybackStore.getState().state).not.toBe('completed');
    expect(['paused', 'playing']).toContain(usePlaybackStore.getState().state);
  });
});
