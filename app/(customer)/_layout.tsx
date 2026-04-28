import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { House, Receipt, User } from 'lucide-react-native';
import { colors, shadow } from '@/theme/tokens';
import { TabBar } from '@/components/ui/TabBar';

export default function CustomerLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
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
