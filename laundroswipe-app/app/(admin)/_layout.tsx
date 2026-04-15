import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminLayout() {
  const router = useRouter();
  const { signOutAdmin } = useAuth();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerRight: () => (
          <Pressable
            onPress={async () => {
              await signOutAdmin();
              router.replace('/');
            }}
            style={{ marginRight: 16 }}
          >
            <Text variant="labelLarge">Sign out</Text>
          </Pressable>
        ),
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Hub' }} />
      <Stack.Screen name="bills" options={{ title: 'Bills' }} />
      <Stack.Screen name="printer" options={{ title: 'Bluetooth printer' }} />
    </Stack>
  );
}
