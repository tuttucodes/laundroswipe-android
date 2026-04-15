import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase';
import { setAdminBearerToken, setSupabaseAccessToken } from '@/lib/http';
import { signInWithGoogleNative } from '@/lib/google-auth';
import { loginAdmin } from '@/lib/admin-login';
import { MobileApi } from '@/lib/mobile-api';
import type { UserRow } from '@/lib/api-types';

const ADMIN_TOKEN = 'laundroswipe_admin_token';
const ADMIN_ROLE = 'laundroswipe_admin_role';
const ADMIN_VENDOR = 'laundroswipe_admin_vendor_id';

type AdminSession = {
  token: string;
  role: string;
  vendorId: string | null;
  vendorDisplayName: string | null;
};

type AuthContextValue = {
  ready: boolean;
  mode: 'none' | 'customer' | 'admin';
  session: Session | null;
  profile: UserRow | null;
  admin: AdminSession | null;
  signInGoogle: () => Promise<{ error?: string }>;
  signInAdmin: (email: string, password: string) => Promise<{ error?: string }>;
  signOutCustomer: () => Promise<void>;
  signOutAdmin: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthContextValue | null>(null);

async function loadAdminFromStore(): Promise<AdminSession | null> {
  try {
    const token = await SecureStore.getItemAsync(ADMIN_TOKEN);
    const role = await SecureStore.getItemAsync(ADMIN_ROLE);
    if (!token || !role) return null;
    const vendorId = await SecureStore.getItemAsync(ADMIN_VENDOR);
    return {
      token,
      role,
      vendorId: vendorId && vendorId !== 'null' ? vendorId : null,
      vendorDisplayName: null,
    };
  } catch {
    return null;
  }
}

async function saveAdminToStore(a: AdminSession | null) {
  if (!a) {
    await SecureStore.deleteItemAsync(ADMIN_TOKEN);
    await SecureStore.deleteItemAsync(ADMIN_ROLE);
    await SecureStore.deleteItemAsync(ADMIN_VENDOR);
    return;
  }
  await SecureStore.setItemAsync(ADMIN_TOKEN, a.token);
  await SecureStore.setItemAsync(ADMIN_ROLE, a.role);
  await SecureStore.setItemAsync(ADMIN_VENDOR, a.vendorId ?? '');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [admin, setAdmin] = useState<AdminSession | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !session?.user?.id) {
      setProfile(null);
      return;
    }
    const row = await MobileApi.fetchUserById(session.user.id);
    setProfile(row);
  }, [session?.user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const a = await loadAdminFromStore();
      if (!cancelled && a) {
        setAdmin(a);
        setAdminBearerToken(a.token);
        setSupabaseAccessToken(null);
        if (supabase) await supabase.auth.signOut();
      }
      if (!supabase) {
        setReady(true);
        return;
      }
      const {
        data: { session: s },
      } = await supabase.auth.getSession();
      if (!cancelled) {
        if (!a) {
          setSession(s);
          setSupabaseAccessToken(s?.access_token ?? null);
        }
        if (s?.user?.id && !a) {
          const p = await MobileApi.upsertUserFromAuth({
            id: s.user.id,
            email: s.user.email,
            user_metadata: s.user.user_metadata as { full_name?: string; name?: string },
          });
          setProfile(p);
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_evt, s) => {
      setSession(s);
      setSupabaseAccessToken(s?.access_token ?? null);
      if (admin) return;
      if (s?.user?.id) {
        const p = await MobileApi.upsertUserFromAuth({
          id: s.user.id,
          email: s.user.email,
          user_metadata: s.user.user_metadata as { full_name?: string; name?: string },
        });
        setProfile(p);
      } else {
        setProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [admin]);

  const signInGoogle = useCallback(async () => {
    const { error } = await signInWithGoogleNative();
    if (error) return { error };
    setAdmin(null);
    setAdminBearerToken(null);
    await saveAdminToStore(null);
    return {};
  }, []);

  const signInAdmin = useCallback(async (email: string, password: string) => {
    const res = await loginAdmin(email, password);
    if (!res.ok) return { error: res.error };
    const a: AdminSession = {
      token: res.token,
      role: res.role,
      vendorId: res.vendorId,
      vendorDisplayName: res.vendorDisplayName,
    };
    setAdmin(a);
    setAdminBearerToken(res.token);
    setSupabaseAccessToken(null);
    await saveAdminToStore(a);
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    return {};
  }, []);

  const signOutCustomer = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setSupabaseAccessToken(null);
  }, []);

  const signOutAdmin = useCallback(async () => {
    setAdmin(null);
    setAdminBearerToken(null);
    await saveAdminToStore(null);
  }, []);

  const mode: AuthContextValue['mode'] = admin ? 'admin' : session ? 'customer' : 'none';

  const value = useMemo(
    () => ({
      ready,
      mode,
      session,
      profile,
      admin,
      signInGoogle,
      signInAdmin,
      signOutCustomer,
      signOutAdmin,
      refreshProfile,
    }),
    [ready, mode, session, profile, admin, signInGoogle, signInAdmin, signOutCustomer, signOutAdmin, refreshProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
