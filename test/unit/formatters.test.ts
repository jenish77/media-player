import { formatDuration, formatBytes, formatDate } from '../../src/utils/formatters';

describe('formatDuration', () => {
  it('should format 0 ms as 00:00', () => {
    expect(formatDuration(0)).toBe('00:00');
  });

  it('should format null, undefined, NaN, and negative as 00:00', () => {
    expect(formatDuration(null)).toBe('00:00');
    expect(formatDuration(undefined)).toBe('00:00');
    expect(formatDuration(NaN)).toBe('00:00');
    expect(formatDuration(-1500)).toBe('00:00');
  });

  it('should format sub-minute values correctly', () => {
    expect(formatDuration(5000)).toBe('00:05');
    expect(formatDuration(45000)).toBe('00:45');
  });

  it('should format minutes and seconds correctly', () => {
    expect(formatDuration(65000)).toBe('01:05');
    expect(formatDuration(599000)).toBe('09:59');
    expect(formatDuration(1800000)).toBe('30:00');
  });

  it('should format hours, minutes, and seconds correctly', () => {
    expect(formatDuration(3665000)).toBe('01:01:05');
    expect(formatDuration(7200000)).toBe('02:00:00');
  });
});

describe('formatBytes', () => {
  it('should format 0 or invalid bytes as 0 B', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(null)).toBe('0 B');
    expect(formatBytes(undefined)).toBe('0 B');
    expect(formatBytes(-100)).toBe('0 B');
  });

  it('should format bytes, KB, MB, GB accurately', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1572864)).toBe('1.5 MB');
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });
});

describe('formatDate', () => {
  it('should return "Unknown date" for null or invalid inputs', () => {
    expect(formatDate(0)).toBe('Unknown date');
    expect(formatDate(null)).toBe('Unknown date');
    expect(formatDate(undefined)).toBe('Unknown date');
  });

  it('should format valid timestamp into date string', () => {
    const timestamp = new Date('2026-05-15T12:00:00Z').getTime();
    const formatted = formatDate(timestamp);
    expect(typeof formatted).toBe('string');
    expect(formatted).not.toBe('Unknown date');
  });
});
