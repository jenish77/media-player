import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Detects if the current runtime is the Expo Go client app.
 * In Expo Go, executionEnvironment is strictly ExecutionEnvironment.StoreClient.
 */
export const isExpoGo: boolean =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Detects if the current runtime is a standalone native build (e.g. Production APK or Dev Build).
 */
export const isStandaloneBuild: boolean = !isExpoGo;
