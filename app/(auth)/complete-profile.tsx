import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLLEGES, VIT_VENDOR_BLOCK_ACCESS } from '@/lib/constants';
import { LSApi } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { Logo } from '@/components/ui/Logo';
import { Container } from '@/components/ui/Container';

const BLOCK_OPTIONS = [
  ...new Set([...VIT_VENDOR_BLOCK_ACCESS.profab, ...VIT_VENDOR_BLOCK_ACCESS.starwash]),
].sort();

const YEAR_OPTIONS = ['1', '2', '3', '4', '5'] as const;

export default function CompleteProfile() {
  const router = useRouter();
  const profile = useAuth((s) => s.profile);
  const setProfile = useAuth((s) => s.setProfile);
  const [collegeId, setCollegeId] = useState(profile?.college_id ?? '');
  const [regNo, setRegNo] = useState(profile?.reg_no ?? '');
  const [hostelBlock, setHostelBlock] = useState(profile?.hostel_block ?? '');
  const [roomNumber, setRoomNumber] = useState(profile?.room_number ?? '');
  const [year, setYear] = useState(String(profile?.year ?? ''));
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [busy, setBusy] = useState(false);

  const canSubmit =
    Boolean(collegeId) &&
    regNo.trim().length > 0 &&
    hostelBlock &&
    roomNumber.trim().length > 0 &&
    phone.trim().length >= 10;

  const save = async () => {
    if (!profile || busy || !canSubmit) return;
    setBusy(true);
    try {
      const { user, error } = await LSApi.updateUser(profile.id, {
        user_type: 'student',
        college_id: collegeId,
        reg_no: regNo.trim(),
        hostel_block: hostelBlock,
        room_number: roomNumber.trim(),
        year: year ? Number(year) : null,
        phone: phone.trim(),
        whatsapp: (profile.whatsapp ?? phone).trim(),
      });
      if (error || !user) {
        Alert.alert('Could not save', error ?? 'Please try again.');
        return;
      }
      setProfile(user);
      router.replace('/');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 48 }}
        >
          <Container style={{ padding: 24 }}>
            <Logo size={32} variant="lockup" />
            <Text className="mt-6 font-display text-3xl font-bold text-ink">One more step</Text>
            <Text className="mt-1 text-sm text-ink-2">Tell us where to pick up from.</Text>

            <Section label="College" required>
              <ChipRow
                items={COLLEGES.filter((c) => c.active).map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                value={collegeId}
                onChange={setCollegeId}
              />
            </Section>

            <Section label="Phone" required>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="10-digit mobile number"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                className="min-h-[48px] rounded-sm border border-border bg-surface px-4 text-base text-ink"
              />
            </Section>

            <Section label="Registration number" required>
              <TextInput
                value={regNo}
                onChangeText={setRegNo}
                placeholder="e.g. 22BCE1001"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                className="min-h-[48px] rounded-sm border border-border bg-surface px-4 text-base text-ink"
              />
            </Section>

            <Section label="Hostel block" required>
              <ChipRow
                items={BLOCK_OPTIONS.map((b) => ({ value: b, label: b }))}
                value={hostelBlock}
                onChange={setHostelBlock}
              />
            </Section>

            <Section label="Room number" required>
              <TextInput
                value={roomNumber}
                onChangeText={setRoomNumber}
                placeholder="e.g. 312"
                placeholderTextColor="#94A3B8"
                className="min-h-[48px] rounded-sm border border-border bg-surface px-4 text-base text-ink"
              />
            </Section>

            <Section label="Year">
              <ChipRow
                items={YEAR_OPTIONS.map((y) => ({ value: y, label: `Year ${y}` }))}
                value={year}
                onChange={setYear}
              />
            </Section>

            <Pressable
              onPress={save}
              disabled={!canSubmit || busy}
              accessibilityRole="button"
              className="mt-8 min-h-[52px] items-center justify-center rounded-lg bg-primary disabled:opacity-50"
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-semibold text-white">Save and continue</Text>
              )}
            </Pressable>
          </Container>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-5">
      <Text className="mb-2 text-sm font-semibold text-ink">
        {label}
        {required ? <Text className="text-error"> *</Text> : null}
      </Text>
      {children}
    </View>
  );
}

function ChipRow({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {items.map((it) => {
        const sel = it.value === value;
        return (
          <Pressable
            key={it.value}
            accessibilityRole="button"
            onPress={() => onChange(it.value)}
            className={
              sel
                ? 'min-h-[40px] items-center justify-center rounded-full bg-primary px-4'
                : 'min-h-[40px] items-center justify-center rounded-full border border-border bg-surface px-4'
            }
          >
            <Text className={sel ? 'text-sm font-semibold text-white' : 'text-sm text-ink'}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
