import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, envOk } from './env';

/**
 * Single Supabase client for the mobile app.
 *
 * Session persistence: AsyncStorage (JWT + refresh token). autoRefreshToken handles renewal
 * in the foreground; on cold start we still call `supabase.auth.getSession()` to load the
 * stored session before gating route groups.
 *
 * If env vars are missing (build misconfig), we still export a client built with safe
 * placeholder values so module import doesn't throw — the boot screen shows a helpful
 * "missing env" message instead of an infinite splash.
 */
const url = envOk ? env.supabaseUrl : 'https://placeholder.invalid';
const anonKey = envOk ? env.supabaseAnonKey : 'placeholder';

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export async function getAccessToken(): Promise<string | null> {
  if (!envOk) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
