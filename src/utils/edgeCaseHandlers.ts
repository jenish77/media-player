import { MediaItem } from '../types/media';

export interface MediaValidationResult {
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
  recoverable: boolean;
}

/**
 * Validates a media item before initiating playback.
 * Detects zero-byte files, missing references, and corrupted metadata.
 */
export function validateMediaFile(item: Partial<MediaItem> | null | undefined): MediaValidationResult {
  if (!item || !item.sourceReference) {
    return {
      isValid: false,
      errorCode: 'MISSING_SOURCE',
      errorMessage: 'The media file reference could not be found or has been revoked.',
      recoverable: false,
    };
  }

  // Zero-byte or truncated file check
  if (item.sizeBytes !== null && item.sizeBytes !== undefined && item.sizeBytes <= 0) {
    return {
      isValid: false,
      errorCode: 'ZERO_BYTE_FILE',
      errorMessage: 'This video file is empty (0 bytes) or corrupted.',
      recoverable: false,
    };
  }

  // Missing availability status
  if (item.availabilityStatus === 'missing') {
    return {
      isValid: false,
      errorCode: 'FILE_NOT_FOUND',
      errorMessage: 'The video file was moved or deleted from device storage.',
      recoverable: false,
    };
  }

  if (item.availabilityStatus === 'cloud_only') {
    return {
      isValid: false,
      errorCode: 'CLOUD_ONLY',
      errorMessage: 'The file is stored in cloud storage and is not downloaded locally.',
      recoverable: true,
    };
  }

  return { isValid: true, recoverable: true };
}

/**
 * Evaluates whether to prompt the user to resume or restart playback.
 * Based on production rules:
 * - If last position is < 5 seconds: start from beginning (not meaningful progress)
 * - If last position is > 95% of total duration: start from beginning (completed)
 * - Otherwise: resume from last position
 */
export function getPlaybackResumeAction(
  durationMs: number | null | undefined,
  lastPositionMs: number | null | undefined
): 'resume' | 'start_over' {
  if (!lastPositionMs || lastPositionMs < 5000) {
    return 'start_over';
  }

  if (durationMs && durationMs > 0) {
    const progressPercent = (lastPositionMs / durationMs) * 100;
    if (progressPercent >= 95) {
      return 'start_over';
    }
  }

  return 'resume';
}

/**
 * Clamps a numerical value between min and max bounds.
 */
export function clamp(value: number, min: number, max: number): number {
  if (isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds.
 */
export function debounce<T extends (...args: any[]) => void>(func: T, waitMs: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return function (...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, waitMs);
    if (timeoutId && typeof (timeoutId as any).unref === 'function') {
      (timeoutId as any).unref();
    }
  };
}

/**
 * Creates a throttled function that only invokes func at most once per every limit milliseconds.
 */
export function throttle<T extends (...args: any[]) => void>(func: T, limitMs: number): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  return function (...args: Parameters<T>) {
    const now = Date.now();
    const remaining = limitMs - (now - lastCall);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      func(...args);
    } else {
      lastArgs = args;
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          lastCall = Date.now();
          timeoutId = null;
          if (lastArgs) {
            func(...lastArgs);
            lastArgs = null;
          }
        }, remaining);
        if (timeoutId && typeof (timeoutId as any).unref === 'function') {
          (timeoutId as any).unref();
        }
      }
    }
  };
}
