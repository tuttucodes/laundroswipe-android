import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { env } from './env';

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let client: SupabaseClient | null = null;

if (
  env.supabaseUrl &&
  env.supabaseAnonKey &&
  env.supabaseUrl !== 'YOUR_SUPABASE_URL_HERE' &&
  env.supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY_HERE'
) {
  client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: secureStoreAdapter,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

export { client as supabase };
export const hasSupabase = !!client;
