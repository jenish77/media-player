import {
  validateMediaFile,
  getPlaybackResumeAction,
  clamp,
  throttle,
} from '../../src/utils/edgeCaseHandlers';
import { MediaItem } from '../../src/types/media';

describe('validateMediaFile', () => {
  it('rejects null or missing sourceReference', () => {
    const res = validateMediaFile(null);
    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('MISSING_SOURCE');
  });

  it('rejects zero-byte video file', () => {
    const item: Partial<MediaItem> = {
      sourceReference: 'file:///movies/empty.mp4',
      sizeBytes: 0,
    };
    const res = validateMediaFile(item);
    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('ZERO_BYTE_FILE');
    expect(res.recoverable).toBe(false);
  });

  it('rejects missing file status', () => {
    const item: Partial<MediaItem> = {
      sourceReference: 'file:///movies/deleted.mp4',
      sizeBytes: 1048576,
      availabilityStatus: 'missing',
    };
    const res = validateMediaFile(item);
    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('FILE_NOT_FOUND');
  });

  it('flags cloud-only files as recoverable', () => {
    const item: Partial<MediaItem> = {
      sourceReference: 'content://cloud/stream.mp4',
      sizeBytes: 5000000,
      availabilityStatus: 'cloud_only',
    };
    const res = validateMediaFile(item);
    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('CLOUD_ONLY');
    expect(res.recoverable).toBe(true);
  });

  it('validates regular accessible media item', () => {
    const item: Partial<MediaItem> = {
      sourceReference: 'file:///movies/valid.mp4',
      sizeBytes: 10485760,
      availabilityStatus: 'available',
    };
    const res = validateMediaFile(item);
    expect(res.isValid).toBe(true);
  });
});

describe('getPlaybackResumeAction', () => {
  const duration = 100000; // 100 seconds (100,000ms)

  it('starts over if watched less than 5 seconds', () => {
    expect(getPlaybackResumeAction(duration, 0)).toBe('start_over');
    expect(getPlaybackResumeAction(duration, 4999)).toBe('start_over');
    expect(getPlaybackResumeAction(duration, null)).toBe('start_over');
  });

  it('starts over if watched more than 95% of total duration', () => {
    expect(getPlaybackResumeAction(duration, 96000)).toBe('start_over');
    expect(getPlaybackResumeAction(duration, 99000)).toBe('start_over');
  });

  it('resumes if watched between 5 seconds and 95%', () => {
    expect(getPlaybackResumeAction(duration, 5001)).toBe('resume');
    expect(getPlaybackResumeAction(duration, 50000)).toBe('resume');
    expect(getPlaybackResumeAction(duration, 94000)).toBe('resume');
  });
});

describe('clamp', () => {
  it('clamps values within boundaries', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('throttle', () => {
  jest.useFakeTimers();

  it('limits call frequency', () => {
    const mockFn = jest.fn();
    const throttled = throttle(mockFn, 1000);

    throttled();
    throttled();
    throttled();

    // First call immediate
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Fast forward 1 second
    jest.advanceTimersByTime(1000);
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});
