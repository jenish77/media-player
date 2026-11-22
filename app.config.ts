import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  // AdMob App ID single source of truth:
  // In production builds, injected via eas.json / process.env
  // In preview / local development, defaults to official Google test App IDs
  const androidAppId =
    process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ||
    'ca-app-pub-3940256099942544~3347511713';
  const iosAppId =
    process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ||
    'ca-app-pub-3940256099942544~1458002511';

  // Filter out any existing react-native-google-mobile-ads to avoid duplication
  const existingPlugins = (config.plugins || []).filter((plugin) => {
    if (typeof plugin === 'string') return plugin !== 'react-native-google-mobile-ads';
    if (Array.isArray(plugin)) return plugin[0] !== 'react-native-google-mobile-ads';
    return true;
  });

  const adPlugin: [string, any] = [
    'react-native-google-mobile-ads',
    {
      androidAppId,
      iosAppId,
    },
  ];

  return {
    ...config,
    name: config.name || 'Nova Player',
    slug: config.slug || 'nova-player',
    plugins: [...existingPlugins, adPlugin],
  };
};
