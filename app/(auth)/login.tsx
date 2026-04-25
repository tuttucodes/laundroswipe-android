import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { signInWithGoogle } from '@/lib/google-oauth';
import { useBreakpoint } from '@/hooks/use-breakpoint';

const LOGO = require('../../assets/images/icon.png');

export default function LoginScreen() {
  const [busy, setBusy] = useState(false);
  const { isTablet } = useBreakpoint();
  const tabletStyle = isTablet
    ? { maxWidth: 480, alignSelf: 'center' as const, width: '100%' as const }
    : null;

  const onGoogle = async () => {
    if (busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const res = await signInWithGoogle();
    setBusy(false);
    if (!res.ok) {
      if (res.reason === 'canceled' || res.reason === 'dismiss') return;
      Alert.alert('Sign in failed', res.error ?? 'Please try again.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <View style={tabletStyle} className="flex-1 justify-between px-6 py-10">
        <View className="items-center pt-16">
          <Animated.View entering={ZoomIn.springify().damping(14)}>
            <Image
              source={LOGO}
              style={{ width: 88, height: 88, borderRadius: 20 }}
              contentFit="contain"
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <Text className="mt-5 font-display text-5xl font-extrabold text-white">
              LaundroSwipe
            </Text>
          </Animated.View>
          <Animated.View entering={FadeIn.delay(350)}>
            <Text className="mt-3 text-center text-base text-white/80">
              Campus laundry, one swipe away.
            </Text>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.delay(500).springify()} className="gap-3">
          <Pressable
            onPress={onGoogle}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            className="min-h-[52px] flex-row items-center justify-center rounded-lg bg-white active:opacity-90"
            style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
          >
            {busy ? (
              <ActivityIndicator color="#1746A2" />
            ) : (
              <Text className="text-base font-semibold text-primary">Continue with Google</Text>
            )}
          </Pressable>

          <Link href="/(auth)/admin-login" asChild>
            <Pressable className="min-h-[44px] items-center justify-center rounded-sm">
              <Text className="text-sm text-white/80 underline">Vendor / staff sign in</Text>
            </Pressable>
          </Link>

          <Text className="mt-6 text-center text-xs text-white/60">
            By continuing you agree to the Terms and Privacy Policy.
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
