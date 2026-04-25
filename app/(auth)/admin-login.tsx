import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { env } from '@/lib/env';
import { saveAdminSession } from '@/lib/admin-auth';
import { useAuth } from '@/store/auth';
import { Logo } from '@/components/ui/Logo';

type LoginResponse = {
  ok: boolean;
  role?: 'super_admin' | 'vendor';
  vendorId?: string | null;
  vendorDisplayName?: string | null;
  token?: string;
  error?: string;
};

export default function AdminLogin() {
  const router = useRouter();
  const setAdmin = useAuth((s) => s.setAdmin);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    try {
      const res = await fetch(`${env.webOrigin}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body: LoginResponse = await res
        .json()
        .catch(() => ({ ok: false, error: 'Invalid response' }));
      if (!res.ok || !body.ok || !body.token || !body.role) {
        Alert.alert('Sign in failed', body.error ?? 'Invalid email or password');
        return;
      }
      await saveAdminSession({
        token: body.token,
        role: body.role,
        vendorId: body.vendorId ?? null,
      });
      setAdmin({ token: body.token, role: body.role, vendorId: body.vendorId ?? null });
      router.replace('/');
    } catch (e) {
      Alert.alert('Sign in failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-1 px-6 py-8">
          <Animated.View entering={FadeInDown.springify()}>
            <Logo size={48} variant="lockup" />
          </Animated.View>
          <Animated.View entering={FadeIn.delay(150)}>
            <Text className="mt-8 font-display text-3xl font-bold text-ink">Staff sign in</Text>
            <Text className="mt-1 text-sm text-ink-2">Vendor + admin access only.</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(250).springify()} className="mt-8 gap-4">
            <View>
              <Text className="mb-1 text-sm font-semibold text-ink">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                className="min-h-[48px] rounded-sm border border-border bg-surface px-4 text-base text-ink"
              />
            </View>
            <View>
              <Text className="mb-1 text-sm font-semibold text-ink">Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                textContentType="password"
                className="min-h-[48px] rounded-sm border border-border bg-surface px-4 text-base text-ink"
              />
            </View>

            <Pressable
              onPress={submit}
              disabled={busy || !email.trim() || !password}
              accessibilityRole="button"
              className="mt-4 min-h-[52px] items-center justify-center rounded-lg bg-primary disabled:opacity-60"
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-semibold text-white">Sign in</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              className="items-center justify-center py-3"
            >
              <Text className="text-sm text-ink-2">Back to customer sign in</Text>
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
