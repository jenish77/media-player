import {
  interstitialManager,
  MIN_COMPLETED_VIDEOS,
  INTERSTITIAL_COOLDOWN_MS,
  MIN_WATCH_DURATION_MS,
} from '../../src/services/ads/interstitialManager';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] || null),
    setItem: jest.fn(async (key: string, val: string) => {
      store[key] = val;
    }),
    clear: jest.fn(async () => {
      store = {};
    }),
  };
});

describe('InterstitialManager Strategy & Frequency Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    interstitialManager.setMockState(0, Date.now(), false);
  });

  test('does not count videos watched for less than 20 seconds unless ended naturally', async () => {
    // 5 seconds without natural end -> ignored
    const count1 = await interstitialManager.recordVideoWatched(5000, false);
    expect(count1).toBe(0);

    // 25 seconds -> counted
    const count2 = await interstitialManager.recordVideoWatched(25000, false);
    expect(count2).toBe(1);

    // 2 seconds but ended naturally -> counted
    const count3 = await interstitialManager.recordVideoWatched(2000, true);
    expect(count3).toBe(2);
  });

  test('is not eligible immediately after app launch (cooldown not met)', () => {
    // Set 3 videos completed but timestamp is recent
    interstitialManager.setMockState(3, Date.now(), true);
    expect(interstitialManager.isEligible()).toBe(false);
  });

  test('is not eligible if fewer than 3 videos completed even if cooldown passed', () => {
    const elevenMinutesAgo = Date.now() - (11 * 60 * 1000);
    interstitialManager.setMockState(2, elevenMinutesAgo, true);
    expect(interstitialManager.isEligible()).toBe(false);
  });

  test('is not eligible if ad is not loaded', () => {
    const elevenMinutesAgo = Date.now() - (11 * 60 * 1000);
    interstitialManager.setMockState(3, elevenMinutesAgo, false); // isAdLoaded: false
    expect(interstitialManager.isEligible()).toBe(false);
  });

  test('isEligible returns true when all 3 conditions met (>=3 videos, 10m+ cooldown, ad loaded)', () => {
    const elevenMinutesAgo = Date.now() - (11 * 60 * 1000);
    interstitialManager.setMockState(3, elevenMinutesAgo, true);
    expect(interstitialManager.isEligible()).toBe(true);
  });

  test('does not show ad or throw error when not eligible on exit', async () => {
    interstitialManager.setMockState(1, Date.now(), false);
    const result = await interstitialManager.maybeShowOnExit();
    expect(result).toBe(false);
  });
});
