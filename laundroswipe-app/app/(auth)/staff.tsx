import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useAuth } from '@/contexts/AuthContext';

export default function StaffLoginScreen() {
  const router = useRouter();
  const { signInAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setErr(null);
    setLoading(true);
    const { error } = await signInAdmin(email, password);
    setLoading(false);
    if (error) {
      setErr(error);
      return;
    }
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <View style={styles.wrap}>
        <Text variant="titleLarge" style={styles.mb}>
          Admin / vendor
        </Text>
        <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.mb} />
        <TextInput label="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.mb} />
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <Button mode="contained" loading={loading} onPress={onSubmit} disabled={!email.trim() || !password}>
          Sign in
        </Button>
        <Button onPress={() => router.back()} style={styles.mt}>
          Back
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flex: 1, padding: 24, justifyContent: 'center' },
  mb: { marginBottom: 12 },
  mt: { marginTop: 16 },
  err: { color: '#b00020', marginBottom: 12 },
});
