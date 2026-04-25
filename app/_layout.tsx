import '../global.css';

import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold } from '@expo-google-fonts/outfit';
import {
  SourceSans3_400Regular,
  SourceSans3_600SemiBold,
  SourceSans3_700Bold,
} from '@expo-google-fonts/source-sans-3';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { supabase } from '@/lib/supabase';
import { envErrors, envOk } from '@/lib/env';
import { useAuth } from '@/store/auth';
import { readAdminSession } from '@/lib/admin-auth';
import { queryClient, asyncStoragePersister } from '@/lib/query-client';
import { configureForegroundHandler } from '@/lib/push';
import { useNotificationNavigation } from '@/hooks/use-notification-navigation';

try {
  configureForegroundHandler();
} catch {
  /* notification handler is best-effort; don't block boot */
}

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const HARD_HIDE_SPLASH_MS = 1000;

export default function RootLayout() {
  const setSession = useAuth((s) => s.setSession);
  const setAdmin = useAuth((s) => s.setAdmin);
  const setLoading = useAuth((s) => s.setLoading);

  const [bootError, setBootError] = useState<string | null>(null);

  // Notification routing is non-critical — wrap in safe call.
  try {
    useNotificationNavigation();
  } catch {
    /* ignore */
  }

  // Fonts — render shell regardless of result.
  useFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    SourceSans3_400Regular,
    SourceSans3_600SemiBold,
    SourceSans3_700Bold,
  });

  // Always hide native splash within 1s — never gate on fonts/boot.
  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => undefined), HARD_HIDE_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  // Surface env errors visibly instead of silent hang.
  useEffect(() => {
    if (!envOk) {
      setBootError(`Missing env: ${envErrors.join(', ')}`);
      setLoading(false);
    }
  }, [setLoading]);

  // Load session in background — never blocks UI rendering.
  useEffect(() => {
    if (!envOk) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const [sessionResult, admin] = await Promise.all([
          supabase.auth.getSession().catch(() => ({ data: { session: null } })),
          readAdminSession().catch(() => null),
        ]);
        if (cancelled) return;
        setSession(sessionResult.data.session ?? null);
        setAdmin(admin);
        setLoading(false);

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          setSession(session);
        });
        cleanup = () => data.subscription.unsubscribe();
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [setSession, setAdmin, setLoading]);

  if (bootError) {
    return <BootErrorScreen message={bootError} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: asyncStoragePersister,
            maxAge: 1000 * 60 * 60 * 24,
          }}
        >
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth-callback" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(customer)" />
            <Stack.Screen name="(vendor)" />
            <Stack.Screen name="(admin)" />
          </Stack>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function BootErrorScreen({ message }: { message: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#1746A2',
      }}
    >
      <Text style={{ color: 'white', fontSize: 22, fontWeight: '800', marginBottom: 12 }}>
        Configuration error
      </Text>
      <Text style={{ color: 'white', textAlign: 'center', marginBottom: 16, opacity: 0.85 }}>
        {message}
      </Text>
      <Text style={{ color: 'white', textAlign: 'center', opacity: 0.7, fontSize: 12 }}>
        Reinstall the latest build, or contact support if this persists.
      </Text>
      <Pressable
        onPress={() => SplashScreen.hideAsync().catch(() => undefined)}
        style={{
          marginTop: 24,
          backgroundColor: 'white',
          paddingHorizontal: 20,
          paddingVertical: 10,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: '#1746A2', fontWeight: '700' }}>OK</Text>
      </Pressable>
    </View>
  );
}
