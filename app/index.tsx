import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth, resolveRole } from '@/store/auth';
import { useProfile } from '@/hooks/use-profile';
import { needsStudentHostelDetails, isCampusCollegeStudent } from '@/lib/profile-gate';

export default function Index() {
  const { loading, session, admin, profile } = useAuth();
  const profileQuery = useProfile();

  if (loading || (session && profileQuery.isLoading && !profile)) {
    return (
      <View className="flex-1 items-center justify-center bg-primary">
        <ActivityIndicator color="#fff" />
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
