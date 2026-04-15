import axios from 'axios';
import { env } from './env';

export type AdminLoginResult =
  | { ok: true; token: string; role: string; vendorId: string | null; vendorDisplayName: string | null }
  | { ok: false; error: string };

export async function loginAdmin(email: string, password: string): Promise<AdminLoginResult> {
  if (!env.apiBaseUrl) return { ok: false, error: 'EXPO_PUBLIC_API_BASE_URL not set' };
  try {
    const res = await axios.post(
      `${env.apiBaseUrl}/api/admin/login`,
      { email: email.trim().toLowerCase(), password },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 },
    );
    const data = res.data as {
      ok?: boolean;
      token?: string;
      role?: string;
      vendorId?: string | null;
      vendorDisplayName?: string | null;
      error?: string;
    };
    if (!data?.ok || !data.token) {
      return { ok: false, error: data?.error || 'Login failed' };
    }
    return {
      ok: true,
      token: data.token,
      role: String(data.role ?? 'vendor'),
      vendorId: data.vendorId ?? null,
      vendorDisplayName: data.vendorDisplayName ?? null,
    };
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return { ok: false, error: err?.response?.data?.error || 'Login failed' };
  }
}
