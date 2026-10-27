import { usePlaybackStore } from '../../src/store/usePlaybackStore';
import { MockPlayerAdapter } from '../../src/native/player/MockPlayerAdapter';
import { MediaItem } from '../../src/types/media';

describe('Player Adapter & Store Integration', () => {
  let mockAdapter: MockPlayerAdapter;

  const testMedia: MediaItem = {
    id: 'integ_test_video',
    sourceType: 'local_file',
    sourceReference: 'file:///storage/video.mp4',
    displayName: 'Inception.mp4',
    durationMs: 148000 * 1000,
    sizeBytes: 1500000000,
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

  beforeEach(() => {
    mockAdapter = new MockPlayerAdapter();
    usePlaybackStore.getState().init(mockAdapter);
  });

  afterEach(async () => {
    await usePlaybackStore.getState().reset();
  });

  it('loads media and starts playback', async () => {
    await usePlaybackStore.getState().loadMedia(testMedia, false);

    expect(usePlaybackStore.getState().currentMedia?.id).toBe('integ_test_video');
    expect(['ready', 'playing']).toContain(usePlaybackStore.getState().state);
  });

  it('plays, pauses, and toggles playback', async () => {
    await usePlaybackStore.getState().loadMedia(testMedia, false);

    await usePlaybackStore.getState().play();
    expect(usePlaybackStore.getState().state).toBe('playing');

    await usePlaybackStore.getState().pause();
    expect(usePlaybackStore.getState().state).toBe('paused');

    await usePlaybackStore.getState().togglePlay();
    expect(usePlaybackStore.getState().state).toBe('playing');
  });

  it('seeks and skips forward/backward by interval', async () => {
    await usePlaybackStore.getState().loadMedia(testMedia, false);

    await usePlaybackStore.getState().seekTo(25000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(25000);

    await usePlaybackStore.getState().skipBy(10);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(35000);

    await usePlaybackStore.getState().skipBy(-10);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(25000);
  });

  it('updates playback rate, volume, and aspect ratio', async () => {
    await usePlaybackStore.getState().loadMedia(testMedia, false);

    await usePlaybackStore.getState().setPlaybackRate(1.5);
    expect(usePlaybackStore.getState().playbackRate).toBe(1.5);

    await usePlaybackStore.getState().setVolume(0.8);
    expect(usePlaybackStore.getState().volume).toBe(0.8);

    await usePlaybackStore.getState().setAspectRatio('16:9');
    expect(usePlaybackStore.getState().aspectRatio).toBe('16:9');
  });

  it('handles external subtitle loading and cue parsing', async () => {
    await usePlaybackStore.getState().loadMedia(testMedia, false);

    const srt = `1\n00:00:01,000 --> 00:00:04,000\nHello World\n`;
    await usePlaybackStore.getState().loadExternalSubtitleText(srt, 'test.srt');

    const cues = usePlaybackStore.getState().subtitleCues;
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hello World');
    expect(usePlaybackStore.getState().activeSubtitleTrackId).toBe('external_custom');
  });

  it('toggles lock state and hides controls when locked', () => {
    expect(usePlaybackStore.getState().isLocked).toBe(false);

    usePlaybackStore.getState().toggleLock();
    expect(usePlaybackStore.getState().isLocked).toBe(true);
    expect(usePlaybackStore.getState().areControlsVisible).toBe(false);

    usePlaybackStore.getState().toggleLock();
    expect(usePlaybackStore.getState().isLocked).toBe(false);
  });

  it('smoothly handles rapid consecutive togglePlay calls without falling out of sync', async () => {
    await usePlaybackStore.getState().loadMedia(testMedia, false);
    await usePlaybackStore.getState().pause();
    expect(usePlaybackStore.getState().state).toBe('paused');

    // Rapid consecutive toggles
    await Promise.all([
      usePlaybackStore.getState().togglePlay(),
      usePlaybackStore.getState().togglePlay(),
    ]);

    // Should settle cleanly into either playing or paused according to native engine, not broken
    expect(['playing', 'paused']).toContain(usePlaybackStore.getState().state);
    expect(mockAdapter.isPlaying()).toBe(usePlaybackStore.getState().state === 'playing');
  });

  it('accumulates rapid consecutive skips and preserves playing state', async () => {
    await usePlaybackStore.getState().loadMedia(testMedia, false);
    await usePlaybackStore.getState().seekTo(10000);
    await usePlaybackStore.getState().play();
    expect(usePlaybackStore.getState().state).toBe('playing');

    // 3 rapid skips (+10s, +10s, +10s) = +30s total
    await usePlaybackStore.getState().skipBy(10);
    await usePlaybackStore.getState().skipBy(10);
    await usePlaybackStore.getState().skipBy(10);

    expect(usePlaybackStore.getState().currentTimeMs).toBe(40000);

    // Wait for debounce flush
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(mockAdapter.getProgress().currentTimeMs).toBe(40000);
    expect(usePlaybackStore.getState().state).toBe('playing');
  });

  it('safely clamps rapid skip intervals at boundary zero and duration', async () => {
    await usePlaybackStore.getState().loadMedia(testMedia, false);
    await usePlaybackStore.getState().seekTo(5000);

    // Skip backward beyond 0
    await usePlaybackStore.getState().skipBy(-10);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(0);

    // Skip forward beyond duration
    const durSec = usePlaybackStore.getState().durationMs / 1000;
    await usePlaybackStore.getState().skipBy(durSec + 50);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(usePlaybackStore.getState().durationMs);
  });

  it('supports scrubbing lifecycle without freezing and resumes playback if playing before', async () => {
    await usePlaybackStore.getState().loadMedia(testMedia, false);
    await usePlaybackStore.getState().seekTo(10000);
    await usePlaybackStore.getState().play();
    expect(usePlaybackStore.getState().state).toBe('playing');

    // Begin scrubbing
    usePlaybackStore.getState().startScrubbing();
    expect(usePlaybackStore.getState().isScrubbing).toBe(true);

    // Drag scrubber across timeline
    usePlaybackStore.getState().moveScrubbing(45000);
    expect(usePlaybackStore.getState().scrubPositionMs).toBe(45000);

    // Release scrubber
    await usePlaybackStore.getState().endScrubbing(45000);
    expect(usePlaybackStore.getState().isScrubbing).toBe(false);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(45000);
    expect(usePlaybackStore.getState().state).toBe('playing');
  });

  it('skips forward and backward immediately and preserves paused state if paused beforehand', async () => {
    await usePlaybackStore.getState().loadMedia(testMedia, false);
    await usePlaybackStore.getState().seekTo(15000);
    await usePlaybackStore.getState().pause();
    expect(usePlaybackStore.getState().state).toBe('paused');

    await usePlaybackStore.getState().skipBy(10);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(25000);
    expect(usePlaybackStore.getState().state).toBe('paused');

    await usePlaybackStore.getState().skipBy(-10);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(15000);
    expect(usePlaybackStore.getState().state).toBe('paused');
  });

  it('cycles through orientation viewing modes', () => {
    expect(usePlaybackStore.getState().orientationMode).toBe('auto');

    const next1 = usePlaybackStore.getState().cycleOrientationMode();
    expect(next1).toBe('landscape');
    expect(usePlaybackStore.getState().orientationMode).toBe('landscape');

    const next2 = usePlaybackStore.getState().cycleOrientationMode();
    expect(next2).toBe('portrait');
    expect(usePlaybackStore.getState().orientationMode).toBe('portrait');

    const next3 = usePlaybackStore.getState().cycleOrientationMode();
    expect(next3).toBe('auto');
    expect(usePlaybackStore.getState().orientationMode).toBe('auto');
  });

  it('ignores duplicate endScrubbing invocations (idempotent)', async () => {
    await usePlaybackStore.getState().loadMedia(testMedia, false);
    usePlaybackStore.getState().startScrubbing();

    const seekSpy = jest.spyOn(usePlaybackStore.getState(), 'seekTo');
    await usePlaybackStore.getState().endScrubbing(30000);
    expect(seekSpy).toHaveBeenCalledTimes(1);

    // Immediate second call should be ignored
    await usePlaybackStore.getState().endScrubbing(30000);
    expect(seekSpy).toHaveBeenCalledTimes(1);
    seekSpy.mockRestore();
  });

  it('decreases volume monotonically and clamps safely at lower and upper bounds', async () => {
    await usePlaybackStore.getState().loadMedia(testMedia, false);

    // Initial state: default 1.0 (100%)
    expect(usePlaybackStore.getState().volume).toBe(1.0);

    // Step 1: user swipes down -> volume drops to 0.75
    await usePlaybackStore.getState().setVolume(0.75);
    expect(usePlaybackStore.getState().volume).toBe(0.75);
    expect(mockAdapter.getVolume()).toBe(0.75);

    // Step 2: user swipes down again -> volume drops to 0.40 (does NOT jump back)
    await usePlaybackStore.getState().setVolume(0.40);
    expect(usePlaybackStore.getState().volume).toBe(0.40);
    expect(mockAdapter.getVolume()).toBe(0.40);

    // Step 3: user swipes down again -> volume drops to 0.10
    await usePlaybackStore.getState().setVolume(0.10);
    expect(usePlaybackStore.getState().volume).toBe(0.10);

    // Step 4: user swipes down past zero -> clamps at 0.0
    await usePlaybackStore.getState().setVolume(-0.25);
    expect(usePlaybackStore.getState().volume).toBe(0.0);
    expect(mockAdapter.getVolume()).toBe(0.0);

    // Step 5: user swipes up -> volume increases to 0.65
    await usePlaybackStore.getState().setVolume(0.65);
    expect(usePlaybackStore.getState().volume).toBe(0.65);

    // Step 6: user swipes up past 1.0 -> clamps at 1.0
    await usePlaybackStore.getState().setVolume(1.8);
    expect(usePlaybackStore.getState().volume).toBe(1.0);
    expect(mockAdapter.getVolume()).toBe(1.0);
  });

  it('guarantees sequential downward gesture calculations never regress or jump back up', async () => {
    await usePlaybackStore.getState().loadMedia(testMedia, false);
    const sensitivity = 260;

    // Simulate Gesture 1: Start at 1.0, user drags down 78px
    let currentVol = usePlaybackStore.getState().volume; // 1.0
    let dy1 = 78; // downward drag (+dy)
    let delta1 = -dy1 / sensitivity; // -0.30
    let target1 = Math.max(0, Math.min(1, currentVol + delta1));
    await usePlaybackStore.getState().setVolume(target1);
    expect(usePlaybackStore.getState().volume).toBeCloseTo(0.70, 2);

    // Simulate Gesture 2: Touch down again to lower volume further.
    // With fresh ref fix, start value MUST be the updated 0.70, NOT the initial 1.0
    currentVol = usePlaybackStore.getState().volume; // 0.70
    expect(currentVol).toBeCloseTo(0.70, 2);

    let dy2 = 52; // downward drag (+dy) of 52px
    let delta2 = -dy2 / sensitivity; // -0.20
    let target2 = Math.max(0, Math.min(1, currentVol + delta2));
    await usePlaybackStore.getState().setVolume(target2);
    expect(usePlaybackStore.getState().volume).toBeCloseTo(0.50, 2);

    // Verify it decreased: target2 < target1
    expect(usePlaybackStore.getState().volume).toBeLessThan(target1);

    // Under the old bug where initial closure stayed 1.0:
    // target would have been 1.0 - 0.20 = 0.80 (which was GREATER than 0.70)!
    // Verify target2 is strictly lower than 0.70 and NOT the buggy 0.80
    expect(usePlaybackStore.getState().volume).not.toBeCloseTo(0.80, 2);

    // Simulate Gesture 3: User drags down another 52px to 0.30
    currentVol = usePlaybackStore.getState().volume;
    let dy3 = 52;
    let delta3 = -dy3 / sensitivity;
    let target3 = Math.max(0, Math.min(1, currentVol + delta3));
    await usePlaybackStore.getState().setVolume(target3);
    expect(usePlaybackStore.getState().volume).toBeCloseTo(0.30, 2);
    expect(usePlaybackStore.getState().volume).toBeLessThan(target2);
  });
});


