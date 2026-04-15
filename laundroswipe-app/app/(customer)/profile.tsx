import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text, TextInput } from 'react-native-paper';
import { useAuth } from '@/contexts/AuthContext';
import { MobileApi } from '@/lib/mobile-api';
import { CURRENT_TERMS_VERSION } from '@/lib/terms';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, refreshProfile, signOutCustomer } = useAuth();
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [wa, setWa] = useState(profile?.whatsapp ?? '');
  const [ut, setUt] = useState(profile?.user_type ?? 'general');
  const [cid, setCid] = useState(profile?.college_id ?? 'general');
  const [rn, setRn] = useState(profile?.reg_no ?? '');
  const [hos, setHos] = useState(profile?.hostel_block ?? '');
  const [room, setRoom] = useState(profile?.room_number ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setPhone(profile.phone ?? '');
    setWa(profile.whatsapp ?? '');
    setUt(profile.user_type ?? 'general');
    setCid(profile.college_id ?? 'general');
    setRn(profile.reg_no ?? '');
    setHos(profile.hostel_block ?? '');
    setRoom(profile.room_number ?? '');
  }, [profile]);

  if (!profile) {
    return (
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text>Loading profile…</Text>
      </ScrollView>
    );
  }

  const save = async () => {
    setSaving(true);
    const { user, error } = await MobileApi.updateUser(profile.id, {
      phone: phone.trim() || null,
      whatsapp: wa.trim() || null,
      user_type: ut.trim() || 'general',
      college_id: cid.trim() || null,
      reg_no: rn.trim() || null,
      hostel_block: hos.trim() || null,
      room_number: room.trim() || null,
    });
    setSaving(false);
    if (!user) {
      Alert.alert('Profile', error ?? 'Update failed');
      return;
    }
    await refreshProfile();
    Alert.alert('Profile', 'Saved');
  };

  const termsOk = String(profile.terms_version ?? '') === CURRENT_TERMS_VERSION;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text variant="titleMedium">{profile.full_name}</Text>
      <Text variant="bodySmall" style={styles.mb}>
        {profile.email}
      </Text>
      <TextInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.field} />
      <TextInput label="WhatsApp" value={wa} onChangeText={setWa} keyboardType="phone-pad" style={styles.field} />
      <TextInput label="User type (general/student)" value={ut} onChangeText={setUt} style={styles.field} />
      <TextInput label="College id (e.g. vit-chn)" value={cid} onChangeText={setCid} style={styles.field} />
      <TextInput label="Registration no." value={rn} onChangeText={setRn} style={styles.field} />
      <TextInput label="Hostel block" value={hos} onChangeText={setHos} style={styles.field} />
      <TextInput label="Room number" value={room} onChangeText={setRoom} style={styles.field} />
      <Text variant="bodySmall" style={styles.mb}>
        Terms version: {profile.terms_version ?? '—'} {termsOk ? '(OK)' : '(accept on Book tab)'}
      </Text>
      <Button mode="contained" onPress={save} loading={saving}>
        Save profile
      </Button>
      <Button
        mode="outlined"
        onPress={async () => {
          await signOutCustomer();
          router.replace('/');
        }}
        style={styles.mt}
      >
        Sign out
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 48 },
  field: { marginBottom: 12 },
  mb: { marginVertical: 8 },
  mt: { marginTop: 16 },
});
