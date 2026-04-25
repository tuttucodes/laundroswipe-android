import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { SERVICES } from '@/lib/constants';
import { LSApi, type VendorCatalogRow } from '@/lib/api';
import { assertBookingMatchesSchedule } from '@/lib/schedule-booking-guard';
import { userMessageForScheduleOrderError } from '@/lib/schedule-order-errors';
import { useSchedule } from '@/store/schedule';
import { useAuth } from '@/store/auth';
import { SwipeToConfirm } from '@/components/ui/SwipeToConfirm';
import { generateOrderNumber, generateOrderToken } from '@/lib/order-token';

export default function ScheduleWizard() {
  const router = useRouter();
  const profile = useAuth((s) => s.profile);
  const state = useSchedule();
  const [submitting, setSubmitting] = useState(false);

  const campusId = profile?.college_id ?? '';
  const campusOk = Boolean(campusId && campusId !== 'general');

  const catalogQuery = useQuery({
    queryKey: ['vendor-catalog', campusId],
    enabled: campusOk && state.step === 2,
    queryFn: () => LSApi.fetchVendorCatalog(campusId),
  });

  const scheduleQuery = useQuery({
    queryKey: ['public-schedule'],
    enabled: state.step >= 3,
    queryFn: () => LSApi.fetchPublicSchedule(),
  });

  const bookableDates = useMemo(() => {
    const dates = scheduleQuery.data?.dates ?? [];
    const slug = state.vendorSlug ?? '';
    return dates
      .filter((d) => {
        if (!d.enabled) return false;
        if (slug && d.enabled_by_vendor && typeof d.enabled_by_vendor[slug] === 'boolean') {
          return d.enabled_by_vendor[slug];
        }
        return true;
      })
      .slice(0, 14);
  }, [scheduleQuery.data, state.vendorSlug]);

  const slotsForDate = useMemo(() => {
    const row = scheduleQuery.data?.dates.find((d) => d.date === state.pickupDate);
    const allSlots = scheduleQuery.data?.slots ?? [];
    if (!row) return [];
    const slug = state.vendorSlug ?? '';
    const allowed = row.slot_ids_by_vendor?.[slug] ?? row.slot_ids ?? [];
    return allSlots.filter((s) => s.active && allowed.includes(s.id));
  }, [scheduleQuery.data, state.pickupDate, state.vendorSlug]);

  const submit = async () => {
    if (
      submitting ||
      !state.serviceId ||
      !state.vendorSlug ||
      !state.pickupDate ||
      !state.timeSlotId
    )
      return;
    setSubmitting(true);

    const guard = assertBookingMatchesSchedule({
      dates: scheduleQuery.data?.dates ?? [],
      slots: scheduleQuery.data?.slots ?? [],
      vendorSlug: state.vendorSlug,
      pickupDate: state.pickupDate,
      timeSlotId: state.timeSlotId,
    });
    if (!guard.ok) {
      setSubmitting(false);
      Alert.alert('Cannot book', userMessageForScheduleOrderError(guard.code, guard.error));
      return;
    }

    const { order, error, code } = await LSApi.createOrder({
      on: generateOrderNumber(),
      tk: generateOrderToken(),
      svc: state.serviceId,
      sl: state.serviceName ?? '',
      pd: state.pickupDate,
      ts: state.timeSlotId,
      ins: state.instructions || undefined,
      vendorName: state.vendorName ?? undefined,
      vendorSlug: state.vendorSlug,
      campusId,
    });

    setSubmitting(false);

    if (!order) {
      Alert.alert('Booking failed', userMessageForScheduleOrderError(code, error ?? undefined));
      return;
    }

    state.reset();
    router.replace({ pathname: '/(customer)/orders/[id]', params: { id: order.id } });
  };

  if (!campusOk) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center font-display text-xl font-bold text-ink">
            Pick your college first
          </Text>
          <Text className="mt-2 text-center text-sm text-ink-2">
            Set your campus in profile → then book pickup.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 px-5 pt-3">
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (state.step === 1) router.back();
            else state.setStep((state.step - 1) as 1 | 2 | 3);
          }}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface"
        >
          <ChevronLeft color="#1A1D2E" size={22} />
        </Pressable>
        <View className="flex-1 flex-row items-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <View
              key={n}
              className={
                n <= state.step
                  ? 'h-1.5 flex-1 rounded-full bg-primary'
                  : 'h-1.5 flex-1 rounded-full bg-border'
              }
            />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        {state.step === 1 ? (
          <Step1
            onPick={(id, name) => {
              state.setService(id, name);
              state.setStep(2);
            }}
            currentId={state.serviceId}
          />
        ) : state.step === 2 ? (
          <Step2
            vendors={catalogQuery.data ?? null}
            loading={catalogQuery.isLoading}
            currentSlug={state.vendorSlug}
            onPick={(slug, name) => {
              state.setVendor(slug, name);
              state.setStep(3);
            }}
          />
        ) : state.step === 3 ? (
          <Step3
            loading={scheduleQuery.isLoading}
            bookableDates={bookableDates}
            slots={slotsForDate}
            pickupDate={state.pickupDate}
            timeSlotId={state.timeSlotId}
            onDate={(d) => state.setDateSlot(d, null as unknown as string, '')}
            onSlot={(id, label) => state.setDateSlot(state.pickupDate ?? '', id, label)}
            onContinue={() => state.setStep(4)}
          />
        ) : (
          <Step4
            state={state}
            onInstructions={state.setInstructions}
            onSubmit={submit}
            submitting={submitting}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Step 1: service picker ─────────────────────────────────────────────────

function Step1({
  onPick,
  currentId,
}: {
  onPick: (id: string, name: string) => void;
  currentId: string | null;
}) {
  return (
    <View>
      <Text className="font-display text-2xl font-bold text-ink">Pick a service</Text>
      <Text className="mt-1 text-sm text-ink-2">One service per order. Add more later.</Text>
      <View className="mt-6 gap-3">
        {SERVICES.map((s) => {
          const sel = currentId === s.id;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              onPress={() => !s.comingSoon && onPick(s.id, s.name)}
              disabled={s.comingSoon}
              className={
                sel
                  ? 'flex-row items-center gap-4 rounded-lg border-2 border-primary bg-primary-light px-4 py-4'
                  : 'flex-row items-center gap-4 rounded-lg border border-border bg-surface px-4 py-4'
              }
            >
              <Text style={{ fontSize: 28 }}>{s.emoji}</Text>
              <View className="flex-1">
                <Text className="font-display text-base font-bold text-ink">{s.name}</Text>
                <Text className="text-xs text-ink-2">{s.desc}</Text>
              </View>
              {s.comingSoon ? (
                <View className="rounded-full bg-orange-light px-3 py-1">
                  <Text className="text-xs font-semibold text-orange">Soon</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Step 2: vendor picker ──────────────────────────────────────────────────

function Step2({
  vendors,
  loading,
  currentSlug,
  onPick,
}: {
  vendors: VendorCatalogRow[] | null;
  loading: boolean;
  currentSlug: string | null;
  onPick: (slug: string, name: string) => void;
}) {
  return (
    <View>
      <Text className="font-display text-2xl font-bold text-ink">Pick a partner</Text>
      <Text className="mt-1 text-sm text-ink-2">Only partners serving your campus are listed.</Text>
      {loading ? (
        <Text className="mt-6 text-sm text-ink-2">Loading partners…</Text>
      ) : !vendors?.length ? (
        <Text className="mt-6 text-sm text-ink-2">No partners available here yet.</Text>
      ) : (
        <View className="mt-6 gap-3">
          {vendors.map((v) => {
            const sel = currentSlug === v.slug;
            return (
              <Pressable
                key={v.slug}
                accessibilityRole="button"
                onPress={() => onPick(v.slug, v.profile_name ?? v.name)}
                className={
                  sel
                    ? 'flex-row items-center gap-4 rounded-lg border-2 border-primary bg-primary-light px-4 py-4'
                    : 'flex-row items-center gap-4 rounded-lg border border-border bg-surface px-4 py-4'
                }
              >
                <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-light">
                  <Text className="font-display text-lg font-bold text-primary">
                    {(v.profile_name ?? v.name).charAt(0)}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="font-display text-base font-bold text-ink" numberOfLines={1}>
                    {v.profile_name ?? v.name}
                  </Text>
                  {v.brief ? (
                    <Text className="text-xs text-ink-2" numberOfLines={2}>
                      {v.brief}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Step 3: date + slot ────────────────────────────────────────────────────

type DateRow = { date: string };
type SlotRow = { id: string; label: string; time_from: string; time_to: string };

function Step3({
  loading,
  bookableDates,
  slots,
  pickupDate,
  timeSlotId,
  onDate,
  onSlot,
  onContinue,
}: {
  loading: boolean;
  bookableDates: DateRow[];
  slots: SlotRow[];
  pickupDate: string | null;
  timeSlotId: string | null;
  onDate: (date: string) => void;
  onSlot: (id: string, label: string) => void;
  onContinue: () => void;
}) {
  const canContinue = Boolean(pickupDate && timeSlotId);
  return (
    <View>
      <Text className="font-display text-2xl font-bold text-ink">When should we pick up?</Text>
      {loading ? (
        <Text className="mt-6 text-sm text-ink-2">Loading schedule…</Text>
      ) : bookableDates.length === 0 ? (
        <Text className="mt-6 text-sm text-ink-2">
          No available dates for this partner right now.
        </Text>
      ) : (
        <>
          <Text className="mt-5 text-sm font-semibold text-ink">Date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 8 }}
          >
            {bookableDates.map((d) => {
              const sel = pickupDate === d.date;
              const dt = new Date(`${d.date}T12:00:00`);
              const dayLabel = dt.toLocaleDateString(undefined, { weekday: 'short' });
              return (
                <Pressable
                  key={d.date}
                  onPress={() => onDate(d.date)}
                  accessibilityRole="button"
                  className={
                    sel
                      ? 'min-w-[72px] items-center rounded-sm border-2 border-primary bg-primary-light px-3 py-3'
                      : 'min-w-[72px] items-center rounded-sm border border-border bg-surface px-3 py-3'
                  }
                >
                  <Text className="text-xs text-ink-2">{dayLabel}</Text>
                  <Text className="font-display text-lg font-bold text-ink">{dt.getDate()}</Text>
                  <Text className="text-xs text-ink-2">
                    {dt.toLocaleDateString(undefined, { month: 'short' })}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text className="mt-5 text-sm font-semibold text-ink">Time slot</Text>
          {!pickupDate ? (
            <Text className="mt-2 text-xs text-ink-2">Pick a date first.</Text>
          ) : slots.length === 0 ? (
            <Text className="mt-2 text-xs text-ink-2">No slots for this date.</Text>
          ) : (
            <View className="mt-2 gap-2">
              {slots.map((s) => {
                const sel = timeSlotId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => onSlot(s.id, s.label)}
                    accessibilityRole="button"
                    className={
                      sel
                        ? 'min-h-[48px] flex-row items-center justify-between rounded-sm border-2 border-primary bg-primary-light px-4 py-3'
                        : 'min-h-[48px] flex-row items-center justify-between rounded-sm border border-border bg-surface px-4 py-3'
                    }
                  >
                    <Text className="font-semibold text-ink">{s.label}</Text>
                    <Text className="text-xs text-ink-2">
                      {s.time_from.slice(0, 5)} — {s.time_to.slice(0, 5)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable
            onPress={onContinue}
            disabled={!canContinue}
            accessibilityRole="button"
            className="mt-8 min-h-[52px] items-center justify-center rounded-lg bg-primary disabled:opacity-50"
          >
            <Text className="text-base font-semibold text-white">Continue</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

// ─── Step 4: review + swipe to confirm ──────────────────────────────────────

function Step4({
  state,
  onInstructions,
  onSubmit,
  submitting,
}: {
  state: ReturnType<typeof useSchedule.getState>;
  onInstructions: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <View>
      <Text className="font-display text-2xl font-bold text-ink">Review + confirm</Text>
      <View className="mt-5 gap-3 rounded-lg bg-surface p-5">
        <Row label="Service" value={state.serviceName ?? '—'} />
        <Row label="Partner" value={state.vendorName ?? '—'} />
        <Row label="Pickup" value={`${state.pickupDate ?? '—'} · ${state.timeSlotLabel ?? ''}`} />
      </View>

      <Text className="mt-6 text-sm font-semibold text-ink">Instructions (optional)</Text>
      <TextInput
        value={state.instructions}
        onChangeText={onInstructions}
        placeholder="e.g. dry-clean jeans separately"
        placeholderTextColor="#94A3B8"
        multiline
        className="mt-2 min-h-[96px] rounded-sm border border-border bg-surface p-4 text-base text-ink"
      />

      <View className="mt-10">
        <SwipeToConfirm
          label="Swipe to confirm booking"
          onConfirm={onSubmit}
          disabled={submitting}
        />
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-ink-2">{label}</Text>
      <Text className="font-semibold text-ink" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
