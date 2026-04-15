import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { MobileApi } from '@/lib/mobile-api';
import type { UserNotificationRow } from '@/lib/api-types';

export default function NotificationsScreen() {
  const [rows, setRows] = useState<UserNotificationRow[]>([]);

  const load = useCallback(async () => {
    const n = await MobileApi.fetchNotifications();
    setRows(n ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      onRefresh={load}
      refreshing={false}
      ListEmptyComponent={<Text style={styles.empty}>No notifications.</Text>}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <Card.Title title={item.title} subtitle={item.sent_at ?? ''} />
          {item.body ? (
            <Card.Content>
              <Text variant="bodyMedium">{item.body}</Text>
            </Card.Content>
          ) : null}
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  card: { marginBottom: 12 },
  empty: { textAlign: 'center', marginTop: 32 },
});
