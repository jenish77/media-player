export const palette = {
  // Slate background hierarchy
  slate950: '#070A11',
  slate900: '#0F172A',
  slate800: '#1E293B',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
  white: '#FFFFFF',
  black: '#000000',

  // Brand Accents
  primary500: '#6366F1', // Indigo
  primary400: '#818CF8',
  primary600: '#4F46E5',

  accentCyan: '#38BDF8', // Cyan
  accentCyanGlow: 'rgba(56, 189, 248, 0.25)',

  // Feedback
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Overlays
  overlayDark80: 'rgba(0, 0, 0, 0.80)',
  overlayDark50: 'rgba(0, 0, 0, 0.50)',
  overlayGlass: 'rgba(30, 41, 59, 0.75)',
};

export const darkTheme = {
  background: palette.slate950,
  surface: palette.slate900,
  surfaceVariant: palette.slate800,
  surfaceElevated: '#243248',
  border: palette.slate700,
  borderSubtle: '#263346',
  text: palette.slate50,
  textSecondary: palette.slate400,
  textMuted: palette.slate500,
  primary: palette.primary500,
  primaryLight: palette.primary400,
  accent: palette.accentCyan,
  accentGlow: palette.accentCyanGlow,
  danger: palette.error,
  success: palette.success,
  warning: palette.warning,
  cardBackground: palette.slate900,
  playerBackground: palette.black,
  overlay: palette.overlayDark80,
  glass: palette.overlayGlass,
};

export const lightTheme = {
  background: palette.slate50,
  surface: palette.white,
  surfaceVariant: palette.slate100,
  surfaceElevated: palette.slate200,
  border: palette.slate300,
  borderSubtle: palette.slate200,
  text: palette.slate950,
  textSecondary: palette.slate600,
  textMuted: palette.slate400,
  primary: palette.primary600,
  primaryLight: palette.primary500,
  accent: '#0284C7',
  accentGlow: 'rgba(2, 132, 199, 0.15)',
  danger: palette.error,
  success: palette.success,
  warning: palette.warning,
  cardBackground: palette.white,
  playerBackground: palette.black,
  overlay: palette.overlayDark50,
  glass: 'rgba(255, 255, 255, 0.85)',
};

export type ThemeColors = typeof darkTheme;
