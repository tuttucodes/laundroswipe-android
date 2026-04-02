export const COLLEGES = [
  { id: 'vit-chn', name: 'VIT Chennai', code: 'VIT_CHN', active: true },
  { id: 'vit-vlr', name: 'VIT Vellore', code: 'VIT_VLR', active: false },
  { id: 'vit-ap', name: 'VIT AP', code: 'VIT_AP', active: false },
  { id: 'vit-bpl', name: 'VIT Bhopal', code: 'VIT_BPL', active: false },
  { id: 'srm-ktr', name: 'SRM KTR (Kattankulathur)', code: 'SRM_KTR', active: false },
  { id: 'srm-vdp', name: 'SRM VDP (Vadapalani)', code: 'SRM_VDP', active: false },
  { id: 'srm-rmp', name: 'SRM Ramapuram', code: 'SRM_RMP', active: false },
  { id: 'tmc', name: 'Tagore Medical College', code: 'TMC', active: false },
  { id: 'hec', name: 'Hindustan Engineering College', code: 'HEC', active: false },
] as const;

export const SERVICES = [
  { id: 'wash_fold', name: 'Wash & Fold', emoji: '👕', desc: 'Washed, dried & neatly folded', comingSoon: false },
  { id: 'wash_iron', name: 'Wash & Iron', emoji: '👔', desc: 'Washed, ironed & hung', comingSoon: false },
  { id: 'dry_clean', name: 'Dry Cleaning', emoji: '🧥', desc: 'Premium dry clean care', comingSoon: false },
  { id: 'iron_only', name: 'Iron Only', emoji: '♨️', desc: 'Press & steam finish', comingSoon: false },
  { id: 'express', name: 'Express', emoji: '⚡', desc: 'Same-day turnaround', comingSoon: true },
  { id: 'shoe_clean', name: 'Shoe Clean', emoji: '👟', desc: 'Deep clean per pair', comingSoon: false },
] as const;

export const VENDORS = [
  {
    id: 'profab',
    name: 'Pro Fab Power Laundry Services',
    location: 'On-campus pickup point',
    emoji: '🧺',
    audienceLabel: 'For A, D1 & D2 Students Only',
    availability: { type: 'nearby', lat: 12.8406, lng: 80.1533, radiusKm: 18 },
  },
  {
    id: 'starwash',
    name: 'Star Wash Power Launderers',
    location: 'VIT Chennai',
    emoji: '🧼',
    audienceLabel: 'For B, C & E Block Students Only',
    availability: { type: 'nearby', lat: 12.8406, lng: 80.1533, radiusKm: 18 },
  },
] as const;

export const VENDOR = {
  name: 'Pro Fab Power Laundry Services',
  days: ['Tuesday', 'Saturday', 'Sunday'],
  location: 'On-campus pickup point',
} as const;

export const VIT_VENDOR_BLOCK_ACCESS = {
  profab: ['A', 'D1', 'D2'],
  starwash: ['B', 'C', 'E'],
} as const;

export const PROFAB_VENDOR_BILL_ITEMS = [
  { id: 'pant', label: 'Pant', price: 22 },
  { id: 'pant_dc', label: 'Pant DC', price: 50 },
  { id: 'jeans', label: 'Jeans', price: 22 },
  { id: 'jeans_dc', label: 'Jeans DC', price: 50 },
  { id: 'white_pant', label: 'White Pant', price: 25 },
  { id: 'white_pant_dc', label: 'White Pant DC', price: 60 },
  { id: 'white_jeans', label: 'White Jeans', price: 25 },
  { id: 'white_jeans_dc', label: 'White Jeans DC', price: 60 },
  { id: 'shirt', label: 'Shirt', price: 22 },
  { id: 'shirt_dc', label: 'Shirt DC', price: 50 },
  { id: 'tshirt', label: 'T-Shirt', price: 22 },
  { id: 'tshirt_dc', label: 'T-Shirt DC', price: 50 },
  { id: 'white_shirt', label: 'White Shirt', price: 25 },
  { id: 'white_shirt_dc', label: 'White Shirt DC', price: 60 },
  { id: 'white_tshirt', label: 'White T-Shirt', price: 25 },
  { id: 'white_tshirt_dc', label: 'White T-Shirt DC', price: 60 },
  { id: 'shorts', label: 'Shorts', price: 16 },
  { id: 'shorts_dc', label: 'Shorts DC', price: 40 },
  { id: 'lungi', label: 'Lungi', price: 20 },
  { id: 'lungi_dc', label: 'Lungi DC', price: 50 },
  { id: 'towel', label: 'Towel', price: 18 },
  { id: 'towel_dc', label: 'Towel DC', price: 40 },
  { id: 'bed_sheet', label: 'Bed Sheet', price: 25 },
  { id: 'bed_sheet_dc', label: 'Bed Sheet DC', price: 60 },
  { id: 'hand_towel', label: 'Hand Towel', price: 8 },
  { id: 'hand_towel_dc', label: 'Hand Towel DC', price: 20 },
  { id: 'pillow_cover', label: 'Pillow Cover', price: 12 },
  { id: 'pillow_cover_dc', label: 'Pillow Cover DC', price: 30 },
  { id: 'dhoti', label: 'Dhoti', price: 40 },
  { id: 'dhoti_dc', label: 'Dhoti DC', price: 60 },
  { id: 'blanket_small', label: 'Blanket (Small)', price: 90 },
  { id: 'blanket_small_dc', label: 'Blanket (Small) DC', price: 110 },
  { id: 'blanket_big', label: 'Blanket (Big)', price: 100 },
  { id: 'blanket_big_dc', label: 'Blanket (Big) DC', price: 120 },
  { id: 'lab_coat', label: 'Lab Coat', price: 25 },
  { id: 'lab_coat_dc', label: 'Lab Coat DC', price: 60 },
  { id: 'quilt', label: 'Quilt', price: 120 },
  { id: 'quilt_dc', label: 'Quilt DC', price: 150 },
  { id: 'jacket', label: 'Jacket', price: 50 },
  { id: 'jacket_dc', label: 'Jacket DC', price: 100 },
  { id: 'hoodie', label: 'Hoodie', price: 50 },
  { id: 'hoodie_dc', label: 'Hoodie DC', price: 100 },
  { id: 'kurta', label: 'Kurta', price: 50 },
  { id: 'kurta_dc', label: 'Kurta DC', price: 100 },
  { id: 'track_pant', label: 'Track Pant', price: 22 },
  { id: 'track_pant_dc', label: 'Track Pant DC', price: 40 },
  { id: 'bag', label: 'Bag', price: 150 },
  { id: 'shoe', label: 'Shoe', price: 70 },
  { id: 'shoe_dc', label: 'Shoe DC', price: 150 },
  { id: 'only_iron', label: 'Only Iron', price: 10 },
  { id: 'ladies_top', label: 'Ladies Top', price: 25 },
  { id: 'ladies_top_dc', label: 'Ladies Top DC', price: 60 },
  { id: 'ladies_bottom', label: 'Ladies Bottom', price: 22 },
  { id: 'ladies_bottom_dc', label: 'Ladies Bottom DC', price: 50 },
  { id: 'shawl', label: 'Shawl', price: 18 },
  { id: 'shawl_dc', label: 'Shawl DC', price: 40 },
  { id: 'saree', label: 'Saree', price: 70 },
  { id: 'saree_dc', label: 'Saree DC', price: 150 },
  { id: 'fancy_dress_dc', label: 'Fancy Dress DC', price: 100 },
  { id: 'blazer_dc', label: 'Blazer DC', price: 150 },
] as const;

