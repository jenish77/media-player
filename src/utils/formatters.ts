/**
 * Formats duration in milliseconds into "MM:SS" or "HH:MM:SS" format.
 * Resilient against null, undefined, NaN, and negative numbers.
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || isNaN(ms) || ms < 0) {
    return '00:00';
  }

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const paddedHours = String(hours).padStart(2, '0');
    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
}

/**
 * Formats file size in bytes to a human-readable string (B, KB, MB, GB).
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const digitGroups = Math.min(Math.floor(Math.log10(bytes) / Math.log10(1024)), units.length - 1);

  const value = bytes / Math.pow(1024, digitGroups);
  return `${value.toFixed(digitGroups === 0 ? 0 : 1)} ${units[digitGroups]}`;
}

/**
 * Formats a UNIX timestamp (ms) into a localized readable date string.
 */
export function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
    return 'Unknown date';
  }

  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Unknown date';
  }
}
