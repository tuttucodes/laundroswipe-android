import { getVendorBillItems } from '@/lib/constants';

export type BillItemOverride = {
  price?: number;
  label?: string;
  image_url?: string | null;
};

export type MergedBillItem = {
  id: string;
  label: string;
  price: number;
  image_url?: string | null;
};

const MAX_LABEL = 120;
const MAX_PRICE = 50_000;
const MAX_DATA_URL_LEN = 350_000;
const MAX_HTTP_URL_LEN = 2000;

export function parseBillItemOverrides(raw: unknown): Record<string, BillItemOverride> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, BillItemOverride> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = String(k ?? '').trim();
    if (!id || v === null || typeof v !== 'object') continue;
    const o: BillItemOverride = {};
    const rec = v as Record<string, unknown>;
    if (typeof rec.price === 'number' && Number.isFinite(rec.price) && rec.price > 0 && rec.price <= MAX_PRICE) {
      o.price = rec.price;
    }
    if (typeof rec.label === 'string') {
      const l = rec.label.trim();
      if (l.length > 0 && l.length <= MAX_LABEL) o.label = l;
    }
    if ('image_url' in rec) {
      if (rec.image_url === null || rec.image_url === '') o.image_url = null;
      else if (typeof rec.image_url === 'string') {
        const t = rec.image_url.trim();
        if (t.startsWith('http://') || t.startsWith('https://')) {
          o.image_url = t.slice(0, MAX_HTTP_URL_LEN);
        } else if (t.startsWith('data:image/') && t.length <= MAX_DATA_URL_LEN) {
          o.image_url = t;
        }
      }
    }
    if (Object.keys(o).length > 0) out[id] = o;
  }
  return out;
}

export function mergeVendorBillItems(
  vendorSlug: string | null | undefined,
  overrides: Record<string, BillItemOverride>,
): MergedBillItem[] {
  const base = getVendorBillItems(vendorSlug);
  return base.map((b) => {
    const o = overrides[b.id];
    const hasImageKey = o != null && Object.prototype.hasOwnProperty.call(o, 'image_url');
    return {
      id: b.id,
      label: o?.label ?? b.label,
      price: o?.price ?? b.price,
      image_url: hasImageKey ? (o!.image_url ?? null) : null,
    };
  });
}

export function mergeVendorBillItemsFromDbRow(
  vendorSlug: string | null | undefined,
  bill_item_overrides: unknown,
): MergedBillItem[] {
  return mergeVendorBillItems(vendorSlug, parseBillItemOverrides(bill_item_overrides));
}

const catalogIdSet = (vendorSlug: string | null | undefined) =>
  new Set<string>(getVendorBillItems(vendorSlug).map((x) => x.id));

/**
 * Sanitize PUT body: only known catalog ids; drop empty entries.
 */
export function sanitizeBillItemOverridesForPut(
  vendorSlug: string | null | undefined,
  body: unknown,
): Record<string, BillItemOverride> {
  if (!body || typeof body !== 'object') return {};
  const allowed = catalogIdSet(vendorSlug);
  const raw = (body as { overrides?: unknown }).overrides;
  if (!raw || typeof raw !== 'object') return {};
  const parsed = parseBillItemOverrides(raw);
  const out: Record<string, BillItemOverride> = {};
  for (const [id, o] of Object.entries(parsed)) {
    if (!allowed.has(id)) continue;
    if (Object.keys(o).length === 0) continue;
    out[id] = o;
  }
  return out;
}
