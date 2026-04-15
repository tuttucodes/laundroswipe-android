import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import { Button, Checkbox, Chip, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { useAuth } from '@/contexts/AuthContext';
import { SERVICES, VENDORS } from '@/lib/constants';
import { MobileApi } from '@/lib/mobile-api';
import type { ScheduleDateRow, ScheduleSlotRow } from '@/lib/api-types';
import { dedupeScheduleSlotsByTimeAndLabel } from '@/lib/schedule-slot-merge';
import { genOid, genTk } from '@/lib/order-token';
import { isScheduleOrderErrorCode, userMessageForScheduleOrderError } from '@/lib/schedule-order-errors';
import { CURRENT_TERMS_VERSION } from '@/lib/terms';
import { needsStudentHostelDetails } from '@/lib/profile-guards';

function dateEnabledForVendor(d: ScheduleDateRow, vendorId: string): boolean {
  const m = d.enabled_by_vendor;
  if (m && typeof m === 'object' && vendorId in m) return Boolean((m as Record<string, boolean>)[vendorId]);
  return d.enabled;
}

function slotIdsForVendor(d: ScheduleDateRow, vendorId: string): string[] {
  const by = d.slot_ids_by_vendor;
  if (by && typeof by === 'object' && by[vendorId]?.length) return by[vendorId]!;
  return d.slot_ids ?? [];
}

export default function ScheduleScreen() {
  const { profile, refreshProfile } = useAuth();
  const [slots, setSlots] = useState<ScheduleSlotRow[]>([]);
  const [dates, setDates] = useState<ScheduleDateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string>(VENDORS[0].id);
  const [svcId, setSvcId] = useState<string>(SERVICES[0].id);
  const [pickDate, setPickDate] = useState<string | null>(null);
  const [pickSlot, setPickSlot] = useState<string | null>(null);
  const [ins, setIns] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsSaving, setTermsSaving] = useState(false);

  const campusId = String(profile?.college_id ?? 'vit-chn').trim() || 'vit-chn';
  const termsOk = String(profile?.terms_version ?? '') === CURRENT_TERMS_VERSION;

  const load = useCallback(async () => {
    setLoading(true);
    const bundle = await MobileApi.fetchPublicSchedule();
    if (bundle) {
      setSlots(dedupeScheduleSlotsByTimeAndLabel(bundle.slots.filter((s) => s.active)));
      setDates(bundle.dates);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bookableDates = useMemo(() => {
    return dates.filter((d) => dateEnabledForVendor(d, vendorId) && slotIdsForVendor(d, vendorId).length > 0);
  }, [dates, vendorId]);

  const slotLabels = useMemo(() => {
    if (!pickDate) return [] as { id: string; label: string }[];
    const row = dates.find((d) => d.date === pickDate);
    if (!row) return [];
    const ids = slotIdsForVendor(row, vendorId);
    const map = new Map(slots.map((s) => [s.id, s.label]));
    return ids.map((id) => ({ id, label: map.get(id) ?? id }));
  }, [pickDate, dates, vendorId, slots]);

  const selectedVendor = VENDORS.find((v) => v.id === vendorId);
  const selectedSvc = SERVICES.find((s) => s.id === svcId);

  const placeOrder = async () => {
    if (!profile?.id || !pickDate || !pickSlot) {
      Alert.alert('Booking', 'Choose a date and time slot.');
      return;
    }
    if (!String(profile.phone ?? '').trim()) {
      Alert.alert('Profile', 'Add your phone number in Profile before booking.');
      return;
    }
    if (needsStudentHostelDetails(profile)) {
      Alert.alert('Profile', 'Add registration, hostel block, and room in Profile for campus booking.');
      return;
    }
    if (!termsOk) {
      setTermsOpen(true);
      return;
    }
    setSubmitting(true);
    let lastErr = 'Order failed';
    let placed = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const payload = {
        on: genOid(),
        tk: genTk(),
        svc: svcId,
        sl: selectedSvc?.name ?? svcId,
        pd: pickDate,
        ts: pickSlot,
        status: 'scheduled',
        ins: ins.trim() || undefined,
        vendorName: selectedVendor?.name,
        vendorSlug: vendorId,
        campusId,
      };
      const result = await MobileApi.createOrder(payload, profile.id);
      if (result.order) {
        Alert.alert('Booked', `Token #${result.order.token}\nOrder ${result.order.order_number}`);
        placed = true;
        break;
      }
      if (result.error) {
        lastErr = isScheduleOrderErrorCode(result.code)
          ? userMessageForScheduleOrderError(result.code, result.error)
          : result.error;
      }
      if (result.code === 'TERMS_NOT_ACCEPTED') {
        setTermsOpen(true);
        setSubmitting(false);
        return;
      }
      if (isScheduleOrderErrorCode(result.code)) break;
    }
    if (!placed) Alert.alert('Booking', lastErr);
    setSubmitting(false);
  };

  const acceptTerms = async () => {
    if (!termsChecked) {
      Alert.alert('Terms', 'Please confirm you agree.');
      return;
    }
    setTermsSaving(true);
    const { user, error } = await MobileApi.acceptLatestTerms();
    setTermsSaving(false);
    if (!user) {
      Alert.alert('Terms', error ?? 'Failed');
      return;
    }
    setTermsOpen(false);
    await refreshProfile();
    Alert.alert('Terms', 'Saved. You can place your order now.');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading schedule…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text variant="titleMedium" style={styles.mb}>
        Vendor
      </Text>
      <View style={styles.row}>
        {VENDORS.map((v) => (
          <Chip key={v.id} selected={vendorId === v.id} onPress={() => setVendorId(v.id)} style={styles.chip} compact>
            {v.name}
          </Chip>
        ))}
      </View>
      <Text variant="titleMedium" style={styles.mv}>
        Service
      </Text>
      <View style={styles.row}>
        {SERVICES.filter((s) => !s.comingSoon).map((s) => (
          <Chip key={s.id} selected={svcId === s.id} onPress={() => setSvcId(s.id)} style={styles.chip}>
            {s.name}
          </Chip>
        ))}
      </View>
      <Text variant="titleMedium" style={styles.mv}>
        Date
      </Text>
      <View style={styles.row}>
        {bookableDates.map((d) => (
          <Chip key={d.date} selected={pickDate === d.date} onPress={() => { setPickDate(d.date); setPickSlot(null); }} style={styles.chip}>
            {d.date}
          </Chip>
        ))}
      </View>
      <Text variant="titleMedium" style={styles.mv}>
        Time slot
      </Text>
      <View style={styles.row}>
        {slotLabels.map((s) => (
          <Chip key={s.id} selected={pickSlot === s.id} onPress={() => setPickSlot(s.id)} style={styles.chip}>
            {s.label}
          </Chip>
        ))}
      </View>
      <TextInput label="Instructions (optional)" value={ins} onChangeText={setIns} multiline style={styles.mv} />
      <Button mode="contained" onPress={placeOrder} loading={submitting} disabled={submitting}>
        Confirm booking
      </Button>

      <Portal>
        <Dialog visible={termsOpen} onDismiss={() => setTermsOpen(false)}>
          <Dialog.Title>Terms and conditions</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Accept the latest terms to place orders.</Text>
            <View style={styles.rowStart}>
              <Checkbox status={termsChecked ? 'checked' : 'unchecked'} onPress={() => setTermsChecked(!termsChecked)} />
              <Text onPress={() => setTermsChecked(!termsChecked)}>I agree</Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setTermsOpen(false)}>Cancel</Button>
            <Button loading={termsSaving} onPress={acceptTerms}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  rowStart: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  chip: { marginBottom: 8, marginRight: 8 },
  mb: { marginBottom: 8 },
  mv: { marginVertical: 12 },
});
