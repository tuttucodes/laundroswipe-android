import { useEffect } from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ArrowRight } from 'lucide-react-native';

type Props = {
  label?: string;
  completedLabel?: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  /** Width is measured onLayout; threshold default 80% of track. */
  threshold?: number;
  style?: ViewStyle;
};

const THUMB_SIZE = 48;
const TRACK_HEIGHT = 56;
const TRACK_PADDING = 4;

/**
 * Reanimated + Gesture Handler port of components/SwipeToConfirm.tsx from the web app.
 * Haptic pulse at threshold; on release past threshold, fire `onConfirm` and spring fill full.
 */
export function SwipeToConfirm({
  label = 'Swipe to confirm',
  completedLabel = 'Confirmed',
  onConfirm,
  disabled = false,
  threshold = 0.8,
  style,
}: Props) {
  const trackWidth = useSharedValue(0);
  const drag = useSharedValue(0);
  const done = useSharedValue(false);

  useEffect(() => {
    if (disabled) {
      drag.value = withTiming(0);
      done.value = false;
    }
  }, [disabled, drag, done]);

  const fire = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    Promise.resolve(onConfirm()).catch(() => {
      drag.value = withSpring(0);
      done.value = false;
    });
  };

  const pulse = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onChange((e) => {
      if (done.value) return;
      const maxDrag = Math.max(0, trackWidth.value - THUMB_SIZE - TRACK_PADDING * 2);
      const next = Math.min(maxDrag, Math.max(0, drag.value + e.changeX));
      const wasBelow = drag.value < maxDrag * threshold;
      drag.value = next;
      if (wasBelow && next >= maxDrag * threshold) runOnJS(pulse)();
    })
    .onEnd(() => {
      const maxDrag = Math.max(0, trackWidth.value - THUMB_SIZE - TRACK_PADDING * 2);
      if (drag.value >= maxDrag * threshold) {
        done.value = true;
        drag.value = withSpring(maxDrag, { damping: 18, stiffness: 180 });
        runOnJS(fire)();
      } else {
        drag.value = withSpring(0);
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.value }],
  }));

  const fillStyle = useAnimatedStyle(() => {
    const maxDrag = Math.max(0, trackWidth.value - THUMB_SIZE - TRACK_PADDING * 2);
    const pct = maxDrag === 0 ? 0 : drag.value / maxDrag;
    return { width: `${Math.min(100, pct * 100 + 10)}%` };
  });

  const labelStyle = useAnimatedStyle(() => ({
    opacity: done.value ? 0 : 1,
  }));

  const successStyle = useAnimatedStyle(() => ({
    opacity: done.value ? 1 : 0,
  }));

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityHint="Slide right to confirm"
      style={[
        {
          height: TRACK_HEIGHT,
          borderRadius: TRACK_HEIGHT / 2,
          backgroundColor: 'rgba(2,6,23,0.08)',
          overflow: 'hidden',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      onLayout={(e) => {
        trackWidth.value = e.nativeEvent.layout.width;
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            backgroundColor: '#E8523F',
            borderRadius: TRACK_HEIGHT / 2,
          },
          fillStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'center',
          },
          labelStyle,
        ]}
      >
        <Text style={{ fontWeight: '700', color: 'rgba(15,23,42,0.7)' }}>{label}</Text>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'center',
          },
          successStyle,
        ]}
      >
        <Text style={{ fontWeight: '700', color: '#15803D' }}>{completedLabel}</Text>
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: TRACK_PADDING,
              left: TRACK_PADDING,
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: THUMB_SIZE / 2,
              backgroundColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            },
            thumbStyle,
          ]}
        >
          <ArrowRight color="#1746A2" size={22} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
