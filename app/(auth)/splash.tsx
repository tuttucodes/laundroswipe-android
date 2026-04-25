import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useAuth, resolveRole } from '@/store/auth';

const LOGO = require('../../assets/images/icon.png');

export default function Splash() {
  const router = useRouter();
  const loading = useAuth((s) => s.loading);
  const session = useAuth((s) => s.session);
  const admin = useAuth((s) => s.admin);

  useEffect(() => {
    if (loading) return;
    const role = resolveRole({ session, admin });
    if (role === 'super_admin') router.replace('/(admin)/dashboard');
    else if (role === 'vendor') router.replace('/(vendor)/pos');
    else if (role === 'customer') router.replace('/(customer)/home');
    else router.replace('/(auth)/onboarding');
  }, [loading, session, admin, router]);

  return (
    <View className="flex-1 items-center justify-center bg-primary">
      <Animated.View entering={ZoomIn.springify().damping(14)}>
        <Image
          source={LOGO}
          style={{ width: 96, height: 96, borderRadius: 22 }}
          contentFit="contain"
        />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(200).springify()}>
        <Text className="mt-6 font-display text-4xl font-extrabold text-white">LaundroSwipe</Text>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(500)}>
        <Text className="mt-2 text-sm text-white/70">Campus laundry, sorted.</Text>
      </Animated.View>
      <ActivityIndicator color="#fff" style={{ marginTop: 28 }} />
    </View>
  );
}
