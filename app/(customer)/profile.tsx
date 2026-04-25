import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import {
  ChevronRight,
  LogOut,
  Receipt,
  Bell,
  Leaf,
  Settings,
  CircleHelp,
  Store,
} from 'lucide-react-native';
import { useAuth } from '@/store/auth';
import { LSApi } from '@/lib/api';
import { Container } from '@/components/ui/Container';
import { Logo } from '@/components/ui/Logo';

export default function Profile() {
  const router = useRouter();
  const profile = useAuth((s) => s.profile);
  const reset = useAuth((s) => s.reset);

  const signOut = () => {
    Alert.alert('Sign out?', 'You will need to sign in again to continue.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await LSApi.signOut();
          reset();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <Container style={{ padding: 20 }}>
          <View className="flex-row items-center justify-between">
            <Logo size={32} variant="lockup" />
          </View>
          <View className="items-center pt-6">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-primary">
              <Text className="font-display text-2xl font-extrabold text-white">
                {(profile?.full_name ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text className="mt-3 font-display text-xl font-bold text-ink">
              {profile?.full_name ?? 'Guest'}
            </Text>
            <Text className="text-sm text-ink-2">{profile?.email ?? ''}</Text>
            {profile?.reg_no ? (
              <Text className="mt-1 text-xs text-ink-2">{profile.reg_no}</Text>
            ) : null}
          </View>

          <View className="mt-8 gap-1 rounded-lg bg-surface">
            <Row
              label="Edit profile"
              icon={<Settings color="#1746A2" size={20} />}
              href="/(customer)/profile/edit"
            />
            <Row
              label="My bills"
              icon={<Receipt color="#1746A2" size={20} />}
              href="/(customer)/profile/bills"
            />
            <Row
              label="Our laundry partner"
              icon={<Store color="#1746A2" size={20} />}
              href="/(customer)/vendor/profab"
            />
            <Row
              label="Notifications"
              icon={<Bell color="#1746A2" size={20} />}
              href="/(customer)/profile/notifications"
            />
            <Row
              label="Green mode"
              icon={<Leaf color="#15803D" size={20} />}
              href="/(customer)/green"
            />
            <Row
              label="Help + support"
              icon={<CircleHelp color="#1746A2" size={20} />}
              href="/(customer)/profile/help"
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

function Row({ label, icon, href }: { label: string; icon: React.ReactNode; href: any }) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        className="flex-row items-center gap-3 border-b border-border px-4 py-4"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-light">
          {icon}
        </View>
        <Text className="flex-1 font-semibold text-ink">{label}</Text>
        <ChevronRight color="#94A3B8" size={18} />
      </Pressable>
    </Link>
  );
}
