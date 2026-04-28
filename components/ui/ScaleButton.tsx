import React, { ComponentProps } from 'react';
import { Pressable, ViewStyle, StyleProp } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = ComponentProps<typeof Pressable> & {
  scaleTo?: number;
  hapticMode?: 'light' | 'medium' | 'heavy' | 'selection' | 'none';
  // Allow passing raw or animated style objects properly typed
  style?: StyleProp<ViewStyle> | any;
};

export function ScaleButton({ 
  children, 
  scaleTo = 0.96, 
  hapticMode = 'light',
  onPressIn,
  onPressOut,
  style,
  disabled,
  ...props 
}: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      disabled={disabled}
      {...props}
      style={[style, animatedStyle, disabled && { opacity: 0.7 }]}
      onPressIn={(e) => {
        if (!disabled) {
          scale.value = withSpring(scaleTo, { damping: 15, stiffness: 300, mass: 0.5 });
          if (hapticMode !== 'none') {
            if (hapticMode === 'selection') {
              Haptics.selectionAsync().catch(() => null);
            } else {
              const style = 
                hapticMode === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy :
                hapticMode === 'medium' ? Haptics.ImpactFeedbackStyle.Medium :
                Haptics.ImpactFeedbackStyle.Light;
              Haptics.impactAsync(style).catch(() => null);
            }
          }
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!disabled) {
          scale.value = withSpring(1, { damping: 15, stiffness: 300, mass: 0.5 });
        }
        onPressOut?.(e);
      }}
    >
      {typeof children === 'function' ? children({ pressed: false } as any) : children}
    </AnimatedPressable>
  );
}
