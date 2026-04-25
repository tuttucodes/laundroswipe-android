import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { ChevronLeft, ExternalLink, MessageCircle } from 'lucide-react-native';
import { LSApi } from '@/lib/api';

export default function VendorProfileScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const profileQuery = useQuery({
    queryKey: ['vendor-profile', slug],
    enabled: !!slug,
    queryFn: () => LSApi.fetchVendorProfile(String(slug)),
  });

  if (profileQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color="#1746A2" />
      </SafeAreaView>
    );
  }

  const profile = profileQuery.data;

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg px-8">
        <Text className="text-center font-display text-lg font-semibold text-ink">
          Vendor not found
        </Text>
        <Pressable onPress={() => router.back()} className="mt-6 rounded-lg bg-primary px-5 py-3">
          <Text className="text-sm font-semibold text-white">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 px-5 pt-3">
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface"
        >
          <ChevronLeft color="#1A1D2E" size={22} />
        </Pressable>
        <Text className="font-display text-lg font-bold text-ink">Vendor</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <Animated.View
          entering={FadeInDown.springify()}
          className="items-center rounded-lg bg-surface p-6"
        >
          {profile.logo_url ? (
            <Image
              source={{ uri: profile.logo_url }}
              style={{ width: 96, height: 96, borderRadius: 20 }}
              contentFit="cover"
            />
          ) : (
            <View className="h-24 w-24 items-center justify-center rounded-[20px] bg-primary">
              <Text className="font-display text-3xl font-extrabold text-white">
                {(profile.name ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text className="mt-4 font-display text-2xl font-bold text-ink">{profile.name}</Text>
          <Text className="text-xs text-ink-2">@{profile.slug}</Text>
        </Animated.View>

        {profile.brief ? (
          <Animated.View entering={FadeIn.delay(120)} className="mt-4 rounded-lg bg-surface p-4">
            <Text className="font-display text-sm font-bold text-ink-2">About</Text>
            <Text className="mt-2 text-sm text-ink">{profile.brief}</Text>
          </Animated.View>
        ) : null}

        {profile.pricing_details ? (
          <Animated.View entering={FadeIn.delay(180)} className="mt-4 rounded-lg bg-surface p-4">
            <Text className="font-display text-sm font-bold text-ink-2">Pricing</Text>
            <Text className="mt-2 text-sm text-ink" selectable>
              {profile.pricing_details}
            </Text>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeIn.delay(240)} className="mt-6 gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => Linking.openURL(`https://laundroswipe.com/vendor/${profile.slug}`)}
            style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
            className="flex-row items-center justify-center gap-2 rounded-lg bg-primary py-3"
          >
            <ExternalLink color="#fff" size={18} />
            <Text className="text-sm font-semibold text-white">Open on laundroswipe.com</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => Linking.openURL('mailto:hello@laundroswipe.com')}
            style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
            className="flex-row items-center justify-center gap-2 rounded-lg border border-border bg-surface py-3"
          >
            <MessageCircle color="#1A1D2E" size={18} />
            <Text className="text-sm font-semibold text-ink">Contact support</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
