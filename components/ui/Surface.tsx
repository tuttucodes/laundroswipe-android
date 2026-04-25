import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { shadow } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  /** Bare card background — defaults to white. */
  tone?: 'surface' | 'primary-light' | 'teal-light' | 'orange-light';
  /** Elevation level. */
  elevation?: 'flat' | 'card' | 'high';
  style?: ViewStyle;
  /** Tailwind classes (NativeWind) merged with the resolved tone. */
  className?: string;
};

const TONE_TO_CLASS: Record<NonNullable<Props['tone']>, string> = {
  surface: 'bg-surface',
  'primary-light': 'bg-primary-light',
  'teal-light': 'bg-teal-light',
  'orange-light': 'bg-orange-light',
};

/**
 * Cards with consistent corner radius, layered shadow, and tone variants.
 * Prefer this over ad-hoc `bg-surface rounded-lg p-4` blocks.
 */
export function Surface({
  children,
  tone = 'surface',
  elevation = 'card',
  style,
  className,
}: Props) {
  const elevationStyle =
    elevation === 'flat' ? null : elevation === 'high' ? shadow.elevated : shadow.card;
  return (
    <View
      style={[elevationStyle, style]}
      className={`rounded-lg ${TONE_TO_CLASS[tone]} ${className ?? ''}`.trim()}
    >
      {children}
    </View>
  );
}
