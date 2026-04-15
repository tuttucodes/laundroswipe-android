export function scheduleDateKey(input: unknown): string | null {
  const s = String(input ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] && /^\d{4}-\d{2}-\d{2}$/.test(m[1]) ? m[1] : null;
}
