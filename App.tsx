import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from './src/app/providers/AppProvider';
import { AppNavigator } from './src/app/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AppProvider>
            <StatusBar style="light" />
            <AppNavigator />
          </AppProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#070A11',
  },
});
