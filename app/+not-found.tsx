import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="font-display text-2xl font-bold text-ink">Screen not found</Text>
          <Link href="/" className="mt-6 text-primary">
            Go home
          </Link>
        </View>
      </SafeAreaView>
    </>
  );
}
