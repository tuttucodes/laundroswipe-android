export const env = {
  supabaseUrl: String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim(),
  supabaseAnonKey: String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim(),
  apiBaseUrl: String(process.env.EXPO_PUBLIC_API_BASE_URL ?? '')
    .trim()
    .replace(/\/$/, ''),
};

export function assertEnv(): string | null {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY';
  if (!env.apiBaseUrl)
    return 'Set EXPO_PUBLIC_API_BASE_URL (e.g. https://api.laundroswipe.com) or add it to eas.json build.env for EAS';
  return null;
}
