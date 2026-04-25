import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { House, Receipt, User } from 'lucide-react-native';
import { colors, shadow } from '@/theme/tokens';

export default function CustomerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.select({ ios: 84, android: 64, default: 64 }),
          paddingTop: 6,
          ...shadow.elevated,
        },
        tabBarLabelStyle: {
          fontFamily: 'SourceSans3_600SemiBold',
          fontSize: 11,
          marginBottom: Platform.select({ ios: 0, android: 6, default: 4 }),
        },
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="schedule" options={{ href: null }} />
      <Tabs.Screen name="orders/[id]" options={{ href: null }} />
      <Tabs.Screen name="profile/edit" options={{ href: null }} />
      <Tabs.Screen name="profile/bills/index" options={{ href: null }} />
      <Tabs.Screen name="profile/bills/[id]" options={{ href: null }} />
      <Tabs.Screen name="vendor/[slug]" options={{ href: null }} />
      <Tabs.Screen name="profile/notifications" options={{ href: null }} />
      <Tabs.Screen name="profile/help" options={{ href: null }} />
      <Tabs.Screen name="green" options={{ href: null }} />
    </Tabs>
  );
}
