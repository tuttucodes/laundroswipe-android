import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { UserRow } from '@/lib/api';
import type { AdminSession } from '@/lib/admin-auth';

export type AuthState = {
  /** Supabase customer session. */
  session: Session | null;
  /** Profile row from users table (loaded after session). */
  profile: UserRow | null;
  /** Admin/vendor HMAC session from /api/admin/login. */
  admin: AdminSession | null;
  /** True while the first bootstrap call is in flight. */
  loading: boolean;
  setSession(session: Session | null): void;
  setProfile(profile: UserRow | null): void;
  setAdmin(admin: AdminSession | null): void;
  setLoading(loading: boolean): void;
  reset(): void;
};

export const useAuth = create<AuthState>((set) => ({
  session: null,
  profile: null,
  admin: null,
  loading: true,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setAdmin: (admin) => set({ admin }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ session: null, profile: null, admin: null }),
}));

export type Role = 'customer' | 'vendor' | 'super_admin' | null;

export function resolveRole(state: Pick<AuthState, 'session' | 'admin'>): Role {
  if (state.admin) return state.admin.role;
  if (state.session) return 'customer';
  return null;
}
