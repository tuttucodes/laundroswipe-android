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
  {
    id: 'wash_iron',
    name: 'Wash & Iron',
    emoji: '👔',
    desc: 'Washed, ironed & hung',
    comingSoon: false,
  },
  {
    id: 'dry_clean',
    name: 'Dry Cleaning',
    emoji: '🧥',
    desc: 'Premium dry clean care',
    comingSoon: false,
  },
  {
    id: 'shoe_clean',
    name: 'Shoe Clean',
    emoji: '👟',
    desc: 'Deep clean per pair',
    comingSoon: false,
  },
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
    bookOnlyWhenSlotsAvailable: true,
    availability: { type: 'nearby', lat: 12.8406, lng: 80.1533, radiusKm: 18 },
  },
] as const;

export const VIT_VENDOR_BLOCK_ACCESS = {
  profab: ['A', 'D1', 'D2'],
  starwash: ['B', 'C', 'E'],
} as const;

/**
 * Default bill item catalog for Pro Fab. Vendor-level overrides (price/label/image_url)
 * are merged on top via vendor-bill-catalog.mergeVendorBillItemsFromDbRow.
 */
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
  { id: 'turkey', label: 'Turkey', price: 20 },
  { id: 'pyjamma', label: 'Pyjamma', price: 40 },
  { id: 'pyjamma_dc', label: 'Pyjamma DC', price: 80 },
] as const;

export const STARWASH_VENDOR_BILL_ITEMS = [...PROFAB_VENDOR_BILL_ITEMS] as const;

export const VENDOR_BILL_ITEMS_BY_VENDOR = {
  profab: PROFAB_VENDOR_BILL_ITEMS,
  starwash: STARWASH_VENDOR_BILL_ITEMS,
} as const;

export function getVendorBillItems(vendorId?: string | null) {
  const key = String(vendorId ?? '')
    .trim()
    .toLowerCase() as keyof typeof VENDOR_BILL_ITEMS_BY_VENDOR;
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

export type OrderStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  scheduled: 'Pickup Scheduled',
  agent_assigned: 'Agent Assigned',
  picked_up: 'Picked Up',
  processing: 'At Facility',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
};

export const STATUS_EMOJI: Record<OrderStatus, string> = {
  scheduled: '🟡',
  agent_assigned: '🔵',
  picked_up: '🟢',
  processing: '⚙️',
  ready: '📦',
  out_for_delivery: '🚚',
  delivered: '✅',
};

export function statusLabel(s: string): string {
  return (STATUS_LABELS as Record<string, string>)[s] ?? s;
}

export function statusClass(s: string): 's-sch' | 's-pro' | 's-del' {
  if (s === 'scheduled' || s === 'agent_assigned') return 's-sch';
  if (s === 'delivered') return 's-del';
  return 's-pro';
}

/** When a bill exists but order is still early-stage, show "Bill ready" instead. */
export function customerFacingStatusLabel(status: string, hasActiveBill: boolean): string {
  if (hasActiveBill && (status === 'scheduled' || status === 'agent_assigned')) return 'Bill ready';
  return statusLabel(status);
}

export function customerFacingStatusClass(
  status: string,
  hasActiveBill: boolean,
): 's-sch' | 's-pro' | 's-del' {
  if (hasActiveBill && (status === 'scheduled' || status === 'agent_assigned')) return 's-pro';
  return statusClass(status);
}
