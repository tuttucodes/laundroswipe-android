import { useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { useAuth } from '@/contexts/AuthContext';

export default function CustomerHome() {
  const router = useRouter();
  const { profile } = useAuth();

  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge">Hi{profile?.full_name ? `, ${profile.full_name}` : ''}</Text>
          <Text variant="bodyMedium" style={styles.mt}>
            Book a pickup, track orders, and view bills from the tabs below.
          </Text>
          <Button mode="contained" onPress={() => router.push('/(customer)/schedule')} style={styles.mt}>
            Book pickup
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  card: { marginTop: 8 },
  mt: { marginTop: 12 },
});
