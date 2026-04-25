import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, TrendingUp } from 'lucide-react-native';
import { VendorApi } from '@/lib/vendor-api';
import { Container } from '@/components/ui/Container';

type Range = 'today' | '7d' | '30d';

const RANGES: ReadonlyArray<{ key: Range; label: string; days: number }> = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateRange(range: Range): { from: string; to: string; days: number } {
  const today = new Date();
  if (range === 'today') {
    const t = ymd(today);
    return { from: t, to: t, days: 1 };
  }
  const days = range === '7d' ? 7 : 30;
  const from = new Date(today);
  from.setDate(today.getDate() - (days - 1));
  return { from: ymd(from), to: ymd(today), days };
}

function fmtMoney(n: number): string {
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function VendorRevenue() {
  const router = useRouter();
  const [range, setRange] = useState<Range>('7d');
  const params = dateRange(range);

  const q = useQuery({
    queryKey: ['vendor-revenue', range, params.from, params.to],
    queryFn: () => VendorApi.revenue(params),
    staleTime: 60_000,
  });

  const buckets = q.data?.revenue ?? [];
  const maxBucketTotal = useMemo(() => {
    return buckets.reduce((m, b) => Math.max(m, Number(b.total) || 0), 0) || 1;
  }, [buckets]);

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
        <Text className="font-display text-lg font-bold text-ink">Revenue</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => q.refetch()}
            tintColor="#1746A2"
          />
        }
      >
        <Container style={{ padding: 20 }}>
          <View className="flex-row gap-2">
            {RANGES.map((r) => {
              const sel = r.key === range;
              return (
                <Pressable
                  key={r.key}
                  accessibilityRole="button"
                  onPress={() => setRange(r.key)}
                  className={
                    sel
                      ? 'flex-1 items-center rounded-full bg-primary py-2'
                      : 'flex-1 items-center rounded-full border border-border bg-surface py-2'
                  }
                >
                  <Text
                    className={
                      sel
                        ? 'text-xs font-semibold text-white'
                        : 'text-xs font-semibold text-ink'
                    }
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {q.isLoading ? (
            <ActivityIndicator color="#1746A2" className="mt-8" />
          ) : (
            <>
              <View className="mt-6 rounded-lg bg-primary p-5">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-xs font-semibold text-white/70">Total revenue</Text>
                    <Text className="mt-1 font-display text-3xl font-extrabold text-white">
                      {fmtMoney(q.data?.grand_total ?? 0)}
                    </Text>
                    <Text className="mt-1 text-xs text-white/80">
                      {q.data?.total_bills ?? 0} bills · {params.from} → {params.to}
                    </Text>
                  </View>
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-white/15">
                    <TrendingUp color="#fff" size={22} />
                  </View>
                </View>
              </View>

              <View className="mt-6 flex-row gap-3">
                <StatCard label="Subtotal" value={fmtMoney(q.data?.grand_subtotal ?? 0)} />
                <StatCard
                  label="Service fees"
                  value={fmtMoney(q.data?.grand_convenience_fee ?? 0)}
                />
              </View>

              <View className="mt-8">
                <Text className="font-display text-base font-bold text-ink">By day</Text>
                <View className="mt-3 gap-2">
                  {buckets.length === 0 ? (
                    <Text className="rounded-lg bg-surface p-4 text-xs text-ink-2">
                      No bills in this range.
                    </Text>
                  ) : (
                    buckets.map((b) => (
                      <DayRow
                        key={`${b.date_from}-${b.date_to}`}
                        date={b.date_from}
                        bills={b.bill_count}
                        total={Number(b.total) || 0}
                        max={maxBucketTotal}
                      />
                    ))
                  )}
                </View>
              </View>
            </>
          )}
        </Container>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-lg bg-surface p-4">
      <Text className="text-xs text-ink-2">{label}</Text>
      <Text className="mt-1 font-display text-xl font-bold text-ink">{value}</Text>
    </View>
  );
}

function DayRow({
  date,
  bills,
  total,
  max,
}: {
  date: string;
  bills: number;
  total: number;
  max: number;
}) {
  const pct = Math.max(2, Math.round((total / max) * 100));
  return (
    <View className="rounded-lg bg-surface p-3">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="font-display text-sm font-bold text-ink">{date}</Text>
          <Text className="text-[11px] text-ink-2">{bills} bills</Text>
        </View>
        <Text className="font-display text-base font-bold text-ink">{fmtMoney(total)}</Text>
      </View>
      <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
        <View
          style={{ width: `${pct}%` }}
          className="h-full rounded-full bg-primary"
        />
      </View>
    </View>
  );
}
