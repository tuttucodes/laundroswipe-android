/**
 * Resize Supabase Storage public object URLs via the render API for smaller bill/catalog thumbs.
 * Falls back to the original URL (or data URLs unchanged).
 */
export function billCatalogThumbUrl(url: string | null | undefined, width = 96): string | null {
  const u = String(url ?? '').trim();
  if (!u) return null;
  if (u.startsWith('data:')) return u;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return u;
    const marker = '/storage/v1/object/public/';
    const i = parsed.pathname.indexOf(marker);
    if (i === -1) return u;
    const rest = parsed.pathname.slice(i + marker.length);
    if (!rest) return u;
    const w = Math.min(400, Math.max(32, Math.floor(width)));
    return `${parsed.origin}/storage/v1/render/image/public/${rest}?width=${w}&quality=78`;
  } catch {
    return u;
  }
}
