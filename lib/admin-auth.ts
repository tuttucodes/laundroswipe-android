import * as SecureStore from 'expo-secure-store';

/**
 * Admin / vendor HMAC token (from POST /api/admin/login).
 * Web uses an HttpOnly cookie; mobile stores the same token in the secure enclave and sends
 * it as `Authorization: Bearer <token>` — the server accepts either (see lib/admin-session.ts
 * getAdminTokenFromRequest in the web repo).
 *
 * Token is NOT a Supabase JWT. Do not confuse with customer auth — a single device can hold
 * both (Supabase session + admin token) if a vendor also has a customer account.
 */

const KEY = 'laundroswipe.admin_token';
const ROLE_KEY = 'laundroswipe.admin_role';
const VENDOR_KEY = 'laundroswipe.admin_vendor_id';

export type AdminRole = 'super_admin' | 'vendor';

export type AdminSession = {
  token: string;
  role: AdminRole;
  vendorId: string | null;
};

export async function saveAdminSession(session: AdminSession): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEY, session.token),
    SecureStore.setItemAsync(ROLE_KEY, session.role),
    SecureStore.setItemAsync(VENDOR_KEY, session.vendorId ?? ''),
  ]);
}

export async function readAdminSession(): Promise<AdminSession | null> {
  const [token, role, vendorId] = await Promise.all([
    SecureStore.getItemAsync(KEY),
    SecureStore.getItemAsync(ROLE_KEY),
    SecureStore.getItemAsync(VENDOR_KEY),
  ]);
  if (!token || !role) return null;
  const r: AdminRole = role === 'vendor' ? 'vendor' : 'super_admin';
  return { token, role: r, vendorId: vendorId && vendorId.length > 0 ? vendorId : null };
}

export async function clearAdminSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY),
    SecureStore.deleteItemAsync(ROLE_KEY),
    SecureStore.deleteItemAsync(VENDOR_KEY),
  ]);
}