export const STARWASH_VENDOR_BILL_ITEMS = [
  ...PROFAB_VENDOR_BILL_ITEMS,
] as const;

export const VENDOR_BILL_ITEMS_BY_VENDOR = {
  profab: PROFAB_VENDOR_BILL_ITEMS,
  starwash: STARWASH_VENDOR_BILL_ITEMS,
} as const;

export function getVendorBillItems(vendorId?: string | null) {
  const key = String(vendorId ?? '').trim().toLowerCase() as keyof typeof VENDOR_BILL_ITEMS_BY_VENDOR;
  return VENDOR_BILL_ITEMS_BY_VENDOR[key] ?? PROFAB_VENDOR_BILL_ITEMS;
}

export const STATUSES = [
  'scheduled',
  'agent_assigned',
  'picked_up',
  'processing',
  'ready',
  'out_for_delivery',
  'delivered',
] as const;

export const STATUS_LABELS = [
  'Pickup Scheduled',
  'Agent Assigned',
  'Picked Up',
  'At Facility',
  'Ready',
  'Out for Delivery',
  'Delivered',
];

export const STATUS_EMOJI = ['🟡', '🔵', '🟢', '⚙️', '📦', '🚚', '✅'];

export function statusLabel(s: string): string {
  const i = STATUSES.indexOf(s as (typeof STATUSES)[number]);
  return STATUS_LABELS[i] ?? s;
}

export function statusClass(s: string): string {
  if (['scheduled', 'agent_assigned'].includes(s)) return 's-sch';
  if (s === 'delivered') return 's-del';
  return 's-pro';
}

export function next10Days(): { date: Date; day: string; num: number; month: string; ok: boolean; full: string }[] {
  const dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days: { date: Date; day: string; num: number; month: string; ok: boolean; full: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const w = d.getDay();
    days.push({
      date: d,
      day: dn[w],
      num: d.getDate(),
      month: mn[d.getMonth()],
      ok: w === 0 || w === 2 || w === 6, // Sun, Tue, Sat
      full: d.toISOString().split('T')[0],
    });
  }
  return days;
}

/** Only March 15 and March 18 (current year) are bookable; both evening slot only. */
export function getScheduleDates(): { date: Date; day: string; num: number; month: string; ok: boolean; full: string }[] {
  const dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const year = new Date().getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: { date: Date; day: string; num: number; month: string; ok: boolean; full: string }[] = [];
  for (const dayNum of [15, 18]) {
    const d = new Date(year, 2, dayNum); // month 2 = March
    if (d.getTime() < today.getTime()) continue;
    const full = d.toISOString().split('T')[0];
    out.push({
      date: d,
      day: dn[d.getDay()],
      num: d.getDate(),
      month: mn[d.getMonth()],
      ok: true,
      full,
    });
  }
  return out;
}

/** True for March 15 and 18 — only evening slot available (afternoon disabled). */
export function isEveningOnlyDate(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T12:00:00');
  return d.getMonth() === 2 && (d.getDate() === 15 || d.getDate() === 18);
}
