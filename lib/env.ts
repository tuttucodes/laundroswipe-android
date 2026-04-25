/**
 * Expo env reader. EXPO_PUBLIC_* vars are inlined at build time by Expo's Metro transformer,
 * so `process.env.EXPO_PUBLIC_*` works on iOS/Android/web with identical values.
 *
 * IMPORTANT: this module is imported during root-layout boot (via lib/supabase.ts). It must
 * NEVER throw at import time — if it did, expo-router would fail to mount and the splash
 * screen would hang forever on production devices. We surface missing required vars via the
 * `envErrors` array so the UI can show a friendly screen instead of crashing.
 */

function maybeRequired(name: string, value: string | undefined, errors: string[]): string {
  if (!value || value.length === 0) {
    errors.push(name);
    return '';
  }
  return value;
}

function optional(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

const errors: string[] = [];

export const env = {
  supabaseUrl: maybeRequired(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    errors,
  ),
  supabaseAnonKey: maybeRequired(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    errors,
  ),
  webOrigin: maybeRequired(
    'EXPO_PUBLIC_WEB_ORIGIN',
    process.env.EXPO_PUBLIC_WEB_ORIGIN,
    errors,
  ),
  googleClientIdIos: optional(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS),
  googleClientIdAndroid: optional(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID),
  googleClientIdWeb: optional(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB),
  posthogKey: optional(process.env.EXPO_PUBLIC_POSTHOG_API_KEY),
  posthogHost: optional(process.env.EXPO_PUBLIC_POSTHOG_HOST),
} as const;

export const envErrors: ReadonlyArray<string> = errors;
export const envOk: boolean = errors.length === 0;

export type Env = typeof env;
