import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

/**
 * OAuth deep-link landing route.
 *
 * `WebBrowser.openAuthSessionAsync` already captures the redirect URL and
 * `signInWithGoogle()` calls `exchangeCodeForSession`, but on Android the
 * browser intent ALSO fires the laundroswipe://auth-callback deep link in
 * parallel — expo-router shows "No matching route" if this file doesn't
 * exist. Route exists, exchanges any leftover `?code` defensively, then
 * redirects to /.
 */
export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (params.code) {
          await supabase.auth.exchangeCodeForSession(String(params.code)).catch(() => undefined);
        }
      } finally {
        if (!cancelled) router.replace('/');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.code, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1746A2',
      }}
    >
      <ActivityIndicator color="#fff" />
      <Text style={{ marginTop: 16, color: 'white', opacity: 0.85 }}>Signing you in…</Text>
    </View>
  );
}
