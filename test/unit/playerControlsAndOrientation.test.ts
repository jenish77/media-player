import { usePlaybackStore } from '../../src/store/usePlaybackStore';
import { MockPlayerAdapter } from '../../src/native/player/MockPlayerAdapter';
import { MediaItem } from '../../src/types/media';

const mockMedia1: MediaItem = {
  id: 'media-1',
  sourceType: 'local_file',
  sourceReference: 'file:///videos/vid1.mp4',
  displayName: 'Video One',
  durationMs: 60000,
  sizeBytes: 1024,
  width: 1920,
  height: 1080,
  mimeType: 'video/mp4',
  container: 'MP4',
  dateAdded: Date.now(),
  lastSeenAt: Date.now(),
  availabilityStatus: 'available',
  thumbnailStatus: 'none',
  thumbnailUri: null,
  lastPlayedAt: Date.now(),
  lastPositionMs: 0,
  isFavorite: false,
  folderName: 'Movies',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const mockMedia2: MediaItem = {
  id: 'media-2',
  sourceType: 'local_file',
  sourceReference: 'file:///videos/vid2.mp4',
  displayName: 'Video Two',
  durationMs: 120000,
  sizeBytes: 2048,
  width: 1920,
  height: 1080,
  mimeType: 'video/mp4',
  container: 'MP4',
  dateAdded: Date.now(),
  lastSeenAt: Date.now(),
  availabilityStatus: 'available',
  thumbnailStatus: 'none',
  thumbnailUri: null,
  lastPlayedAt: Date.now(),
  lastPositionMs: 0,
  isFavorite: false,
  folderName: 'Movies',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('Player Controls & Orientation Integration', () => {
  beforeEach(async () => {
    const adapter = new MockPlayerAdapter();
    adapter.setSimulatedDuration(120000);
    usePlaybackStore.getState().init(adapter);
    await usePlaybackStore.getState().reset();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('toggles orientation cleanly between portrait and landscape', () => {
    usePlaybackStore.setState({ orientationMode: 'portrait' });
    expect(usePlaybackStore.getState().orientationMode).toBe('portrait');

    const next1 = usePlaybackStore.getState().toggleOrientation();
    expect(next1).toBe('landscape');
    expect(usePlaybackStore.getState().orientationMode).toBe('landscape');

    const next2 = usePlaybackStore.getState().toggleOrientation();
    expect(next2).toBe('portrait');
    expect(usePlaybackStore.getState().orientationMode).toBe('portrait');
  });

  it('keeps controls visible for 4000ms after user interaction, then auto-hides', () => {
    jest.useFakeTimers();
    usePlaybackStore.setState({ state: 'playing', areControlsVisible: true });

    usePlaybackStore.getState().showControlsTemporarily(4000);
    expect(usePlaybackStore.getState().areControlsVisible).toBe(true);
    expect(usePlaybackStore.getState().autoHideTimer).not.toBeNull();

    // After 2 seconds, controls should still be visible (not disappearing at 2s)
    jest.advanceTimersByTime(2000);
    expect(usePlaybackStore.getState().areControlsVisible).toBe(true);

    // After remaining 2 seconds (total 4s), controls auto-hide
    jest.advanceTimersByTime(2000);
    expect(usePlaybackStore.getState().areControlsVisible).toBe(false);
    expect(usePlaybackStore.getState().autoHideTimer).toBeNull();
  });

  it('dismisses controls immediately when hideControls is invoked (empty area tap)', () => {
    jest.useFakeTimers();
    usePlaybackStore.setState({ state: 'playing', areControlsVisible: true });
    usePlaybackStore.getState().showControlsTemporarily(4000);

    expect(usePlaybackStore.getState().areControlsVisible).toBe(true);
    expect(usePlaybackStore.getState().autoHideTimer).not.toBeNull();

    // User taps blank space -> dismisses controls
    usePlaybackStore.getState().hideControls();
    expect(usePlaybackStore.getState().areControlsVisible).toBe(false);
    expect(usePlaybackStore.getState().autoHideTimer).toBeNull();
  });

  it('keeps controls visible indefinitely while playback is paused', () => {
    jest.useFakeTimers();
    usePlaybackStore.setState({ state: 'paused', areControlsVisible: true });
    usePlaybackStore.getState().showControlsTemporarily(4000);

    expect(usePlaybackStore.getState().state).toBe('paused');
    expect(usePlaybackStore.getState().areControlsVisible).toBe(true);
    expect(usePlaybackStore.getState().autoHideTimer).toBeNull();

    // Advance time by 10 seconds -> controls must NOT disappear
    jest.advanceTimersByTime(10000);
    expect(usePlaybackStore.getState().areControlsVisible).toBe(true);
  });

  it('cancels auto-hide timer during scrubbing and restarts on release if playing', async () => {
    jest.useFakeTimers();
    usePlaybackStore.setState({ state: 'playing', areControlsVisible: true, durationMs: 60000 });
    usePlaybackStore.getState().showControlsTemporarily(4000);

    // Scrubbing starts
    usePlaybackStore.getState().startScrubbing();
    expect(usePlaybackStore.getState().isScrubbing).toBe(true);
    expect(usePlaybackStore.getState().areControlsVisible).toBe(true);
    expect(usePlaybackStore.getState().autoHideTimer).toBeNull();

    // Advance 5 seconds during scrubbing -> controls remain visible
    jest.advanceTimersByTime(5000);
    expect(usePlaybackStore.getState().areControlsVisible).toBe(true);

    // Scrubbing ends and playback resumes -> 4s timer restarts
    await usePlaybackStore.getState().endScrubbing(30000);
    expect(usePlaybackStore.getState().isScrubbing).toBe(false);
    expect(usePlaybackStore.getState().autoHideTimer).not.toBeNull();

    // Auto-hides after 4s
    jest.advanceTimersByTime(4000);
    expect(usePlaybackStore.getState().areControlsVisible).toBe(false);
  });

  it('resets 4s controls timer on transport actions (playNext, playPrevious, skipBy)', () => {
    jest.useFakeTimers();
    usePlaybackStore.setState({ state: 'playing', areControlsVisible: true });
    usePlaybackStore.getState().setQueue([mockMedia1, mockMedia2], 0);

    usePlaybackStore.getState().showControlsTemporarily(4000);
    jest.advanceTimersByTime(2500);

    // User triggers skipBy -> resets 4s timer
    usePlaybackStore.getState().skipBy(10);
    expect(usePlaybackStore.getState().areControlsVisible).toBe(true);

    // 2s later, still visible
    jest.advanceTimersByTime(2000);
    expect(usePlaybackStore.getState().areControlsVisible).toBe(true);

    // Total 4s from skipBy -> now hides
    jest.advanceTimersByTime(2000);
    expect(usePlaybackStore.getState().areControlsVisible).toBe(false);
  });
});
