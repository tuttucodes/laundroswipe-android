import { useQuery } from '@tanstack/react-query';
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ArrowRight, Shirt, Sparkles, Footprints } from 'lucide-react-native';
import { LSApi, type BootstrapPayload, type OrderRow } from '@/lib/api';
import { customerFacingStatusLabel, SERVICES } from '@/lib/constants';
import { useAuth } from '@/store/auth';
import { stripLeadingHashesFromToken } from '@/lib/vendor-bill-token';
import { useRegisterPush } from '@/hooks/use-register-push';
import { Container } from '@/components/ui/Container';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { env } from '@/lib/env';

const SERVICE_VISUALS: Record<
  string,
  { tone: 'primary-light' | 'orange-light' | 'teal-light'; icon: typeof Shirt }
> = {
  wash_iron: { tone: 'primary-light', icon: Shirt },
  dry_clean: { tone: 'orange-light', icon: Sparkles },
  shoe_clean: { tone: 'teal-light', icon: Footprints },
};

const TONE_BG: Record<string, string> = {
  'primary-light': '#E8EEFB',
  'orange-light': '#FFF7ED',
  'teal-light': '#CCFBF1',
};

const TONE_FG: Record<string, string> = {
  'primary-light': '#1746A2',
  'orange-light': '#F97316',
  'teal-light': '#0D9488',
};

function firstName(full: string | null | undefined): string {
  const s = String(full ?? '').trim();
  if (!s) return 'there';
  return s.split(/\s+/)[0];
}

function activeOrders(payload: BootstrapPayload | null | undefined): OrderRow[] {
  if (!payload) return [];
  return (payload.orders ?? []).filter((o) => o.status !== 'delivered').slice(0, 5);
}

