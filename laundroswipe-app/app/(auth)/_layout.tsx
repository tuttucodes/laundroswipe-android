import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerTitleAlign: 'center' }}>
      <Stack.Screen name="welcome" options={{ title: 'LaundroSwipe' }} />
      <Stack.Screen name="staff" options={{ title: 'Staff login' }} />
    </Stack>
  );
}
