import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Single Supabase client for the mobile app.
 *
 * Session persistence: AsyncStorage (JWT + refresh token). autoRefreshToken handles renewal
 * in the foreground; on cold start we still call `supabase.auth.getSession()` to load the
 * stored session before gating route groups.
 *
 * `detectSessionInUrl: false` — native app never parses URLs the way web does. OAuth flows
 * use expo-auth-session + explicit `supabase.auth.setSession(...)` instead.
 */
export const supabase: SupabaseClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
