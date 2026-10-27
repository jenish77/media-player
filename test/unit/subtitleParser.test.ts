import {
  parseSRT,
  parseWebVTT,
  parseSubtitleFile,
  getActiveCue,
  parseTimecodeToMs,
  cleanSubtitleText,
} from '../../src/utils/subtitleParser';

describe('Subtitle Timecode Parsing', () => {
  it('parses standard SRT timecode (00:01:23,456)', () => {
    const ms = parseTimecodeToMs('00:01:23,456');
    expect(ms).toBe(83456); // 1*60*1000 + 23*1000 + 456
  });

  it('parses standard WebVTT timecode (00:02:10.500)', () => {
    const ms = parseTimecodeToMs('00:02:10.500');
    expect(ms).toBe(130500);
  });

  it('parses short WebVTT timecode (01:15.250)', () => {
    const ms = parseTimecodeToMs('01:15.250');
    expect(ms).toBe(75250);
  });

  it('returns null on malformed timecodes', () => {
    expect(parseTimecodeToMs('')).toBeNull();
    expect(parseTimecodeToMs('invalid:time')).toBeNull();
  });
});

describe('Subtitle Text Cleaning', () => {
  it('removes HTML tags from subtitle lines', () => {
    const input = '<b>Hello</b> <i>World</i> with <font color="#fff">color</font>';
    expect(cleanSubtitleText(input)).toBe('Hello World with color');
  });

  it('removes SSA style tags like {\\an8}', () => {
    const input = '{\\an8}Top aligned subtitle';
    expect(cleanSubtitleText(input)).toBe('Top aligned subtitle');
  });
});

describe('parseSRT', () => {
  const sampleSRT = `1
00:00:01,000 --> 00:00:04,000
Welcome to Nova Player!

2
00:00:05,500 --> 00:00:08,000
<b>High definition</b> offline player.
`;

  it('correctly parses SRT blocks into SubtitleCue objects', () => {
    const cues = parseSRT(sampleSRT);
    expect(cues).toHaveLength(2);

    expect(cues[0].startTimeMs).toBe(1000);
    expect(cues[0].endTimeMs).toBe(4000);
    expect(cues[0].text).toBe('Welcome to Nova Player!');

    expect(cues[1].startTimeMs).toBe(5500);
    expect(cues[1].endTimeMs).toBe(8000);
    expect(cues[1].text).toBe('High definition offline player.');
  });

  it('handles empty or corrupted input gracefully', () => {
    expect(parseSRT('')).toEqual([]);
    expect(parseSRT('random non subtitle text')).toEqual([]);
  });
});

describe('parseWebVTT', () => {
  const sampleVTT = `WEBVTT

NOTE This is a commentary note

00:01.000 --> 00:04.000 line:0 position:20%
First cue of WebVTT

00:05.000 --> 00:08.000
Second cue of WebVTT
`;

  it('correctly parses WebVTT cues ignoring headers and notes', () => {
    const cues = parseWebVTT(sampleVTT);
    expect(cues).toHaveLength(2);
    expect(cues[0].startTimeMs).toBe(1000);
    expect(cues[0].endTimeMs).toBe(4000);
    expect(cues[0].text).toBe('First cue of WebVTT');

    expect(cues[1].startTimeMs).toBe(5000);
    expect(cues[1].endTimeMs).toBe(8000);
    expect(cues[1].text).toBe('Second cue of WebVTT');
  });
});

describe('getActiveCue and delay synchronization', () => {
  const cues = [
    { startTimeMs: 1000, endTimeMs: 4000, text: 'Cue 1' },
    { startTimeMs: 5000, endTimeMs: 8000, text: 'Cue 2' },
  ];

  it('finds active cue within interval with 0 delay', () => {
    expect(getActiveCue(cues, 2500, 0)?.text).toBe('Cue 1');
    expect(getActiveCue(cues, 6000, 0)?.text).toBe('Cue 2');
    expect(getActiveCue(cues, 4500, 0)).toBeNull(); // in-between
    expect(getActiveCue(cues, 9000, 0)).toBeNull(); // after
  });

  it('adjusts active cue with positive delay (subtitles delayed)', () => {
    // Media is at 2500ms, but subtitle has delay of +1000ms:
    // adjusted time = 2500 - 1000 = 1500ms (within 1000-4000ms)
    expect(getActiveCue(cues, 2500, 1000)?.text).toBe('Cue 1');

    // Media is at 1500ms with +1000ms delay: adjusted = 500ms (before Cue 1)
    expect(getActiveCue(cues, 1500, 1000)).toBeNull();
  });

  it('adjusts active cue with negative delay (subtitles advanced)', () => {
    // Media at 500ms, with delay -500ms: adjusted = 500 - (-500) = 1000ms (starts Cue 1)
    expect(getActiveCue(cues, 500, -500)?.text).toBe('Cue 1');
  });
});
