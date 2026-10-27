import { SubtitleCue } from '../types/player';

/**
 * Parses timecode string into milliseconds.
 * Supports:
 * - 00:01:23,456 (SRT)
 * - 00:01:23.456 (WebVTT)
 * - 01:23.456 (WebVTT short)
 */
export function parseTimecodeToMs(timecode: string): number | null {
  if (!timecode) return null;
  const cleaned = timecode.trim().replace(',', '.');
  const parts = cleaned.split(':');

  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    if (isNaN(minutes) || isNaN(seconds)) return null;
    return Math.round((minutes * 60 + seconds) * 1000);
  }

  return null;
}

/**
 * Strips formatting tags like <b>, <i>, <font color="...">, and WebVTT tags.
 */
export function cleanSubtitleText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\{[^}]+\}/g, '')
    .trim();
}

/**
 * Robust SRT parser.
 * Handles CRLF, empty blocks, malformed index numbers, multi-line cues.
 */
export function parseSRT(content: string): SubtitleCue[] {
  if (!content || typeof content !== 'string') return [];

  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\n+/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    let timeLineIndex = 0;
    // Check if the first line is an integer index (1, 2, 3...)
    if (/^\d+$/.test(lines[0].trim())) {
      timeLineIndex = 1;
    }

    if (lines.length <= timeLineIndex) continue;

    const timeLine = lines[timeLineIndex];
    const match = timeLine.match(/(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})/);
    if (!match) continue;

    const startMs = parseTimecodeToMs(match[1]);
    const endMs = parseTimecodeToMs(match[2]);

    if (startMs === null || endMs === null || endMs < startMs) continue;

    const textLines = lines.slice(timeLineIndex + 1);
    const rawText = textLines.join('\n');
    const cleanedText = cleanSubtitleText(rawText);

    if (cleanedText) {
      cues.push({
        startTimeMs: startMs,
        endTimeMs: endMs,
        text: cleanedText,
      });
    }
  }

  return cues.sort((a, b) => a.startTimeMs - b.startTimeMs);
}

/**
 * Robust WebVTT parser.
 * Handles WEBVTT headers, NOTE blocks, cues, cue settings.
 */
export function parseWebVTT(content: string): SubtitleCue[] {
  if (!content || typeof content !== 'string') return [];

  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const cues: SubtitleCue[] = [];

  let i = 0;
  // Skip WEBVTT header
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.includes('-->')) {
      const match = line.match(/((?:\d{1,2}:)?\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[,\.]\d{1,3})/);
      if (match) {
        const startMs = parseTimecodeToMs(match[1]);
        const endMs = parseTimecodeToMs(match[2]);

        const textLines: string[] = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i]);
          i++;
        }

        if (startMs !== null && endMs !== null && endMs >= startMs) {
          const cleanedText = cleanSubtitleText(textLines.join('\n'));
          if (cleanedText) {
            cues.push({
              startTimeMs: startMs,
              endTimeMs: endMs,
              text: cleanedText,
            });
          }
        }
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return cues.sort((a, b) => a.startTimeMs - b.startTimeMs);
}

/**
 * Auto-detects format and parses subtitle content.
 */
export function parseSubtitleFile(content: string, filename?: string): SubtitleCue[] {
  if (!content) return [];

  const lower = content.trim().toLowerCase();
  const fileExt = filename?.toLowerCase() || '';

  if (fileExt.endsWith('.vtt') || lower.startsWith('webvtt')) {
    return parseWebVTT(content);
  }

  return parseSRT(content);
}

/**
 * Finds the currently active subtitle cue for a given playback position and sync offset.
 * @param cues Sorted list of subtitle cues
 * @param currentTimeMs Current player position
 * @param delayMs Synchronization delay offset in milliseconds (positive = subtitles delayed)
 */
export function getActiveCue(
  cues: SubtitleCue[],
  currentTimeMs: number,
  delayMs: number = 0
): SubtitleCue | null {
  if (!cues || cues.length === 0) return null;

  // The actual adjusted media time considering subtitle delay
  const adjustedTime = currentTimeMs - delayMs;

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (adjustedTime >= cue.startTimeMs && adjustedTime <= cue.endTimeMs) {
      return cue;
    }
    if (cue.startTimeMs > adjustedTime) {
      // Early exit since cues are sorted by start time
      break;
    }
  }

  return null;
}
