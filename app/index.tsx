import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth, resolveRole } from '@/store/auth';
import { useProfile } from '@/hooks/use-profile';
import { needsStudentHostelDetails, isCampusCollegeStudent } from '@/lib/profile-gate';

const STUCK_LOADING_MS = 4000;

export default function Index() {
  const router = useRouter();
  const { loading, session, admin, profile } = useAuth();
  const profileQuery = useProfile();
  const [showSkip, setShowSkip] = useState(false);

  const profileLoading = !!session && profileQuery.isLoading && !profile;
  const isLoading = loading || profileLoading;

  useEffect(() => {
    if (!isLoading) return;
    const t = setTimeout(() => setShowSkip(true), STUCK_LOADING_MS);
    return () => clearTimeout(t);
  }, [isLoading]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: '#1746A2',
        }}
      >
        <ActivityIndicator color="#fff" />
        <Text style={{ marginTop: 16, color: 'white', opacity: 0.85 }}>Loading…</Text>
        {showSkip ? (
          <Pressable
            onPress={() => router.replace('/(auth)/onboarding')}
            style={{
              marginTop: 32,
              backgroundColor: 'white',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#1746A2', fontWeight: '700' }}>Continue to sign in</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const role = resolveRole({ session, admin });

  if (role === 'super_admin') return <Redirect href="/(admin)/dashboard" />;
  if (role === 'vendor') return <Redirect href="/(vendor)/pos" />;

  if (role === 'customer') {
    const current = profile ?? profileQuery.data ?? null;
    if (current && isCampusCollegeStudent(current) && needsStudentHostelDetails(current)) {
      return <Redirect href="/(auth)/complete-profile" />;
    }
    return <Redirect href="/(customer)/home" />;
  }

  return <Redirect href="/(auth)/onboarding" />;
}
