import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const androidAppId =
    process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ||
    'ca-app-pub-4691559300152959~5348736341';
  const iosAppId =
    process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ||
    'ca-app-pub-3940256099942544~1458002511';

  const plugins: ExpoConfig['plugins'] = (config.plugins || []).map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === 'react-native-google-mobile-ads') {
      const adPlugin: [string, any] = [
        'react-native-google-mobile-ads',
        {
          androidAppId,
          iosAppId,
        },
      ];
      return adPlugin;
    }
    return plugin;
  });

  return {
    ...config,
    name: config.name || 'Nova Player',
    slug: config.slug || 'nova-player',
    plugins,
  };
};
