import axios, { AxiosHeaders, type AxiosInstance } from 'axios';
import { env } from './env';

export const ADMIN_TOKEN_KEY = 'laundroswipe_admin_jwt';

let supabaseAccessToken: string | null = null;
let adminBearerToken: string | null = null;

export function setSupabaseAccessToken(token: string | null) {
  supabaseAccessToken = token;
}

export function setAdminBearerToken(token: string | null) {
  adminBearerToken = token;
}

export function getAdminBearerToken() {
  return adminBearerToken;
}

/** Next.js API on Vercel — use Supabase JWT for customer routes, admin JWT for /api/admin/* and /api/vendor/*. */
export function createApiClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: env.apiBaseUrl || undefined,
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000,
  });

  instance.interceptors.request.use((config) => {
    const headers = AxiosHeaders.from(config.headers ?? {});
    if (adminBearerToken) headers.set('Authorization', `Bearer ${adminBearerToken}`);
    else if (supabaseAccessToken) headers.set('Authorization', `Bearer ${supabaseAccessToken}`);
    return { ...config, headers };
  });

  return instance;
}

export const api = createApiClient();
