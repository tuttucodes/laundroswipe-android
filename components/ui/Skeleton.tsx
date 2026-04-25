import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors } from '@/theme/tokens';

type Props = {
  height?: number;
  width?: number | string;
  radius?: number;
  style?: ViewStyle;
};

/**
 * Shimmer placeholder for content-loading states.
 * Honour reduced-motion by holding at the brighter shade.
 */
export function Skeleton({ height = 16, width = '100%', radius = 8, style }: Props) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      style={[
        {
          height,
          width: width as number,
          borderRadius: radius,
          backgroundColor: colors.border,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
            backgroundColor: colors.borderStrong,
          },
          animated,
        ]}
      />
    </View>
  );
}

export function SkeletonRow() {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 16,
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <Skeleton width={40} height={40} radius={20} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton height={14} width="55%" />
        <Skeleton height={11} width="80%" />
      </View>
      <Skeleton width={50} height={20} radius={10} />
    </View>
  );
}
