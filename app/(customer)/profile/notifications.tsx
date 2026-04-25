import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LSApi, type UserNotificationRow } from '@/lib/api';

export default function Notifications() {
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => LSApi.fetchNotifications(),
    staleTime: 30_000,
  });

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="px-5 pt-3">
        <Text className="font-display text-3xl font-bold text-ink">Notifications</Text>
      </View>
      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1746A2" />
        </View>
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 48 }}
          ListEmptyComponent={
            <View className="mt-16 items-center px-8">
              <Text className="text-center font-display text-lg font-semibold text-ink">
                You're all caught up
              </Text>
            </View>
          }
          renderItem={({ item }) => <NotifCard item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function NotifCard({ item }: { item: UserNotificationRow }) {
  return (
    <View className="rounded-lg bg-surface p-4">
      <Text className="font-display text-base font-bold text-ink">{item.title}</Text>
      {item.body ? <Text className="mt-1 text-sm text-ink-2">{item.body}</Text> : null}
      <Text className="mt-2 text-xs text-ink-2">{new Date(item.created_at).toLocaleString()}</Text>
    </View>
  );
}
