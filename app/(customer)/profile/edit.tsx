import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { LSApi } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { COLLEGES, VIT_VENDOR_BLOCK_ACCESS } from '@/lib/constants';

const BLOCKS = [
  ...new Set([...VIT_VENDOR_BLOCK_ACCESS.profab, ...VIT_VENDOR_BLOCK_ACCESS.starwash]),
].sort();

export default function EditProfile() {
  const router = useRouter();
  const profile = useAuth((s) => s.profile);
  const setProfile = useAuth((s) => s.setProfile);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp ?? '');
  const [collegeId, setCollegeId] = useState(profile?.college_id ?? '');
  const [regNo, setRegNo] = useState(profile?.reg_no ?? '');
  const [hostelBlock, setHostelBlock] = useState(profile?.hostel_block ?? '');
  const [roomNumber, setRoomNumber] = useState(profile?.room_number ?? '');
  const [year, setYear] = useState(String(profile?.year ?? ''));
  const [busy, setBusy] = useState(false);

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <Text className="text-ink-2">Sign in to edit your profile.</Text>
      </SafeAreaView>
    );
  }

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const { user, error } = await LSApi.updateUser(profile.id, {
      full_name: fullName.trim() || undefined,
      phone: phone.trim() || undefined,
      whatsapp: whatsapp.trim() || phone.trim() || undefined,
      college_id: collegeId || null,
      reg_no: regNo.trim() || null,
      hostel_block: hostelBlock || null,
      room_number: roomNumber.trim() || null,
      year: year ? Number(year) : null,
    });
    setBusy(false);
    if (error || !user) {
      Alert.alert('Save failed', error ?? 'Please try again.');
      return;
    }
    setProfile(user);
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-row items-center gap-3 px-5 pt-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface"
          >
            <ChevronLeft color="#1A1D2E" size={22} />
          </Pressable>
          <Text className="font-display text-lg font-bold text-ink">Edit profile</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
          <Field label="Full name">
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              placeholderTextColor="#94A3B8"
              className="min-h-[48px] rounded-sm border border-border bg-surface px-4 text-base text-ink"
            />
          </Field>
          <Field label="Phone">
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="10-digit mobile"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              className="min-h-[48px] rounded-sm border border-border bg-surface px-4 text-base text-ink"
            />
          </Field>
          <Field label="WhatsApp">
            <TextInput
              value={whatsapp}
              onChangeText={setWhatsapp}
              placeholder="Same as phone by default"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              className="min-h-[48px] rounded-sm border border-border bg-surface px-4 text-base text-ink"
            />
          </Field>

          <Field label="College">
            <Chips
              options={COLLEGES.filter((c) => c.active).map((c) => ({
                label: c.name,
                value: c.id,
              }))}
              value={collegeId}
              onChange={setCollegeId}
            />
          </Field>

          <Field label="Registration number">
            <TextInput
              value={regNo}
              onChangeText={setRegNo}
              placeholder="22BCE1001"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              className="min-h-[48px] rounded-sm border border-border bg-surface px-4 text-base text-ink"
            />
          </Field>

          <Field label="Hostel block">
            <Chips
              options={BLOCKS.map((b) => ({ value: b, label: b }))}
              value={hostelBlock}
              onChange={setHostelBlock}
            />
          </Field>

          <Field label="Room number">
            <TextInput
              value={roomNumber}
              onChangeText={setRoomNumber}
              placeholder="312"
              placeholderTextColor="#94A3B8"
              className="min-h-[48px] rounded-sm border border-border bg-surface px-4 text-base text-ink"
            />
          </Field>

          <Field label="Year">
            <Chips
              options={['1', '2', '3', '4', '5'].map((y) => ({ value: y, label: `Year ${y}` }))}
              value={year}
              onChange={setYear}
            />
          </Field>

          <Pressable
            onPress={save}
            disabled={busy}
            accessibilityRole="button"
            className="mt-8 min-h-[52px] items-center justify-center rounded-lg bg-primary disabled:opacity-60"
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-white">Save</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mt-5">
      <Text className="mb-2 text-sm font-semibold text-ink">{label}</Text>
      {children}
    </View>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            onPress={() => onChange(o.value)}
            className={
              sel
                ? 'min-h-[40px] items-center justify-center rounded-full bg-primary px-4'
                : 'min-h-[40px] items-center justify-center rounded-full border border-border bg-surface px-4'
            }
          >
            <Text className={sel ? 'text-sm font-semibold text-white' : 'text-sm text-ink'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
