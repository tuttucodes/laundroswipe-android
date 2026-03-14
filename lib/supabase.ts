import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

let client: SupabaseClient | null = null;
if (
  url &&
  key &&
  url !== 'YOUR_SUPABASE_URL_HERE' &&
  key !== 'YOUR_SUPABASE_ANON_KEY_HERE'
) {
  try {
    client = createClient(url, key);
  } catch (e) {
    console.error('Supabase client init failed', e);
  }
}

export { client as supabase };
export const hasSupabase = !!client;
