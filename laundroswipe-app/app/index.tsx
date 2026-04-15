import { Redirect } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { ready, mode } = useAuth();
  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (mode === 'admin') return <Redirect href="/(admin)" />;
  if (mode === 'customer') return <Redirect href="/(customer)/home" />;
  return <Redirect href="/(auth)/welcome" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
