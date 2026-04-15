export type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  user_type: string | null;
  college_id: string | null;
  reg_no: string | null;
  hostel_block: string | null;
  room_number: string | null;
  year: number | null;
  display_id?: string | null;
  terms_accepted_at?: string | null;
  terms_version?: string | null;
};

export type OrderRow = {
  id: string;
  order_number: string;
  token: string;
  service_id: string;
  service_name: string;
  pickup_date: string;
  time_slot: string;
  status: string;
  instructions: string | null;
  user_id: string | null;
  vendor_name?: string | null;
  vendor_id?: string | null;
  created_at: string;
  delivery_confirmed_at?: string | null;
  delivery_comments?: string | null;
};

export type ScheduleSlotRow = {
  id: string;
  label: string;
  time_from: string;
  time_to: string;
  sort_order: number;
  active: boolean;
  created_at?: string;
};

export type ScheduleDateRow = {
  date: string;
  enabled: boolean;
  slot_ids: string[];
  slot_ids_by_vendor?: Record<string, string[]> | null;
  enabled_by_vendor?: Record<string, boolean> | null;
  created_at?: string;
  updated_at?: string;
};

export type VendorBillRow = {
  id: string;
  order_id: string | null;
  order_token: string;
  order_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_reg_no?: string | null;
  customer_hostel_block?: string | null;
  customer_room_number?: string | null;
  user_id: string | null;
  user_display_id?: string | null;
  line_items: { id: string; label: string; price: number; qty: number; image_url?: string | null }[];
  subtotal: number;
  convenience_fee: number;
  total: number;
  vendor_name?: string | null;
  vendor_id?: string | null;
  vendor_slug?: string | null;
  cancelled_at?: string | null;
  cancelled_by_role?: string | null;
  created_at: string;
};

export type UserNotificationRow = {
  id: string;
  user_id: string | null;
  title: string;
  body: string | null;
  sent_at: string | null;
  scheduled_at: string | null;
  read_at: string | null;
  created_at: string;
};

export type VendorCatalogRow = {
  slug: string;
  name: string;
  profile_name: string | null;
  logo_url: string | null;
  brief: string | null;
};
