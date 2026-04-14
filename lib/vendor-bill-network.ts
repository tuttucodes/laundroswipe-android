/**
 * Reduce upload size for bill save on slow networks. Catalog line images are re-filled server-side
 * from vendor_profiles + constants; only custom_/preset_ rows may rely on client-sent image_url.
 */
export type SavePayloadLineItem = {
  id: string;
  qty: number;
  label?: string | null;
  price?: number | string | null;
  image_url?: string | null;
};

function isCustomOrPresetLineId(id: string): boolean {
  return id.startsWith('custom_') || id.startsWith('preset_');
}

/** Drop heavy/non-storage-safe image payloads before POST /api/vendor/bills/save|update. */
export function compactLineItemsForSavePayload<T extends SavePayloadLineItem>(items: T[]): T[] {
  return items.map((li) => {
    const id = String(li.id ?? '');
    const url = typeof li.image_url === 'string' ? li.image_url.trim() : '';
    const allowHttpUrl = url.startsWith('http://') || url.startsWith('https://');
    if (!allowHttpUrl || url.length > 8192) {
      return { ...li, image_url: null };
    }
    if (isCustomOrPresetLineId(id)) return li;
    return li;
  });
}
