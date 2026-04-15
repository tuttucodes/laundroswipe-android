export const COLLEGES = [
  { id: 'vit-chn', name: 'VIT Chennai', code: 'VIT_CHN', active: true },
  { id: 'vit-vlr', name: 'VIT Vellore', code: 'VIT_VLR', active: false },
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
  },
  {
    id: 'starwash',
    name: 'Star Wash Power Launderers',
    location: 'VIT Chennai',
    emoji: '🧼',
    audienceLabel: 'For B, C & E Block Students Only',
    bookOnlyWhenSlotsAvailable: true,
  },
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

export function statusLabel(s: string): string {
  const i = STATUSES.indexOf(s as (typeof STATUSES)[number]);
  return STATUS_LABELS[i] ?? s;
}

export function customerFacingStatusLabel(status: string, hasActiveBill: boolean): string {
  if (hasActiveBill && (status === 'scheduled' || status === 'agent_assigned')) {
    return 'Bill ready';
  }
  return statusLabel(status);
}
