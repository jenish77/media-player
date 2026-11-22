import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

// Global uncaught JS error logging
declare const ErrorUtils: any;
if (typeof ErrorUtils !== 'undefined') {
  const defaultHandler = ErrorUtils.getGlobalHandler && ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    console.error('[CRASH_LOG] Uncaught Global JS Error (isFatal:', isFatal, '):', error);
    if (defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
