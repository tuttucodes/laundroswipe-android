import type { SupabaseClient } from '@supabase/supabase-js';

export type CachedVendorRow = { id: string; slug: string; name: string };

const VENDORS_TTL_MS = 5 * 60 * 1000;
let vendorsCache: { at: number; list: CachedVendorRow[] } | null = null;

/** Short-lived cache: vendors list rarely changes; avoids an extra round trip on every bill save/list. */
export async function getVendorsListCached(client: SupabaseClient): Promise<{
  data: CachedVendorRow[];
  error: { message: string } | null;
}> {
  const now = Date.now();
  if (vendorsCache && now - vendorsCache.at < VENDORS_TTL_MS) {
    return { data: vendorsCache.list, error: null };
  }
  const { data, error } = await client.from('vendors').select('id, slug, name');
  if (error) {
    return { data: vendorsCache?.list ?? [], error: { message: error.message } };
  }
  const list = (data ?? []) as CachedVendorRow[];
  vendorsCache = { at: now, list };
  return { data: list, error: null };
}

const profileCache = new Map<string, { at: number; overrides: unknown }>();
const PROFILE_TTL_MS = 5 * 60 * 1000;

export async function getVendorBillOverridesCached(
  client: SupabaseClient,
  slug: string | null | undefined,
): Promise<{ bill_item_overrides: unknown }> {
  const k = String(slug ?? '')
    .trim()
    .toLowerCase();
  if (!k) return { bill_item_overrides: {} };
  const now = Date.now();
  const hit = profileCache.get(k);
  if (hit && now - hit.at < PROFILE_TTL_MS) {
    return { bill_item_overrides: hit.overrides };
  }
  const { data, error } = await client.from('vendor_profiles').select('bill_item_overrides').eq('slug', k).maybeSingle();
  if (error) {
    return { bill_item_overrides: hit?.overrides ?? {} };
  }
  const overrides = data?.bill_item_overrides ?? {};
  profileCache.set(k, { at: now, overrides });
  return { bill_item_overrides: overrides };
}
