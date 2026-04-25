import { Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Help() {
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="p-6">
        <Text className="font-display text-3xl font-bold text-ink">Help + support</Text>
        <Text className="mt-2 text-sm text-ink-2">
          Reach us on WhatsApp or email — we aim to reply within an hour.
        </Text>

        <View className="mt-6 gap-3">
          <Pressable
            accessibilityRole="button"
            onPress={() => Linking.openURL('https://wa.me/919999999999')}
            className="min-h-[52px] items-center justify-center rounded-lg bg-primary"
          >
            <Text className="text-base font-semibold text-white">Chat on WhatsApp</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => Linking.openURL('mailto:hello@laundroswipe.com')}
            className="min-h-[52px] items-center justify-center rounded-lg border border-border bg-surface"
          >
            <Text className="text-base font-semibold text-ink">Email us</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
