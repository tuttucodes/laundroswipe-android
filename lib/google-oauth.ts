import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

/**
 * Supabase hosted OAuth + in-app browser. No Google native client ID needed;
 * Supabase dashboard has Google configured with the Web client id.
 *
 * Flow:
 *   1. Ask Supabase for the OAuth authorize URL (skipBrowserRedirect so SDK doesn't try to nav).
 *   2. Open it in ASWebAuthenticationSession / Custom Tabs — user signs in with Google.
 *   3. Provider returns to laundroswipe://auth-callback with tokens in URL hash.
 *   4. Extract access_token + refresh_token from the callback URL and setSession().
 *
 * Supabase dashboard requirement (one-time): Auth → URL Configuration → Redirect URLs
 * must include `laundroswipe://auth-callback`. Otherwise Supabase rejects the return.
 */

WebBrowser.maybeCompleteAuthSession();

export type OAuthResult =
  | { ok: true }
  | { ok: false; reason: 'canceled' | 'dismiss' | 'no-url' | 'no-tokens'; error?: string };

function parseTokensFromCallback(
  url: string,
): { access_token: string; refresh_token: string } | null {
  try {
    const parsed = new URL(url);
    // Supabase returns tokens in the hash (#access_token=...&refresh_token=...).
    const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
    const params = new URLSearchParams(hash.length ? hash : parsed.search.slice(1));
    const access_token = params.get('access_token') ?? '';
    const refresh_token = params.get('refresh_token') ?? '';
    if (access_token && refresh_token) return { access_token, refresh_token };
    return null;
  } catch {
    return null;
  }
}

export async function signInWithGoogle(): Promise<OAuthResult> {
  const redirectTo = Linking.createURL('auth-callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    return { ok: false, reason: 'no-url', error: error?.message };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
    showInRecents: false,
    preferEphemeralSession: true,
  });

  if (result.type === 'cancel') return { ok: false, reason: 'canceled' };
  if (result.type === 'dismiss') return { ok: false, reason: 'dismiss' };
  if (result.type !== 'success' || !result.url) return { ok: false, reason: 'no-url' };

  const tokens = parseTokensFromCallback(result.url);
  if (!tokens) return { ok: false, reason: 'no-tokens' };

  const { error: setErr } = await supabase.auth.setSession(tokens);
  if (setErr) return { ok: false, reason: 'no-tokens', error: setErr.message };
  return { ok: true };
}
