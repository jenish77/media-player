import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Detects if the current runtime is the Expo Go app.
 */
export const isExpoGo: boolean =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any).appOwnership === 'expo';

/**
 * Detects if the current runtime is a standalone native build (e.g. Production APK or Dev Build).
 */
export const isStandaloneBuild: boolean = !isExpoGo;
