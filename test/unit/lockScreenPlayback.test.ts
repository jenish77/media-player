import { usePlaybackStore } from '../../src/store/usePlaybackStore';
import { MockPlayerAdapter } from '../../src/native/player/MockPlayerAdapter';
import { MediaItem } from '../../src/types/media';

describe('Lock Screen Playback Preservation & Interaction Verification', () => {
  let mockAdapter: MockPlayerAdapter;

  const sampleVideo: MediaItem = {
    id: 'sample_video_1',
    sourceType: 'local_file',
    sourceReference: 'file:///storage/sample.mp4',
    displayName: 'BigBuckBunny.mp4',
    durationMs: 120000, // 2 minutes
    sizeBytes: 50000000,
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
    mockAdapter.setSimulatedDuration(120000);
    usePlaybackStore.getState().init(mockAdapter);
  });

  afterEach(async () => {
    await usePlaybackStore.getState().reset();
  });

  // Scenario 1: Playing video -> lock -> video continues playing at the same playback rate
  it('Scenario 1: Playing video -> lock -> video continues playing seamlessly at same playback rate', async () => {
    await usePlaybackStore.getState().loadMedia(sampleVideo, false);
    await usePlaybackStore.getState().setPlaybackRate(1.5);
    await usePlaybackStore.getState().play();

    expect(usePlaybackStore.getState().state).toBe('playing');
    expect(usePlaybackStore.getState().playbackRate).toBe(1.5);
    expect(usePlaybackStore.getState().isLocked).toBe(false);

    // Lock screen
    usePlaybackStore.getState().toggleLock();

    expect(usePlaybackStore.getState().isLocked).toBe(true);
    expect(usePlaybackStore.getState().areControlsVisible).toBe(false);
    // Playback state and rate must remain completely unaffected
    expect(usePlaybackStore.getState().state).toBe('playing');
    expect(usePlaybackStore.getState().playbackRate).toBe(1.5);
    expect(mockAdapter.getState()).toBe('playing');
    expect(mockAdapter.getRate()).toBe(1.5);
  });

  // Scenario 2: Playing video -> lock -> unlock -> video continues without interruption
  it('Scenario 2: Playing video -> lock -> unlock -> video continues playing without interruption', async () => {
    await usePlaybackStore.getState().loadMedia(sampleVideo, false);
    await usePlaybackStore.getState().play();
    await usePlaybackStore.getState().seekTo(25000);

    const positionBeforeLock = usePlaybackStore.getState().currentTimeMs;
    expect(positionBeforeLock).toBe(25000);

    // Lock
    usePlaybackStore.getState().toggleLock();
    expect(usePlaybackStore.getState().isLocked).toBe(true);
    expect(usePlaybackStore.getState().state).toBe('playing');

    // Unlock
    usePlaybackStore.getState().toggleLock();
    expect(usePlaybackStore.getState().isLocked).toBe(false);
    expect(usePlaybackStore.getState().state).toBe('playing');
    expect(usePlaybackStore.getState().currentTimeMs).toBe(25000);
    expect(usePlaybackStore.getState().areControlsVisible).toBe(true);
  });

  // Scenario 3: Paused video -> lock -> unlock -> video remains paused
  it('Scenario 3: Paused video -> lock -> unlock -> video remains paused', async () => {
    await usePlaybackStore.getState().loadMedia(sampleVideo, false);
    await usePlaybackStore.getState().pause();
    await usePlaybackStore.getState().seekTo(15000);

    expect(usePlaybackStore.getState().state).toBe('paused');

    // Lock
    usePlaybackStore.getState().toggleLock();
    expect(usePlaybackStore.getState().isLocked).toBe(true);
    expect(usePlaybackStore.getState().state).toBe('paused');

    // Unlock
    usePlaybackStore.getState().toggleLock();
    expect(usePlaybackStore.getState().isLocked).toBe(false);
    expect(usePlaybackStore.getState().state).toBe('paused');
    expect(usePlaybackStore.getState().currentTimeMs).toBe(15000);
  });

  // Scenario 4: Lock and unlock repeatedly while playing -> no playback restart, pause, or position jump
  it('Scenario 4: Lock and unlock repeatedly while playing -> no playback restart, pause, or position jump', async () => {
    await usePlaybackStore.getState().loadMedia(sampleVideo, false);
    await usePlaybackStore.getState().play();
    await usePlaybackStore.getState().seekTo(30000);

    const pauseSpy = jest.spyOn(mockAdapter, 'pause');
    const playSpy = jest.spyOn(mockAdapter, 'play');
    const loadSpy = jest.spyOn(mockAdapter, 'load');

    // Rapidly toggle lock 8 times
    for (let i = 0; i < 8; i++) {
      usePlaybackStore.getState().toggleLock();
    }

    // Ended on unlocked state
    expect(usePlaybackStore.getState().isLocked).toBe(false);
    expect(usePlaybackStore.getState().state).toBe('playing');
    expect(usePlaybackStore.getState().currentTimeMs).toBe(30000);

    // Verify adapter load was not re-invoked and pause was not called by lock toggling
    expect(loadSpy).not.toHaveBeenCalled();
    expect(pauseSpy).not.toHaveBeenCalled();
  });

  // Scenario 5: Lock while seeking or immediately after seeking -> no unexpected seek or reset
  it('Scenario 5: Lock while seeking or immediately after seeking -> no unexpected seek or reset', async () => {
    await usePlaybackStore.getState().loadMedia(sampleVideo, false);
    await usePlaybackStore.getState().play();

    // Trigger seek to 45s
    const seekPromise = usePlaybackStore.getState().seekTo(45000);
    // Immediately lock while seek is resolving
    usePlaybackStore.getState().toggleLock();

    await seekPromise;

    expect(usePlaybackStore.getState().isLocked).toBe(true);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(45000);
    expect(usePlaybackStore.getState().state).toBe('playing');

    // Attempting another seek while locked must be blocked
    await usePlaybackStore.getState().seekTo(80000);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(45000); // Unchanged!
  });

  // Scenario 6: Lock while using volume or brightness gestures -> subsequent calls cannot change controls
  it('Scenario 6: While locked, playback interaction methods are safely guarded', async () => {
    await usePlaybackStore.getState().loadMedia(sampleVideo, false);
    await usePlaybackStore.getState().play();
    await usePlaybackStore.getState().setVolume(0.7);
    await usePlaybackStore.getState().setBrightness(0.6);

    usePlaybackStore.getState().toggleLock();
    expect(usePlaybackStore.getState().isLocked).toBe(true);

    // Attempting to change volume, brightness, play/pause, rate, aspect ratio while locked
    await usePlaybackStore.getState().setVolume(0.2);
    expect(usePlaybackStore.getState().volume).toBe(0.7); // Blocked

    await usePlaybackStore.getState().setBrightness(0.9);
    expect(usePlaybackStore.getState().brightness).toBe(0.6); // Blocked

    await usePlaybackStore.getState().togglePlay();
    expect(usePlaybackStore.getState().state).toBe('playing'); // Blocked from toggling

    await usePlaybackStore.getState().setPlaybackRate(2.0);
    expect(usePlaybackStore.getState().playbackRate).toBe(1.0); // Blocked
  });

  // Scenario 7: Lock during fullscreen landscape playback -> orientation mode remains unchanged
  it('Scenario 7: Lock during fullscreen landscape playback -> orientation mode remains unchanged', async () => {
    await usePlaybackStore.getState().loadMedia(sampleVideo, false);
    usePlaybackStore.getState().setOrientationMode('landscape');

    expect(usePlaybackStore.getState().orientationMode).toBe('landscape');

    usePlaybackStore.getState().toggleLock();
    expect(usePlaybackStore.getState().isLocked).toBe(true);
    expect(usePlaybackStore.getState().orientationMode).toBe('landscape');

    usePlaybackStore.getState().toggleLock();
    expect(usePlaybackStore.getState().isLocked).toBe(false);
    expect(usePlaybackStore.getState().orientationMode).toBe('landscape');
  });

  // Scenario 8: Unlock after extended period -> playback state remains correct
  it('Scenario 8: Unlock after the screen has been locked for an extended period -> playback state remains correct', async () => {
    await usePlaybackStore.getState().loadMedia(sampleVideo, false);
    await usePlaybackStore.getState().play();
    await usePlaybackStore.getState().seekTo(10000);

    usePlaybackStore.getState().toggleLock();
    expect(usePlaybackStore.getState().isLocked).toBe(true);

    // Simulate elapsed time / progress updates arriving from native adapter while locked
    mockAdapter.simulateProgressUpdate(25000, 120000, 40000);

    expect(usePlaybackStore.getState().currentTimeMs).toBe(25000);
    expect(usePlaybackStore.getState().state).toBe('playing');

    // Unlock after extended period
    usePlaybackStore.getState().toggleLock();
    expect(usePlaybackStore.getState().isLocked).toBe(false);
    expect(usePlaybackStore.getState().currentTimeMs).toBe(25000);
    expect(usePlaybackStore.getState().state).toBe('playing');
  });

  // Scenario 9: Navigate away from player screen cleans up playback
  it('Scenario 9: Leaving the player screen cleans up playback and resets lock state', async () => {
    await usePlaybackStore.getState().loadMedia(sampleVideo, false);
    await usePlaybackStore.getState().play();
    usePlaybackStore.getState().toggleLock();
    expect(usePlaybackStore.getState().isLocked).toBe(true);

    const disposeSpy = jest.spyOn(mockAdapter, 'dispose');
    const pauseSpy = jest.spyOn(mockAdapter, 'pause');

    // Simulate screen exit cleanup
    await usePlaybackStore.getState().reset();

    expect(pauseSpy).toHaveBeenCalled();
    expect(disposeSpy).toHaveBeenCalled();
    expect(usePlaybackStore.getState().state).toBe('idle');
    expect(usePlaybackStore.getState().isLocked).toBe(false);
    expect(usePlaybackStore.getState().currentMedia).toBeNull();
  });

  // Scenario 10: Check for clean listener and timer management
  it('Scenario 10: Toggle lock clears lingering auto-hide timers cleanly without orphan callbacks', () => {
    jest.useFakeTimers();

    usePlaybackStore.getState().showControlsTemporarily();
    expect(usePlaybackStore.getState().autoHideTimer).not.toBeNull();

    // Toggle lock should immediately clear autoHideTimer
    usePlaybackStore.getState().toggleLock();
    expect(usePlaybackStore.getState().isLocked).toBe(true);
    expect(usePlaybackStore.getState().autoHideTimer).toBeNull();
    expect(usePlaybackStore.getState().areControlsVisible).toBe(false);

    // Advancing time should not fire any controls visibility change
    jest.advanceTimersByTime(5000);
    expect(usePlaybackStore.getState().areControlsVisible).toBe(false);

    jest.useRealTimers();
  });
});
