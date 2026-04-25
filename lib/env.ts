/**
 * Expo env reader. EXPO_PUBLIC_* vars are inlined at build time by Expo's Metro transformer,
 * so `process.env.EXPO_PUBLIC_*` works on iOS/Android/web with identical values.
 * This module centralizes them so callers don't have to scatter string literals.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var ${name}. Add it to .env.local or EAS project env.`);
  }
  return value;
}

function optional(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),
  webOrigin: required('EXPO_PUBLIC_WEB_ORIGIN', process.env.EXPO_PUBLIC_WEB_ORIGIN),
  googleClientIdIos: optional(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS),
  googleClientIdAndroid: optional(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID),
  googleClientIdWeb: optional(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB),
  posthogKey: optional(process.env.EXPO_PUBLIC_POSTHOG_API_KEY),
  posthogHost: optional(process.env.EXPO_PUBLIC_POSTHOG_HOST),
} as const;

export type Env = typeof env;
