import { useEffect } from 'react';
import { registerPushToken } from '@/lib/push';
import { useAuth } from '@/store/auth';

/**
 * Registers the Expo push token once per session, keyed by the signed-in users.id.
 * Safe to call on multiple mounts — `user_push_tokens.token` has a unique index so
 * the upsert is idempotent.
 */
export function useRegisterPush() {
  const profile = useAuth((s) => s.profile);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await registerPushToken(profile.id);
        if (cancelled || !token) return;
      } catch (e) {
        console.warn('registerPushToken failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);
}
