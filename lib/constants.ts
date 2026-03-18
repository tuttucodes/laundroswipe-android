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
    location: 'VIT Chennai Campus',
    emoji: '🧺',
    availability: { type: 'nearby', lat: 12.8406, lng: 80.1533, radiusKm: 18 },
  },
  { id: 'jos-brothers', name: 'Jos Brothers', location: 'Kochi', emoji: '🧼', comingSoon: true },
  { id: 'tumbledry', name: 'TumbleDry', location: 'Bangalore · Chennai', emoji: '🌀', comingSoon: true },
] as const;

export const VENDOR = {
  name: 'Pro Fab Power Laundry Services',
  days: ['Tuesday', 'Saturday', 'Sunday'],
  location: 'VIT Chennai Campus',
} as const;

export const CONVENIENCE_FEE = 20;

export const VENDOR_BILL_ITEMS = [
  { id: 'shirt', label: 'Shirt', price: 19 },
  { id: 'tshirt', label: 'T shirt', price: 19 },
  { id: 'white_shirt', label: 'White shirt', price: 25 },
  { id: 'white_tshirt', label: 'White t shirt', price: 25 },
  { id: 'shirt_dc', label: 'Shirt dc', price: 50 },
  { id: 'tshirt_dc', label: 'T-shirts dc', price: 50 },
  { id: 'white_shirt_dc', label: 'White shirt dc', price: 60 },
  { id: 'white_tshirt_dc', label: 'White t shirt dc', price: 60 },
  { id: 'white_pants', label: 'White pants', price: 25 },
  { id: 'white_pants_dc', label: 'White pants dc', price: 60 },
  { id: 'white_jean', label: 'White jean', price: 25 },
  { id: 'white_jean_dc', label: 'White jean dc', price: 60 },
  { id: 'pant', label: 'Pant', price: 22 },
  { id: 'pant_dc', label: 'Pant dc', price: 50 },
  { id: 'jean', label: 'Jean', price: 22 },
  { id: 'jeans_dc', label: 'Jeans dc', price: 50 },
  { id: 'bedsheet', label: 'Bedsheet', price: 30 },
  { id: 'bedsheet_dc', label: 'Bedsheet dc', price: 60 },
  { id: 'pillow', label: 'Pillow', price: 15 },
  { id: 'pillow_dc', label: 'Pillow dc', price: 30 },
  { id: 'hoodie', label: 'Hoodie', price: 50 },
  { id: 'hoodie_dc', label: 'Hoodie dc', price: 80 },
  { id: 'jacket', label: 'Jacket', price: 50 },
  { id: 'jacket_dc', label: 'Jacket dc', price: 80 },
  { id: 'shorts', label: 'Shorts', price: 19 },
  { id: 'shorts_dc', label: 'Shorts dc', price: 40 },
  { id: 'shoe_wash', label: 'Shoe wash', price: 150 },
  { id: 'blanket_big_dc', label: 'Blanket big dc', price: 110 },
  { id: 'blanket_small_dc', label: 'Blanket small dc', price: 90 },
  { id: 'quilt_dc', label: 'Quilt dc', price: 130 },
  { id: 'track_pant', label: 'Track pant', price: 19 },
  { id: 'track_pant_dc', label: 'Track pant dc', price: 50 },
  { id: 'white_track_pant', label: 'White track pant', price: 25 },
  { id: 'white_track_pant_dc', label: 'White track pant dc', price: 60 },
  { id: 'towel', label: 'Towel', price: 20 },
  { id: 'towel_dc', label: 'Towel dc', price: 40 },
  { id: 'turkey_towel', label: 'Turkey towel', price: 25 },
  { id: 'turkey_towel_dc', label: 'Turkey towel dc', price: 40 },
  { id: 'hand_towel', label: 'Hand towel', price: 12 },
  { id: 'hand_towel_dc', label: 'Hand towel dc', price: 22 },
  { id: 'dhoti', label: 'Dhoti', price: 50 },
  { id: 'dhoti_dc', label: 'Dhoti dc', price: 80 },
  { id: 'kurtha', label: 'Kurtha', price: 50 },
  { id: 'kurtha_dc', label: 'Kurtha dc', price: 80 },
  { id: 'iron_only', label: 'Only ironing', price: 10 },
  { id: 'ladies_top', label: 'Ladies top', price: 25 },
  { id: 'ladies_top_dc', label: 'Ladies top dc', price: 60 },
  { id: 'leggings', label: 'Leggings', price: 20 },
  { id: 'leggings_dc', label: 'Leggings dc', price: 50 },
  { id: 'bedsheet_heavy', label: 'Bedsheet heavy', price: 40 },
  { id: 'white_bedsheet', label: 'White bedsheet', price: 40 },
  { id: 'dupatta', label: 'Dupatta', price: 22 },
  { id: 'dupatta_dc', label: 'Dupatta dc', price: 40 },
  { id: 'cap', label: 'Cap', price: 25 },
  { id: 'cap_dc', label: 'Cap dc', price: 40 },
  { id: 'bag_wash', label: 'Bag wash', price: 150 },
] as const;

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
