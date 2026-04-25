import { Image } from 'expo-image';
import { Text, View, type ViewStyle } from 'react-native';

const SOURCE = require('../../assets/images/icon.png');

type Props = {
  size?: number;
  variant?: 'mark' | 'lockup' | 'lockup-light';
  style?: ViewStyle;
};

export function Logo({ size = 56, variant = 'lockup', style }: Props) {
  if (variant === 'mark') {
    return (
      <Image
        source={SOURCE}
        style={[{ width: size, height: size, borderRadius: size * 0.22 }, style as any]}
        contentFit="contain"
      />
    );
  }
  const isLight = variant === 'lockup-light';
  return (
    <View style={style} className="flex-row items-center gap-3">
      <Image
        source={SOURCE}
        style={{ width: size, height: size, borderRadius: size * 0.22 }}
        contentFit="contain"
      />
      <View>
        <Text
          className={
            isLight
              ? 'font-display text-2xl font-extrabold text-white'
              : 'font-display text-2xl font-extrabold text-ink'
          }
        >
          LaundroSwipe
        </Text>
        <Text className={isLight ? 'text-[11px] text-white/70' : 'text-[11px] text-ink-2'}>
          Campus laundry, sorted.
        </Text>
      </View>
    </View>
  );
}
