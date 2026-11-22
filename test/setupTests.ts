// Mock for Jest testing environment

require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text } = require('react-native');

  return {
    __esModule: true,
    default: {
      View,
      Text,
      createAnimatedComponent: (Component: any) => Component,
    },
    useSharedValue: (init: any) => ({ value: init }),
    useAnimatedStyle: (updater: any) => updater(),
    useEvent: (callback: any) => callback,
    useHandler: () => ({ doDependenciesDiffer: false, context: { lastUpdateEvent: undefined } }),
    useComposedEventHandler: () => jest.fn(),
    setGestureState: jest.fn(),
    isSharedValue: (val: any) => Boolean(val && typeof val === 'object' && 'value' in val),
    withTiming: (toValue: any) => toValue,
    withSpring: (toValue: any) => toValue,
    runOnJS: (fn: any) => fn,
    Easing: {
      linear: (n: any) => n,
      ease: (n: any) => n,
    },
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-screen-orientation
jest.mock('expo-screen-orientation', () => ({
  lockAsync: jest.fn().mockResolvedValue(undefined),
  unlockAsync: jest.fn().mockResolvedValue(undefined),
  OrientationLock: {
    LANDSCAPE: 3,
    PORTRAIT: 1,
  },
}));

// Mock expo-media-library
const mockMediaLibrary = {
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', canAskAgain: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', canAskAgain: true }),
  getAssetsAsync: jest.fn().mockResolvedValue({
    assets: [
      {
        id: 'asset_1',
        uri: 'file:///storage/emulated/0/Movies/sample_matrix.mp4',
        filename: 'sample_matrix.mp4',
        duration: 124.5,
        width: 1920,
        height: 1080,
        creationTime: 1680000000000,
      },
      {
        id: 'asset_2',
        uri: 'file:///storage/emulated/0/Download/anime_ep1.mkv',
        filename: 'anime_ep1.mkv',
        duration: 1420.0,
        width: 1920,
        height: 1080,
        creationTime: 1681000000000,
      },
    ],
  }),
  MediaType: { video: 'video' },
  SortBy: { creationTime: 'creationTime' },
  getAssetInfoAsync: jest.fn().mockImplementation(async (asset: any) => ({
    localUri: 'file:///storage/emulated/0/Movies/sample_matrix.mp4',
  })),
};
jest.mock('expo-media-library', () => mockMediaLibrary);
jest.mock('expo-media-library/legacy', () => mockMediaLibrary, { virtual: true });

// Mock expo-document-picker
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: 'file:///storage/emulated/0/Download/external_video.mp4',
        name: 'external_video.mp4',
        size: 52428800,
        mimeType: 'video/mp4',
      },
    ],
  }),
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn().mockResolvedValue(`1
00:00:01,000 --> 00:00:04,000
Welcome to Nova Player.

2
00:00:05,000 --> 00:00:08,500
Enjoy high-definition offline playback.
`),
}));

// Mock expo-image
jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: any) => React.createElement(View, { ...props, testID: props.testID || 'expo-image' }),
  };
});

// Mock expo-video
jest.mock('expo-video', () => ({
  createVideoPlayer: jest.fn().mockImplementation((source: any) => ({
    source,
    play: jest.fn(),
    pause: jest.fn(),
    currentTime: 0,
    duration: 120,
    timeUpdateEventInterval: 0.25,
    seekTolerance: { toleranceBefore: 0.5, toleranceAfter: 0.5 },
    generateThumbnailsAsync: jest.fn().mockImplementation(async (times: number[]) => {
      const srcStr = typeof source === 'string' ? source : (source?.uri || 'video');
      return [{ uri: `file:///storage/cache/thumbnails/${encodeURIComponent(srcStr)}.jpg` }];
    }),
    release: jest.fn(),
  })),
  VideoView: ({ style, testID }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { style, testID: testID || 'mock-video-view' });
  },
}));

// Mock react-native-google-mobile-ads
jest.mock('react-native-google-mobile-ads', () => {
  const React = require('react');
  const { View } = require('react-native');

  const mockListeners: { [event: string]: Function[] } = {};

  const mockInterstitialInstance = {
    load: jest.fn(() => {
      setTimeout(() => {
        if (mockListeners['loaded']) {
          mockListeners['loaded'].forEach((cb) => cb());
        }
      }, 0);
    }),
    show: jest.fn().mockImplementation(() => {
      setTimeout(() => {
        if (mockListeners['closed']) {
          mockListeners['closed'].forEach((cb) => cb());
        }
      }, 0);
      return Promise.resolve();
    }),
    addAdEventListener: jest.fn((event: string, callback: Function) => {
      if (!mockListeners[event]) {
        mockListeners[event] = [];
      }
      mockListeners[event].push(callback);
      return () => {
        mockListeners[event] = (mockListeners[event] || []).filter((cb) => cb !== callback);
      };
    }),
    removeAllListeners: jest.fn(() => {
      Object.keys(mockListeners).forEach((k) => delete mockListeners[k]);
    }),
  };

  return {
    __esModule: true,
    default: jest.fn(() => ({
      initialize: jest.fn().mockResolvedValue([{ state: 'READY' }]),
      setRequestConfiguration: jest.fn().mockResolvedValue(undefined),
    })),
    TestIds: {
      BANNER: 'ca-app-pub-3940256099942544/6300978111',
      INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
      REWARDED: 'ca-app-pub-3940256099942544/5224354917',
      APP_OPEN: 'ca-app-pub-3940256099942544/9257395921',
    },
    BannerAdSize: {
      ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER',
      BANNER: 'BANNER',
      FULL_BANNER: 'FULL_BANNER',
      LARGE_BANNER: 'LARGE_BANNER',
      LEADERBOARD: 'LEADERBOARD',
      MEDIUM_RECTANGLE: 'MEDIUM_RECTANGLE',
    },
    AdEventType: {
      LOADED: 'loaded',
      ERROR: 'error',
      OPENED: 'opened',
      CLOSED: 'closed',
      CLICKED: 'clicked',
    },
    BannerAd: (props: any) =>
      React.createElement(View, { ...props, testID: props.testID || 'mock-banner-ad' }),
    InterstitialAd: {
      createForAdRequest: jest.fn(() => mockInterstitialInstance),
    },
    AdsConsent: {
      requestInfoUpdate: jest.fn().mockResolvedValue({
        status: 'OBTAINED',
        canRequestAds: true,
        isConsentFormAvailable: false,
        privacyOptionsRequirementStatus: 'NOT_REQUIRED',
      }),
      loadAndShowConsentFormIfRequired: jest.fn().mockResolvedValue({
        status: 'OBTAINED',
        canRequestAds: true,
      }),
      showPrivacyOptionsForm: jest.fn().mockResolvedValue({
        status: 'OBTAINED',
        canRequestAds: true,
      }),
      reset: jest.fn().mockResolvedValue(undefined),
    },
    AdsConsentStatus: {
      UNKNOWN: 'UNKNOWN',
      NOT_REQUIRED: 'NOT_REQUIRED',
      REQUIRED: 'REQUIRED',
      OBTAINED: 'OBTAINED',
    },
    AdsConsentPrivacyOptionsRequirementStatus: {
      UNKNOWN: 'UNKNOWN',
      NOT_REQUIRED: 'NOT_REQUIRED',
      REQUIRED: 'REQUIRED',
    },
    AdsConsentDebugGeography: {
      DISABLED: 0,
      EEA: 1,
      OTHER: 2,
    },
  };
});

// Global timers mock cleanup
afterEach(() => {
  jest.clearAllMocks();
});

