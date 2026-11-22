import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { palette, darkTheme } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CRASH_LOG] Uncaught React exception:', error);
    console.error('[CRASH_LOG] Component stack:', errorInfo?.componentStack);
    this.setState({ errorInfo });
  }

  handleRestart = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || 'Unknown error occurred';
      const stack = this.state.error?.stack || this.state.errorInfo?.componentStack || '';

      return (
        <View style={styles.container}>
          <StatusBar barStyle="light-content" />
          <View style={styles.iconContainer}>
            <AlertTriangle size={48} color={palette.error} />
          </View>

          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            An unexpected error occurred. The app caught the issue instead of crashing.
          </Text>

          <ScrollView style={styles.errorBox} contentContainerStyle={styles.errorBoxContent}>
            <Text style={styles.errorTextTitle}>{errorMessage}</Text>
            {Boolean(stack) && <Text style={styles.stackText}>{stack}</Text>}
          </ScrollView>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.handleRestart}
            activeOpacity={0.8}
          >
            <RefreshCw size={18} color={palette.white} style={{ marginRight: 8 }} />
            <Text style={styles.retryButtonText}>Reload App</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: darkTheme.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyMedium,
    color: darkTheme.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  errorBox: {
    maxHeight: 220,
    width: '100%',
    backgroundColor: palette.slate800,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: palette.slate700,
    marginBottom: spacing.xl,
  },
  errorBoxContent: {
    padding: spacing.md,
  },
  errorTextTitle: {
    ...typography.bodySmall,
    color: palette.error,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  stackText: {
    ...typography.mono,
    color: palette.slate400,
    fontSize: 10,
    lineHeight: 14,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.primary500,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    ...typography.bodyMedium,
    color: palette.white,
    fontWeight: '600',
  },
});
