import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  ListChecks,
  LogOut,
  Printer,
  ReceiptText,
  ScanQrCode,
  Store,
  TrendingUp,
} from 'lucide-react-native';
import { useAuth } from '@/store/auth';
import { clearAdminSession } from '@/lib/admin-auth';
import { Container } from '@/components/ui/Container';
import { Logo } from '@/components/ui/Logo';

export default function VendorMenu() {
  const router = useRouter();
  const admin = useAuth((s) => s.admin);
  const setAdmin = useAuth((s) => s.setAdmin);

  const signOut = () => {
    Alert.alert('Sign out?', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await clearAdminSession();
          setAdmin(null);
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 px-5 pt-3">
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface"
        >
          <ChevronLeft color="#1A1D2E" size={22} />
        </Pressable>
        <Text className="font-display text-lg font-bold text-ink">Menu</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <Container style={{ padding: 20 }}>
          <View className="flex-row items-center gap-3 rounded-lg bg-primary p-4">
            <Logo size={36} variant="mark" />
            <View>
              <Text className="text-xs font-semibold text-white/80">Vendor</Text>
              <Text className="font-display text-lg font-extrabold text-white">
                {admin?.vendorId ?? 'Staff'}
              </Text>
            </View>
          </View>

          <View className="mt-6 gap-1 rounded-lg bg-surface">
            <Row
              label="POS"
              icon={<Store color="#1746A2" size={20} />}
              onPress={() => router.replace('/(vendor)/pos')}
            />
            <Row
              label="Token lookup"
              icon={<ScanQrCode color="#1746A2" size={20} />}
              onPress={() => router.replace('/(vendor)/lookup')}
            />
            <Row
              label="All bills"
              icon={<ReceiptText color="#1746A2" size={20} />}
              onPress={() => router.replace('/(vendor)/bills')}
            />
            <Row
              label="Revenue dashboard"
              icon={<TrendingUp color="#1746A2" size={20} />}
              onPress={() => router.push('/(vendor)/revenue')}
            />
            <Row
              label="Catalog editor"
              icon={<ListChecks color="#1746A2" size={20} />}
              onPress={() => router.push('/(vendor)/catalog')}
            />
            <Row
              label="Printer settings"
              icon={<Printer color="#1746A2" size={20} />}
              onPress={() => router.push('/(vendor)/printer')}
              last
            />
          </View>

          <Pressable
            onPress={signOut}
            accessibilityRole="button"
            className="mt-8 min-h-[52px] flex-row items-center justify-center gap-2 rounded-lg border border-border bg-surface"
          >
            <LogOut color="#DC2626" size={20} />
            <Text className="font-semibold text-error">Sign out</Text>
          </Pressable>
        </Container>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  icon,
  onPress,
  last,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={
        last
          ? 'flex-row items-center gap-3 px-4 py-4'
          : 'flex-row items-center gap-3 border-b border-border px-4 py-4'
      }
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-light">
        {icon}
      </View>
      <Text className="flex-1 font-semibold text-ink">{label}</Text>
      <ChevronRight color="#94A3B8" size={18} />
    </Pressable>
  );
}
