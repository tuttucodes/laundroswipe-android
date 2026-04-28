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
import { ScaleButton } from '@/components/ui/ScaleButton';
import { env } from '@/lib/env';
import { shadow } from '@/theme/tokens';

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
        contentContainerStyle={{ paddingBottom: 130 }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
            tintColor="#1746A2"
          />
        }
      >
        <Container style={{ padding: 24 }}>
          {/* HIGH-END MASSIVE HERO */}
          <Animated.View entering={FadeInDown.springify()} className="mb-4">
            <View
              className="overflow-hidden rounded-[32px] bg-ink"
              style={{ padding: 28, ...shadow.elevated }}
            >
              {/* Dynamic shape blobs */}
              <View
                className="absolute right-[-60px] top-[-60px] h-[200px] w-[200px] rounded-full bg-primary/40"
                style={{ transform: [{ scaleX: 1.2 }], opacity: 0.8 }}
              />
              <View
                className="absolute bottom-[-80px] left-[-40px] h-[180px] w-[180px] rounded-full bg-teal/30"
                style={{ transform: [{ scaleY: 1.5 }], opacity: 0.8 }}
              />

              <Text className="font-display text-[44px] leading-[48px] font-extrabold text-white tracking-tight">
                Hello,{'\n'}{firstName(profile?.full_name ?? bootstrap?.user?.full_name)}.
              </Text>
              <Text className="mt-3 text-base font-body text-white/80">
                Outsource your laundry.{'\n'}Focus on what matters.
              </Text>

              <Link href="/(customer)/schedule" asChild>
                <ScaleButton
                  hapticMode="heavy"
                  scaleTo={0.92}
                  className="mt-8 flex-row items-center justify-between rounded-2xl bg-white px-6 py-5"
                >
                  <Text className="font-display text-lg font-extrabold text-ink">
                    Schedule a pickup
                  </Text>
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-bg">
                    <ArrowRight color="#1A1D2E" size={20} strokeWidth={3} />
                  </View>
                </ScaleButton>
              </Link>
            </View>
          </Animated.View>

          {/* ACTIVE ORDERS */}
          {showSkeleton ? (
            <View className="mt-6 gap-3">
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : active.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(80).springify()} className="mt-6">
              <Text className="font-display text-sm font-bold uppercase tracking-wider text-ink-2 mb-3">
                Active Orders
              </Text>
              <View className="gap-3">
                {active.map((o, i) => (
                  <Animated.View key={o.id} entering={FadeInDown.delay(120 + i * 50).springify()}>
                    <OrderCard order={o} bills={bootstrap?.bills ?? []} />
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          ) : null}

          {/* BENTO BOX SERVICES */}
          <Animated.View entering={FadeInDown.delay(160).springify()} className="mt-10">
            <Text className="font-display text-sm font-bold uppercase tracking-wider text-ink-2 mb-3">
              Explore Services
            </Text>

            <View className="gap-4">
              {/* First Item Full Width */}
              {visibleServices[0] && <BentoCard svc={visibleServices[0]} isFull />}
              
              {/* Next Two Half Width */}
              {(visibleServices[1] || visibleServices[2]) && (
                <View className="flex-row gap-4">
                  {visibleServices[1] && <View className="flex-1"><BentoCard svc={visibleServices[1]} /></View>}
                  {visibleServices[2] && <View className="flex-1"><BentoCard svc={visibleServices[2]} /></View>}
                </View>
              )}
            </View>
          </Animated.View>

          {/* HOW IT WORKS */}
          <Animated.View entering={FadeInDown.delay(240).springify()} className="mt-10">
             <View className="rounded-[28px] bg-surface p-7" style={shadow.card}>
                <Text className="font-display text-xl font-extrabold text-ink mb-6 text-center">
                  How it works
                </Text>
                <View className="flex-row items-start justify-between gap-2">
                  <Step n={1} label="Schedule" />
                  <Step n={2} label="We Bag It" />
                  <Step n={3} label="Delivered" />
                </View>
             </View>
          </Animated.View>

          {/* BRAND FOOTER (Sleeker) */}
          <Animated.View entering={FadeIn.delay(350).duration(800)} className="mt-12 items-center pb-8">
            <View className="h-2 w-2 rounded-full bg-border-strong mb-6" />
            <Text className="font-display text-3xl font-extrabold text-ink opacity-80">
              LaundroSwipe
            </Text>
            <Text className="text-sm font-bold text-ink-2 mb-6 tracking-wide uppercase">
              Stay fresh
            </Text>
            
            <View className="flex-row gap-6 mb-4">
              <FooterLink label="Privacy" href={`${env.webOrigin}/privacy`} />
              <FooterLink label="Terms" href={`${env.webOrigin}/terms`} />
              <FooterLink label="Support" href={`${env.webOrigin}/support`} />
            </View>
            <Text className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">
              © {new Date().getFullYear()} LaundroSwipe
            </Text>
          </Animated.View>
        </Container>
      </ScrollView>
    </SafeAreaView>
  );
}

