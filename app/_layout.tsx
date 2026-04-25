import '../global.css';

import { useEffect } from 'react';
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
import { useAuth } from '@/store/auth';
import { readAdminSession } from '@/lib/admin-auth';
import { queryClient, asyncStoragePersister } from '@/lib/query-client';
import { configureForegroundHandler } from '@/lib/push';
import { useNotificationNavigation } from '@/hooks/use-notification-navigation';

configureForegroundHandler();

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const setSession = useAuth((s) => s.setSession);
  const setAdmin = useAuth((s) => s.setAdmin);
  const setLoading = useAuth((s) => s.setLoading);
  useNotificationNavigation();

  const [fontsLoaded] = useFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    SourceSans3_400Regular,
    SourceSans3_600SemiBold,
    SourceSans3_700Bold,
  });

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      const [{ data: sessionData }, admin] = await Promise.all([
        supabase.auth.getSession(),
        readAdminSession(),
      ]);
      setSession(sessionData.session ?? null);
      setAdmin(admin);
      setLoading(false);

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });
      cleanup = () => data.subscription.unsubscribe();
    })();
    return () => cleanup?.();
  }, [setSession, setAdmin, setLoading]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

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
