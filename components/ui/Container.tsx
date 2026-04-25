import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useBreakpoint, containerWidthStyle } from '@/hooks/use-breakpoint';

type Props = {
  children: ReactNode;
  /** Outer wrapper style — applied before centering. */
  style?: ViewStyle;
  /** Skip the max-width clamp (full-bleed sections). */
  bleed?: boolean;
};

/**
 * Centers content with a tablet-friendly max width.
 * Phones: full width. Tablets/landscape: clamped to 720px and centered.
 */
export function Container({ children, style, bleed }: Props) {
  const { width, isTablet } = useBreakpoint();
  if (bleed || !isTablet) {
    return <View style={[{ width: '100%' }, style]}>{children}</View>;
  }
  return (
    <View style={[{ width: '100%' }, style]}>
      <View style={[containerWidthStyle(width), { width: '100%' }]}>{children}</View>
    </View>
  );
}
