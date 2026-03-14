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
  { id: 'wash_fold', name: 'Wash & Fold', emoji: '👕', desc: 'Washed, dried & neatly folded' },
  { id: 'wash_iron', name: 'Wash & Iron', emoji: '👔', desc: 'Washed, ironed & hung' },
  { id: 'dry_clean', name: 'Dry Cleaning', emoji: '🧥', desc: 'Premium dry clean care' },
  { id: 'iron_only', name: 'Iron Only', emoji: '♨️', desc: 'Press & steam finish' },
  { id: 'express', name: 'Express', emoji: '⚡', desc: 'Same-day turnaround' },
  { id: 'shoe_clean', name: 'Shoe Clean', emoji: '👟', desc: 'Deep clean per pair' },
] as const;

export const VENDOR = {
  name: 'Pro Fab Power Laundry Services',
  days: ['Tuesday', 'Saturday'],
  location: 'VIT Chennai Campus',
} as const;

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
      ok: w === 2 || w === 6,
      full: d.toISOString().split('T')[0],
    });
  }
  return days;
}
