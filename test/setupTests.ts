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

// Global timers mock cleanup
afterEach(() => {
  jest.clearAllMocks();
});
