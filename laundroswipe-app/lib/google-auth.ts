import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

function parseHashParams(url: string): Record<string, string> {
  const hashIdx = url.indexOf('#');
  if (hashIdx < 0) return {};
  const hash = url.slice(hashIdx + 1);
  const q = new URLSearchParams(hash);
  const out: Record<string, string> = {};
  q.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

async function applySessionFromUrl(url: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase not configured' };
  if (url.includes('code=')) {
    const { error } = await supabase.auth.exchangeCodeForSession(url);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const h = parseHashParams(url);
  const access_token = h.access_token;
  const refresh_token = h.refresh_token;
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  return { ok: false, error: 'No session in redirect URL' };
}

export async function signInWithGoogleNative(): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Supabase not configured' };
  const redirectTo = makeRedirectUri({ scheme: 'laundroswipeapp', path: 'auth' });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return { error: error?.message ?? 'No OAuth URL' };
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success' || !('url' in res) || !res.url) {
    if (res.type === 'cancel') return { error: 'Cancelled' };
    return { error: 'Sign-in failed' };
  }
  const applied = await applySessionFromUrl(res.url);
  if (!applied.ok) return { error: applied.error ?? 'Session error' };
  return {};
}
