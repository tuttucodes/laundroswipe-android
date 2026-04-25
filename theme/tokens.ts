// Brand tokens mirrored from the web app (app/globals.css :root).
// Single source of truth for mobile — import these, do not redeclare.

export const colors = {
  primary: '#1746A2',
  primaryLight: '#E8EEFB',
  primaryMid: '#3B6FD4',
  teal: '#0D9488',
  tealLight: '#CCFBF1',
  orange: '#F97316',
  orangeLight: '#FFF7ED',
  accent: '#E8523F',

  bg: '#F8FAFC',
  surface: '#FFFFFF',

  text: '#1A1D2E',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  border: '#E2E8F0',
  borderStrong: '#CBD5E1',

  success: '#15803D',
  error: '#DC2626',

  dark: {
    bg: '#0B1220',
    surface: '#151C2E',
    text: '#F1F5F9',
  },
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999,
} as const;

export const spacing = {
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  elevated: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
} as const;

export const typography = {
  display: 'Outfit',
  body: 'SourceSans3',
} as const;

export type Colors = typeof colors;
export type Radii = typeof radii;
export type Spacing = typeof spacing;
