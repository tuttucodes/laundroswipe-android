import { useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Logo } from '@/components/ui/Logo';

const { width: SCREEN_W } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '🧺',
    title: 'Campus laundry, sorted',
    copy: 'Schedule pickups in seconds. One tap, one swipe, done.',
    bg: '#E8EEFB',
  },
  {
    emoji: '🚚',
    title: 'Track every step',
    copy: 'From pickup to delivery — see where your clothes are in real time.',
    bg: '#CCFBF1',
  },
  {
    emoji: '💰',
    title: 'Pay only for what you get',
    copy: 'Transparent item-wise billing. No surprises.',
    bg: '#FFF7ED',
  },
] as const;

export default function Onboarding() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const scroller = useRef<ScrollView | null>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (idx !== slide) setSlide(idx);
  };

  const goTo = (idx: number) => {
    scroller.current?.scrollTo({ x: idx * SCREEN_W, animated: true });
  };

  const next = () => {
    if (slide < SLIDES.length - 1) goTo(slide + 1);
    else router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <Animated.View entering={FadeInDown.springify()} className="px-6 pt-4">
        <Logo size={36} variant="lockup" />
      </Animated.View>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
      >
        {SLIDES.map((s, i) => (
          <View
            key={s.title}
            style={{ width: SCREEN_W }}
            className="flex-1 items-center justify-center px-8"
          >
            <Animated.View
              key={`emoji-${i}`}
              entering={ZoomIn.delay(80).springify().damping(12)}
              className="h-40 w-40 items-center justify-center rounded-[40px]"
              style={{ backgroundColor: s.bg }}
            >
              <Text style={{ fontSize: 72 }}>{s.emoji}</Text>
            </Animated.View>
            <Animated.Text
              entering={FadeInDown.delay(180).springify()}
              className="mt-8 text-center font-display text-3xl font-bold text-ink"
            >
              {s.title}
            </Animated.Text>
            <Animated.Text
              entering={FadeIn.delay(320)}
              className="mt-3 max-w-[320px] text-center text-base text-ink-2"
            >
              {s.copy}
            </Animated.Text>
          </View>
        ))}
      </ScrollView>

      <View className="gap-5 px-8 pb-10 pt-4">
        <View className="flex-row items-center justify-center gap-2">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              className={
                i === slide
                  ? 'h-2 w-6 rounded-full bg-primary'
                  : 'h-2 w-2 rounded-full bg-border-strong'
              }
            />
          ))}
        </View>

        <Pressable
          onPress={next}
          accessibilityRole="button"
          className="min-h-[52px] items-center justify-center rounded-lg bg-primary"
        >
          <Text className="text-base font-semibold text-white">
            {slide < SLIDES.length - 1 ? 'Next' : 'Get started'}
          </Text>
        </Pressable>

        {slide < SLIDES.length - 1 ? (
          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            accessibilityRole="button"
            className="min-h-[44px] items-center justify-center"
          >
            <Text className="text-sm text-ink-2">Skip</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
