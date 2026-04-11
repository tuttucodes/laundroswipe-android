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

/** Drop heavy data URLs / huge strings for catalog lines before POST /api/vendor/bills/save|update. */
export function compactLineItemsForSavePayload<T extends SavePayloadLineItem>(items: T[]): T[] {
  return items.map((li) => {
    const id = String(li.id ?? '');
    if (isCustomOrPresetLineId(id)) return li;
    const url = typeof li.image_url === 'string' ? li.image_url.trim() : '';
    if (url.startsWith('data:image/') || url.length > 8192) {
      return { ...li, image_url: null };
    }
    return li;
  });
}
