import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

/**
 * Supabase hosted OAuth + in-app browser, PKCE flow.
 *
 * Flow:
 *   1. Ask Supabase for the authorize URL (skipBrowserRedirect so SDK doesn't navigate).
 *      With `flowType: 'pkce'` on the client, Supabase issues a `code` to the redirect URI.
 *   2. Open URL in ASWebAuthenticationSession (iOS) / Custom Tabs (Android).
 *   3. User signs in with Google → provider returns to laundroswipe://auth-callback?code=...
 *   4. Extract `code` from the callback URL and call exchangeCodeForSession.
 *
 * Supabase dashboard requirement (one-time): Auth → URL Configuration → Redirect URLs
 * must include `laundroswipe://auth-callback`. Otherwise Supabase rejects the return
 * and falls back to Site URL (i.e. the web app).
 */

WebBrowser.maybeCompleteAuthSession();

export type OAuthResult =
  | { ok: true }
  | { ok: false; reason: 'canceled' | 'dismiss' | 'no-url' | 'no-code' | 'exchange-failed'; error?: string };

function extractCodeFromCallback(url: string): string | null {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');
    if (code) return code;
    // Fallback: some providers stuff params into the hash.
    const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
    if (hash) {
      const params = new URLSearchParams(hash);
      const fromHash = params.get('code');
      if (fromHash) return fromHash;
    }
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

  const code = extractCodeFromCallback(result.url);
  if (!code) return { ok: false, reason: 'no-code' };

  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeErr) {
    return { ok: false, reason: 'exchange-failed', error: exchangeErr.message };
  }
  return { ok: true };
}
