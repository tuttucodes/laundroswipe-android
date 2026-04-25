import { Tabs } from 'expo-router';
import { LayoutDashboard, ScanQrCode, ReceiptText } from 'lucide-react-native';
import { colors } from '@/theme/tokens';

export default function VendorLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: 'SourceSans3_600SemiBold', fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="pos"
        options={{
          title: 'POS',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="lookup"
        options={{
          title: 'Lookup',
          tabBarIcon: ({ color, size }) => <ScanQrCode color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="bills/index"
        options={{
          title: 'Bills',
          tabBarIcon: ({ color, size }) => <ReceiptText color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="bill-builder" options={{ href: null }} />
      <Tabs.Screen name="bills/[id]" options={{ href: null }} />
      <Tabs.Screen name="printer" options={{ href: null }} />
      <Tabs.Screen name="catalog" options={{ href: null }} />
      <Tabs.Screen name="revenue" options={{ href: null }} />
      <Tabs.Screen name="menu" options={{ href: null }} />
    </Tabs>
  );
}