export default function CustomerHome() {
  const profile = useAuth((s) => s.profile);
  useRegisterPush();

  const query = useQuery({
    queryKey: ['bootstrap'],
    queryFn: () => LSApi.fetchBootstrap(),
    staleTime: 30_000,
    networkMode: 'offlineFirst',
  });

  const bootstrap = query.data ?? null;
  const active = activeOrders(bootstrap);
  const showSkeleton = query.isPending && !query.data;

  const visibleServices = SERVICES.filter((s) => !s.comingSoon);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
            tintColor="#1746A2"
          />
        }
      >
        <Container style={{ padding: 20 }}>
          {/* Hero card */}
          <Animated.View entering={FadeInDown.springify()}>
            <View
              className="overflow-hidden rounded-3xl bg-primary"
              style={{
                shadowColor: '#1746A2',
                shadowOpacity: 0.18,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 8 },
                elevation: 6,
              }}
            >
              <View className="px-6 pb-6 pt-7">
                <Text className="font-display text-3xl font-extrabold text-white">
                  Hi, {firstName(profile?.full_name ?? bootstrap?.user?.full_name)} 👋
                </Text>
                <Text className="mt-2 text-sm text-white/85">
                  Pick a service — we handle pickup, wash and delivery.
                </Text>

                <Link href="/(customer)/schedule" asChild>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
                    className="mt-6 flex-row items-center justify-between rounded-2xl bg-white px-5 py-4"
                  >
                    <Text className="font-display text-lg font-extrabold text-primary">
                      Schedule a pickup
                    </Text>
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary-light">
                      <ArrowRight color="#1746A2" size={18} />
                    </View>
                  </Pressable>
                </Link>
              </View>
              {/* Decorative blurred circle */}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: -40,
                  right: -40,
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  backgroundColor: 'rgba(255,255,255,0.10)',
                }}
              />
            </View>
          </Animated.View>

          {/* Active orders */}
          {showSkeleton ? (
            <View className="mt-7 gap-2">
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : active.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(80).springify()} className="mt-7">
              <View className="flex-row items-center justify-between">
                <Text className="font-display text-lg font-extrabold text-ink">Active orders</Text>
                <Link href="/(customer)/orders" className="text-sm font-semibold text-primary">
                  See all
                </Link>
              </View>
              <View className="mt-3 gap-2">
                {active.map((o, i) => (
                  <Animated.View key={o.id} entering={FadeInDown.delay(120 + i * 50).springify()}>
                    <OrderCard order={o} bills={bootstrap?.bills ?? []} />
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          ) : null}

          {/* Services */}
          <Animated.View entering={FadeInDown.delay(140).springify()} className="mt-8">
            <View className="flex-row items-end justify-between">
              <Text className="font-display text-2xl font-extrabold text-ink">
                What do you need today?
              </Text>
              <Text className="text-xs text-ink-2">{visibleServices.length} services</Text>
            </View>

            <View className="mt-4 gap-3">
              {visibleServices.map((s, i) => (
                <Animated.View key={s.id} entering={FadeInDown.delay(180 + i * 60).springify()}>
                  <ServiceCard
                    id={s.id}
                    name={s.name}
                    desc={s.desc}
                  />
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          {/* How it works */}
          <Animated.View entering={FadeIn.delay(360)} className="mt-8 rounded-2xl bg-surface p-5">
            <View className="flex-row items-start justify-between gap-3">
              <Step n={1} label="Pick service & date" />
              <Step n={2} label="We pick up" />
              <Step n={3} label="Delivery" />
            </View>
          </Animated.View>

          {/* Brand footer */}
          <Animated.View entering={FadeIn.delay(450)} className="mt-10 items-center gap-2">
            <View className="h-px w-full bg-border" />
            <Text className="mt-4 font-display text-2xl font-extrabold text-primary">
              LaundroSwipe
            </Text>
            <Text className="text-sm text-ink-2">Fast, fair & student-first laundry.</Text>
            <Text className="mt-1 text-sm font-semibold text-ink">
              Crafted with ❤️ in Chennai
            </Text>
            <View className="mt-3 flex-row gap-4">
              <FooterLink label="Privacy" href={`${env.webOrigin}/privacy`} />
              <Text className="text-ink-2">·</Text>
              <FooterLink label="Terms" href={`${env.webOrigin}/terms`} />
              <Text className="text-ink-2">·</Text>
              <FooterLink label="Support" href={`${env.webOrigin}/support`} />
            </View>
            <Text className="mt-3 text-xs text-ink-2">
              © {new Date().getFullYear()} LaundroSwipe
            </Text>
          </Animated.View>
        </Container>
      </ScrollView>
    </SafeAreaView>
  );
}

function ServiceCard({ id, name, desc }: { id: string; name: string; desc: string }) {
  const visuals = SERVICE_VISUALS[id] ?? { tone: 'primary-light', icon: Shirt };
  const Icon = visuals.icon;
  const bg = TONE_BG[visuals.tone] ?? '#E8EEFB';
  const fg = TONE_FG[visuals.tone] ?? '#1746A2';
  return (
    <Link
      href={{ pathname: '/(customer)/schedule', params: { svc: id } } as never}
      asChild
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Pick ${name}`}
        style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
        className="flex-row items-center gap-3 rounded-2xl bg-surface p-4"
      >
        <View
          style={{ backgroundColor: bg }}
          className="h-14 w-14 items-center justify-center rounded-2xl"
        >
          <Icon color={fg} size={26} />
        </View>
        <View className="flex-1">
          <Text className="font-display text-base font-extrabold text-ink">{name}</Text>
          <Text className="mt-0.5 text-xs text-ink-2">{desc}</Text>
        </View>
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary-light">
          <ArrowRight color="#1746A2" size={18} />
        </View>
      </Pressable>
    </Link>
  );
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <View className="flex-1 items-center">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-primary">
        <Text className="font-display text-sm font-extrabold text-white">{n}</Text>
      </View>
      <Text className="mt-2 text-center text-xs text-ink-2">{label}</Text>
    </View>
  );
}

function FooterLink({ label, href }: { label: string; href: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(href).catch(() => undefined)}>
      <Text className="text-sm font-semibold text-primary">{label}</Text>
    </Pressable>
  );
}

function OrderCard({ order, bills }: { order: OrderRow; bills: BootstrapPayload['bills'] }) {
  const tokenKey = stripLeadingHashesFromToken(order.token).toLowerCase();
  const hasBill = bills.some(
    (b) => stripLeadingHashesFromToken(b.order_token).toLowerCase() === tokenKey && !b.cancelled_at,
  );
  const status = customerFacingStatusLabel(order.status, hasBill);
  return (
    <Link href={{ pathname: '/(customer)/orders/[id]', params: { id: order.id } } as never} asChild>
      <Pressable
        accessibilityRole="button"
        className="flex-row items-center gap-3 rounded-2xl bg-surface p-4"
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
          <Text className="font-display text-base font-extrabold text-primary">#</Text>
        </View>
        <View className="flex-1">
          <Text className="font-display text-base font-bold text-ink">{order.service_name}</Text>
          <Text className="text-xs text-ink-2" numberOfLines={1}>
            {order.pickup_date} · {order.time_slot} · {order.vendor_name ?? 'Partner'}
          </Text>
        </View>
        <View className="rounded-full bg-primary-light px-3 py-1">
          <Text className="text-xs font-semibold text-primary">{status}</Text>
        </View>
      </Pressable>
    </Link>
  );
}