function BentoCard({ svc, isFull = false }: { svc: typeof SERVICES[0]; isFull?: boolean }) {
  const visuals = SERVICE_VISUALS[svc.id] ?? { tone: 'primary-light', icon: Shirt };
  const Icon = visuals.icon;
  const bg = TONE_BG[visuals.tone] ?? '#E8EEFB';
  const fg = TONE_FG[visuals.tone] ?? '#1746A2';

  return (
    <Link href={{ pathname: '/(customer)/schedule', params: { svc: svc.id } } as never} asChild>
      <ScaleButton
        hapticMode="medium"
        accessibilityRole="button"
        accessibilityLabel={`Pick ${svc.name}`}
        className={`rounded-[28px] bg-surface overflow-hidden ${isFull ? 'p-6' : 'p-5'}`}
        style={shadow.card}
      >
        <View className={`${isFull ? 'flex-row items-center justify-between' : 'flex-col items-start gap-4'}`}>
           <View>
              <View style={{ backgroundColor: bg }} className={`items-center justify-center rounded-[20px] ${isFull ? 'h-16 w-16 mb-4' : 'h-14 w-14 mb-3'}`}>
                <Icon color={fg} size={isFull ? 30 : 26} />
              </View>
              <Text className={`font-display font-extrabold text-ink ${isFull ? 'text-2xl' : 'text-lg'}`}>
                {svc.name}
              </Text>
              <Text className={`mt-1 font-body text-ink-2 ${isFull ? 'text-sm' : 'text-xs'}`}>
                {svc.desc}
              </Text>
           </View>
           {isFull && (
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-border/40">
                <ArrowRight color="#1A1D2E" size={24} />
              </View>
           )}
        </View>
      </ScaleButton>
    </Link>
  );
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <View className="flex-1 items-center">
      <View className="h-12 w-12 items-center justify-center rounded-[18px] bg-primary-light mb-3">
        <Text className="font-display text-lg font-extrabold text-primary">{n}</Text>
      </View>
      <Text className="text-center font-display text-xs font-bold text-ink">{label}</Text>
    </View>
  );
}

function FooterLink({ label, href }: { label: string; href: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(href).catch(() => undefined)}>
      <Text className="font-display text-xs font-bold text-primary uppercase tracking-wider">{label}</Text>
    </Pressable>
  );
}

function OrderCard({ order, bills }: { order: OrderRow; bills: BootstrapPayload['bills'] }) {
  const tokenKey = stripLeadingHashesFromToken(order.token).toLowerCase();
  const hasBill = bills.some(
    (b) => stripLeadingHashesFromToken(b.order_token).toLowerCase() === tokenKey && !b.cancelled_at,
  );
  const status = customerFacingStatusLabel(order.status, hasBill);

  const isActiveStatus = order.status !== 'delivered' && order.status !== 'cancelled';

  return (
    <Link href={{ pathname: '/(customer)/orders/[id]', params: { id: order.id } } as never} asChild>
      <ScaleButton
        hapticMode="light"
        accessibilityRole="button"
        className="flex-row items-center gap-4 rounded-[24px] bg-surface p-4"
        style={shadow.card}
      >
        <View className={`h-12 w-12 items-center justify-center rounded-[18px] ${isActiveStatus ? 'bg-orange-light' : 'bg-primary-light'}`}>
          <Text className={`font-display text-xl font-extrabold ${isActiveStatus ? 'text-orange' : 'text-primary'}`}>#</Text>
        </View>
        <View className="flex-1">
          <Text className="font-display text-lg font-extrabold text-ink">{order.service_name}</Text>
          <Text className="mt-0.5 font-body text-xs text-ink-2" numberOfLines={1}>
            {order.pickup_date} · {order.time_slot}
          </Text>
        </View>
        <View className={`rounded-full px-4 py-2 ${isActiveStatus ? 'bg-ink' : 'bg-border'}`}>
          <Text className={`font-display text-[10px] font-bold uppercase tracking-wider ${isActiveStatus ? 'text-white' : 'text-ink-2'}`}>
            {status}
          </Text>
        </View>
      </ScaleButton>
    </Link>
  );
}
