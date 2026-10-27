import { Platform } from 'react-native';
import { AspectRatioMode } from '../../types/media';

export interface PlayerCapabilities {
  supportsPiP: boolean;
  supportsBackgroundAudio: boolean;
  supportsExternalSubtitles: boolean;
  supportsEmbeddedSubtitles: boolean;
  supportsAudioTrackSwitching: boolean;
  supportsAudioDelay: boolean;
  supportsSubtitleDelay: boolean;
  supportsSpeedAdjustment: boolean;
  speedRange: [number, number];
  aspectRatioModes: AspectRatioMode[];
}

export function getDefaultCapabilities(): PlayerCapabilities {
  const isAndroid = Platform.OS === 'android';
  const isIOS = Platform.OS === 'ios';

  return {
    supportsPiP: isAndroid || isIOS,
    supportsBackgroundAudio: true,
    supportsExternalSubtitles: true,
    supportsEmbeddedSubtitles: true,
    supportsAudioTrackSwitching: true,
    supportsAudioDelay: true,
    supportsSubtitleDelay: true,
    supportsSpeedAdjustment: true,
    speedRange: [0.25, 2.0],
    aspectRatioModes: ['fit', 'fill', 'stretch', '16:9', '4:3', 'original'],
  };
}
