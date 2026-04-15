import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useAuth } from '@/contexts/AuthContext';
import { assertEnv } from '@/lib/env';

export default function WelcomeScreen() {
  const router = useRouter();
  const { signInGoogle } = useAuth();
  const envErr = assertEnv();
  const [busy, setBusy] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text variant="headlineMedium" style={styles.title}>
        LaundroSwipe
      </Text>
      <Text variant="bodyMedium" style={styles.sub}>
        Customer sign-in uses Google. Staff use email and password.
      </Text>
      {envErr ? (
        <Text style={styles.err}>{envErr}</Text>
      ) : (
        <>
          <Button
            mode="contained"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              const { error } = await signInGoogle();
              setBusy(false);
              if (error) Alert.alert('Sign-in', error);
              else router.replace('/');
            }}
            style={styles.btn}
          >
            Continue with Google
          </Button>
          <Button mode="outlined" onPress={() => router.push('/(auth)/staff')} style={styles.btn}>
            Staff login
          </Button>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { textAlign: 'center', marginBottom: 12 },
  sub: { textAlign: 'center', marginBottom: 24, opacity: 0.8 },
  btn: { marginVertical: 8 },
  err: { color: '#b00020', textAlign: 'center' },
});
