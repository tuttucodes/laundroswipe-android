'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Bell, CircleHelp, FileText, Shirt, Sparkles, Flame, Zap, Footprints, type LucideIcon } from 'lucide-react';
import { SwipeToConfirm } from '@/components/SwipeToConfirm';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import {
  COLLEGES,
  SERVICES,
  VENDORS,
  STATUSES,
  customerFacingStatusLabel,
  customerFacingStatusClass,
  getScheduleDates,
  isEveningOnlyDate,
} from '@/lib/constants';
import { stripLeadingHashesFromToken } from '@/lib/vendor-bill-token';
import { LSApi } from '@/lib/api';
import type { UserRow, VendorBillRow, ScheduleSlotRow, ScheduleDateRow, UserNotificationRow, VendorProfileRow } from '@/lib/api';
import type { OrderRow } from '@/lib/api';
import { CURRENT_TERMS_VERSION } from '@/lib/terms';
import {
  SERVICE_FEE_SHORT_EXPLANATION,
  SERVICE_FEE_TERMS_EXPLANATION,
  formatServiceFeeReceiptLine,
  formatServiceFeeTiers,
} from '@/lib/fees';
import { ThermalReceipt } from '@/components/receipt/ThermalReceipt';
import { vendorBillRowToThermalReceiptData } from '@/lib/receipt/thermalReceiptTypes';
import { DigitalHandshake } from '@/components/user/DigitalHandshake';

const SERVICE_ICONS: Record<string, LucideIcon> = {
  wash_fold: Shirt,
  wash_iron: Shirt,
  dry_clean: Sparkles,
  iron_only: Flame,
  express: Zap,
  shoe_clean: Footprints,
};

/** UI vendor row: from static constants or from campus catalog API. */
type VendorForUi = {
  id: string;
  name: string;
  location?: string;
  emoji?: string;
  audienceLabel?: string;
  comingSoon?: boolean;
  /** If true, partner is only clickable when schedule has bookable slots (Star Wash). */
  bookOnlyWhenSlotsAvailable?: boolean;
  availability?: { type: 'nearby'; lat: number; lng: number; radiusKm: number };
};
const VIT_CHN_FALLBACK_VENDORS: VendorForUi[] = VENDORS.filter((vendor) => ['profab', 'starwash'].includes(vendor.id)).map((v) => ({ ...v }));

type Screen =
  | 'splash'
  | 'onboarding'
  | 'login'
  | 'signup'
  | 'student-signup'
  | 'complete-profile'
  | 'home'
  | 'schedule'
  | 'orders'
  | 'profile'
  | 'order-detail'
  | 'token-success'
  | 'my-bills'
  | 'coming-soon'
  | 'edit-profile'
  | 'notifications'
  | 'forgot-password'
  | 'set-password';

type User = {
  fn: string;
  em: string;
  ph?: string;
  wa?: string;
  ut: string;
  rn?: string;
  cid?: string;
  hos?: string;
  room?: string;
  yr?: number;
  sid: string;
  displayId?: string;
  termsAcceptedAt?: string | null;
  termsVersion?: string | null;
};

type Order = {
  id: string;
  on: string;
  tk: string;
  svc: string;
  sl: string;
  pd: string;
  ts: string;
  ins?: string;
  status: string;
  ca: string;
  deliveryConfirmedAt?: string | null;
  deliveryComments?: string | null;
};

type LatLng = { lat: number; lng: number };

type ScheduleData = {
  step: number;
  vendorId?: string;
  svc?: string;
  date?: string;
  ts?: string;
  ins?: string;
};

type DetailData = {
  oid?: string;
  college?: string;
};

type Toast = { msg: string; type: 'ok' | 'er' | null } | null;

const DEFAULT_VENDOR_PROFILE: VendorProfileRow = {
  id: '',
  slug: 'profab',
  name: 'Pro Fab Power Launders',
  brief: 'Pro Fab Power Launders is our campus laundry partner. We pick up from your hostel, wash & iron, and deliver back on the same cycle. Service days: Tuesday, Saturday, Sunday.',
  pricing_details: `Item-wise Price List

Pant - ₹22
Pant DC - ₹50
Jeans - ₹22
Jeans DC - ₹50
White Pant - ₹25
White Pant DC - ₹60
White Jeans - ₹25
White Jeans DC - ₹60
Shirt - ₹22
Shirt DC - ₹50
T-Shirt - ₹22
T-Shirt DC - ₹50
White Shirt - ₹25
White Shirt DC - ₹60
White T-Shirt - ₹25
White T-Shirt DC - ₹60
Shorts - ₹16
Shorts DC - ₹40
Lungi - ₹20
Lungi DC - ₹50
Towel - ₹18
Towel DC - ₹40
Bed Sheet - ₹25
Bed Sheet DC - ₹60
Hand Towel - ₹8
Hand Towel DC - ₹20
Pillow Cover - ₹12
Pillow Cover DC - ₹30
Dhoti - ₹40
Dhoti DC - ₹60
Blanket (Small) - ₹90
Blanket (Small) DC - ₹110
Blanket (Big) - ₹100
Blanket (Big) DC - ₹120
Lab Coat - ₹25
Lab Coat DC - ₹60
Quilt - ₹120
Quilt DC - ₹150
Jacket - ₹50
Jacket DC - ₹100
Hoodie - ₹50
Hoodie DC - ₹100
Kurta - ₹50
Kurta DC - ₹100
Track Pant - ₹22
Track Pant DC - ₹40
Bag - ₹150
Shoe - ₹70
Shoe DC - ₹150
Only Iron - ₹10
Ladies Top - ₹25
Ladies Top DC - ₹60
Ladies Bottom - ₹22
Ladies Bottom DC - ₹50
Shawl - ₹18
Shawl DC - ₹40
Saree - ₹70
Saree DC - ₹150
Fancy Dress DC - ₹100
Blazer DC - ₹150`,
  logo_url: '/profab-logo.png',
  updated_at: '',
};

const STAR_WASH_VENDOR_PROFILE: VendorProfileRow = {
  id: '',
  slug: 'starwash',
  name: 'Star Wash Power Launderers',
  brief: 'Star Wash serves VIT Chennai students in B, C, and E blocks with scheduled campus pickup and return.',
  pricing_details: 'Pricing is shared by the vendor at billing time. Service fee is added separately based on the final bill subtotal.',
  logo_url: null,
  updated_at: '',
};

function defaultVendorProfileFor(vendor: VendorForUi): VendorProfileRow {
  if (vendor.id === 'profab') return DEFAULT_VENDOR_PROFILE;
  if (vendor.id === 'starwash') return STAR_WASH_VENDOR_PROFILE;
  return {
    id: '',
    slug: vendor.id,
    name: vendor.name,
    brief: `${vendor.name} is a LaundroSwipe campus partner.`,
    pricing_details: 'See pricing in the app or on your bill.',
    logo_url: null,
    updated_at: '',
  };
}

function rowToUser(r: UserRow): User {
  return {
    fn: r.full_name ?? '',
    em: r.email ?? '',
    ph: r.phone ?? undefined,
    wa: r.whatsapp ?? undefined,
    ut: r.user_type ?? 'general',
    rn: r.reg_no ?? undefined,
    cid: r.college_id ?? undefined,
    hos: r.hostel_block ?? undefined,
    room: r.room_number ?? undefined,
    yr: r.year ?? undefined,
    sid: r.id,
    displayId: r.display_id ?? undefined,
    termsAcceptedAt: r.terms_accepted_at ?? null,
    termsVersion: r.terms_version ?? null,
  };
}

/** Bookable campus user: explicit student or a non-general college on profile. */
function isCampusCollegeStudent(u: Pick<User, 'ut' | 'cid'> | null): boolean {
  if (!u) return false;
  if ((u.ut ?? '').toLowerCase() === 'student') return true;
  const cid = (u.cid ?? '').trim();
  return Boolean(cid && cid !== 'general');
}

function needsStudentCollegeChoice(u: User | null): boolean {
  if (!u) return false;
  if ((u.ut ?? '').toLowerCase() !== 'student') return false;
  const cid = (u.cid ?? '').trim();
  return !cid || cid === 'general';
}

function needsStudentHostelDetails(u: User | null): boolean {
  if (!u || !isCampusCollegeStudent(u)) return false;
  if (needsStudentCollegeChoice(u)) return true;
  if (!(u.rn ?? '').trim()) return true;
  if (!(u.hos ?? '').trim()) return true;
  if (!(u.room ?? '').trim()) return true;
  return false;
}

function rowToOrder(r: OrderRow): Order {
  return {
    id: r.id,
    on: r.order_number,
    tk: r.token,
    deliveryConfirmedAt: r.delivery_confirmed_at ?? undefined,
    deliveryComments: r.delivery_comments ?? undefined,
    svc: r.service_id,
    sl: r.service_name,
    pd: r.pickup_date,
    ts: r.time_slot,
    ins: r.instructions ?? undefined,
    status: r.status,
    ca: r.created_at,
  };
}

function orderTokenKey(tk: string): string {
  return stripLeadingHashesFromToken(tk).toLowerCase();
}

/** One visible row per token: prefer bill.order_id, else furthest status, else newest created_at. */
function billMapAndVisibleOrderIds(orders: Order[], bills: VendorBillRow[]) {
  const billByToken = new Map<string, VendorBillRow>();
  for (const b of bills) {
    const k = orderTokenKey(b.order_token);
    if (!billByToken.has(k)) billByToken.set(k, b);
  }
  const byKey = new Map<string, Order[]>();
  for (const o of orders) {
    const k = orderTokenKey(o.tk);
    const arr = byKey.get(k) ?? [];
    arr.push(o);
    byKey.set(k, arr);
  }
  const visible = new Set<string>();
  const rank = (s: string) => {
    const i = STATUSES.indexOf(s as (typeof STATUSES)[number]);
    return i >= 0 ? i : -1;
  };
  for (const list of byKey.values()) {
    if (list.length === 1) {
      visible.add(list[0].id);
      continue;
    }
    const k = orderTokenKey(list[0].tk);
    const bill = billByToken.get(k);
    let pick: Order | undefined;
    if (bill?.order_id) pick = list.find((o) => o.id === bill.order_id);
    if (!pick) {
      pick = [...list].sort((a, b) => {
        const dr = rank(b.status) - rank(a.status);
        if (dr !== 0) return dr;
        return String(b.ca).localeCompare(String(a.ca));
      })[0];
    }
    visible.add(pick.id);
  }
  return { billByOrderToken: billByToken, visibleOrderIds: visible };
}

const TIME_SLOTS = [
  { id: 'afternoon', label: 'Afternoon (12–4 PM)', emoji: '☀️' },
  { id: 'evening', label: 'Evening (4:45–5:45 PM)', emoji: '🌆' },
];

function formatScheduleDay(full: string): { date: Date; day: string; num: number; month: string; ok: boolean; full: string } {
  const d = new Date(full + 'T12:00:00');
  const dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return {
    date: d,
    day: dn[d.getDay()],
    num: d.getDate(),
    month: mn[d.getMonth()],
    ok: true,
    full,
  };
}


function validateIndianPhone(value: string): { valid: boolean; message?: string } {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return { valid: true };
  if (digits.length === 11 && digits.startsWith('0')) return { valid: true };
  if (digits.length === 12 && digits.startsWith('91')) return { valid: true };
  return { valid: false, message: 'Enter a valid 10-digit mobile number' };
}

export default function LaundroApp() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sd, setSd] = useState<ScheduleData>({ step: 1 });
  const [dd, setDd] = useState<DetailData>({});
  const [obSlide, setObSlide] = useState<0 | 1 | 2>(0);
  const [toast, setToast] = useState<Toast>(null);

  // Form state for auth
  const [loginEm, setLoginEm] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [signupFn, setSignupFn] = useState('');
  const [signupEm, setSignupEm] = useState('');
  const [signupPh, setSignupPh] = useState('');
  const [signupWa, setSignupWa] = useState('');
  const [signupPw, setSignupPw] = useState('');
  const [studentRn, setStudentRn] = useState('');
  const [studentCid, setStudentCid] = useState('');
  const [studentHos, setStudentHos] = useState('');
  const [studentRm, setStudentRm] = useState('');
  const [studentYr, setStudentYr] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [signupPhErr, setSignupPhErr] = useState('');
  const [signupWaErr, setSignupWaErr] = useState('');
  const [forgotEm, setForgotEm] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [deliveryComments, setDeliveryComments] = useState('');
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [myBills, setMyBills] = useState<VendorBillRow[]>([]);
  const [myBillsLoading, setMyBillsLoading] = useState(false);
  const [myBillsError, setMyBillsError] = useState('');
  const [viewingBill, setViewingBill] = useState<VendorBillRow | null>(null);
  const [profilePw, setProfilePw] = useState('');
  const [profilePwConfirm, setProfilePwConfirm] = useState('');
  const [profilePwSaving, setProfilePwSaving] = useState(false);
  const [editFn, setEditFn] = useState('');
  const [editPh, setEditPh] = useState('');
  const [editWa, setEditWa] = useState('');
  const [editCid, setEditCid] = useState('general');
  const [editRn, setEditRn] = useState('');
  const [editHos, setEditHos] = useState('');
  const [editRm, setEditRm] = useState('');
  const [editYr, setEditYr] = useState('');
  const [editPhErr, setEditPhErr] = useState('');
  const [editWaErr, setEditWaErr] = useState('');
  const [editProfileSaving, setEditProfileSaving] = useState(false);
  const [notifications, setNotifications] = useState<UserNotificationRow[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlotRow[]>([]);
  const [scheduleDates, setScheduleDates] = useState<ScheduleDateRow[]>([]);
  const [passwordAlreadySet, setPasswordAlreadySet] = useState(false);
  const [vendorProfilesBySlug, setVendorProfilesBySlug] = useState<Record<string, VendorProfileRow>>({});
  const [viewingVendor, setViewingVendor] = useState<VendorProfileRow | null>(null);
  const [ordersListLoading, setOrdersListLoading] = useState(false);
  /** Active vendor bills for the signed-in user; used on Home / Orders to show bill-ready state and dedupe tokens. */
  const [userOrderBills, setUserOrderBills] = useState<VendorBillRow[]>([]);
  const [geo, setGeo] = useState<{ status: 'idle' | 'loading' | 'ok' | 'denied' | 'error'; coords?: LatLng }>({ status: 'idle' });
  const [pickupLocation, setPickupLocation] = useState('vit-chn');
  const [homeVendors, setHomeVendors] = useState<VendorForUi[]>(() => [...VIT_CHN_FALLBACK_VENDORS]);
  const [otherAreaRequest, setOtherAreaRequest] = useState('');
  const [areaRequestSaving, setAreaRequestSaving] = useState(false);
  const [areaRequestCaptchaToken, setAreaRequestCaptchaToken] = useState('');
  const [showStudentDetailsModal, setShowStudentDetailsModal] = useState(false);
  const [studentModalSaving, setStudentModalSaving] = useState(false);
  const [modalRn, setModalRn] = useState('');
  const [modalBlk, setModalBlk] = useState('');
  const [modalRm, setModalRm] = useState('');
  const [modalCid, setModalCid] = useState('');
  const profileSheetSyncedSidRef = useRef<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsSaving, setTermsSaving] = useState(false);
  const [showServiceFeeInfo, setShowServiceFeeInfo] = useState(false);

  useEffect(() => {
    if (user?.sid && typeof window !== 'undefined' && localStorage.getItem('ls_password_set_' + user.sid) === '1') {
      setPasswordAlreadySet(true);
    }
  }, [user?.sid]);

  const go = useCallback((s: Screen, detail?: DetailData) => {
    setScreen(s);
    if (detail) setDd(detail);
  }, []);

  const showToast = useCallback((msg: string, type: 'ok' | 'er' | null = null) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const hasAcceptedLatestTerms = useMemo(
    () => !!user?.termsAcceptedAt && user?.termsVersion === CURRENT_TERMS_VERSION,
    [user]
  );

  const effectiveCampusId = useMemo(() => {
    const c = user?.cid;
    if (c && c !== 'general' && COLLEGES.some((col) => col.id === c)) return c;
    if (pickupLocation && COLLEGES.some((col) => col.id === pickupLocation)) return pickupLocation;
    return 'vit-chn';
  }, [user?.cid, pickupLocation]);

  useEffect(() => {
    if (!LSApi.hasSupabase) return;
    let cancelled = false;
    (async () => {
      const rows = await LSApi.fetchVendorCatalog(effectiveCampusId);
      if (cancelled) return;
      if (rows && rows.length > 0) {
        setHomeVendors(
          rows.map((row) => {
            const meta = VENDORS.find((v) => v.id === row.slug);
            if (meta) return { ...meta };
            return {
              id: row.slug,
              name: row.name,
              location: 'On campus',
              emoji: '🧺',
              audienceLabel: 'Campus laundry partner',
            };
          }),
        );
      } else if (effectiveCampusId === 'vit-chn') {
        setHomeVendors([...VIT_CHN_FALLBACK_VENDORS]);
      } else {
        setHomeVendors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveCampusId]);

  const goToSchedule = useCallback(() => {
    if (user && !user.ph?.trim()) {
      go('complete-profile');
      showToast('Add your phone number to place orders', 'er');
      return;
    }
    if (user && needsStudentHostelDetails(user)) {
      setShowStudentDetailsModal(true);
      showToast('Add your registration number, hostel block, and room number to continue', 'er');
      return;
    }
    setSd({ step: 0 });
    go('schedule');
  }, [user, go, showToast]);

  const goToScheduleWithService = useCallback((serviceId: string) => {
    if (user && !user.ph?.trim()) {
      go('complete-profile');
      showToast('Add your phone number to place orders', 'er');
      return;
    }
    if (user && needsStudentHostelDetails(user)) {
      setShowStudentDetailsModal(true);
      showToast('Add your registration number, hostel block, and room number to continue', 'er');
      return;
    }
    setSd({ step: 0, svc: serviceId });
    go('schedule');
  }, [user, go, showToast]);

  const goToScheduleWithVendor = useCallback((vendorId: string) => {
    if (user && !user.ph?.trim()) {
      go('complete-profile');
      showToast('Add your phone number to place orders', 'er');
      return;
    }
    if (user && needsStudentHostelDetails(user)) {
      setShowStudentDetailsModal(true);
      showToast('Add your registration number, hostel block, and room number to continue', 'er');
      return;
    }
    setSd({ step: 1, vendorId });
    go('schedule');
  }, [user, go, showToast]);

  const handleOtherAreaRequest = useCallback(async () => {
    const text = otherAreaRequest.trim();
    if (!text) {
      showToast('Enter your area details', 'er');
      return;
    }
    if (areaRequestSaving) return;

    setAreaRequestSaving(true);
    try {
      const res = await fetch('/api/location-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationText: text,
          lat: geo.coords?.lat ?? null,
          lng: geo.coords?.lng ?? null,
          contactEmail: user?.em ?? null,
          source: 'app_schedule_other',
          captchaToken: areaRequestCaptchaToken || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok !== true) {
        showToast(data?.error || 'Request failed', 'er');
        return;
      }
      setOtherAreaRequest('');
      showToast('Thanks! Area request received.', 'ok');
    } catch {
      showToast('Request failed', 'er');
    } finally {
      setAreaRequestSaving(false);
    }
  }, [otherAreaRequest, areaRequestSaving, geo.coords, user?.em, areaRequestCaptchaToken, showToast]);

  const haversineKm = useCallback((a: LatLng, b: LatLng) => {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLng / 2);
    const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }, []);

  useEffect(() => {
    // Only ask for location when user is in the booking flow surfaces.
    if (!user) return;
    if (!['home', 'schedule'].includes(screen)) return;
    if (geo.status !== 'idle') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeo({ status: 'error' });
      return;
    }
    setGeo({ status: 'loading' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          status: 'ok',
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        });
      },
      (err) => {
        if (err?.code === 1) setGeo({ status: 'denied' });
        else setGeo({ status: 'error' });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  }, [geo.status, screen, user]);

  useEffect(() => {
    if (pickupLocation) return;
    if (geo.status !== 'ok' || !geo.coords) return;
    // Chennai area auto-suggestion.
    if (geo.coords.lat > 12.7 && geo.coords.lat < 13.3 && geo.coords.lng > 79.9 && geo.coords.lng < 80.4) {
      setPickupLocation('vit-chn');
    }
  }, [geo, pickupLocation]);

  const saveUser = useCallback((u: User | null) => {
    if (u) localStorage.setItem('ls_u', JSON.stringify(u));
    else localStorage.removeItem('ls_u');
  }, []);

  const handleAcceptLatestTerms = useCallback(async () => {
    if (!termsChecked) {
      showToast('Please agree to the Terms & Conditions', 'er');
      return;
    }
    setTermsSaving(true);
    try {
      const { user: updatedUser, error } = await LSApi.acceptLatestTerms();
      if (!updatedUser) {
        showToast(error ?? 'Could not save terms acceptance', 'er');
        return;
      }
      const mappedUser = rowToUser(updatedUser);
      setUser(mappedUser);
      saveUser(mappedUser);
      setShowTermsModal(false);
      setTermsChecked(false);
      showToast('Terms accepted. You can place your order now.', 'ok');
    } finally {
      setTermsSaving(false);
    }
  }, [termsChecked, saveUser, showToast]);

  const saveO = useCallback((o: Order[]) => {
    localStorage.setItem('ls_o', JSON.stringify(o));
  }, []);

  const genTk = useCallback(() => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const alphaNum = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const rand = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
    let token = rand(letters);
    for (let i = 1; i < 4; i += 1) token += rand(alphaNum);
    return token;
  }, []);

  const genOid = useCallback(() => {
    const uuid =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const short = String(uuid).replace(/-/g, '').slice(0, 10).toUpperCase();
    return `ON-${short}`;
  }, []);

  useEffect(() => {
    let mounted = true;
    const lsOb = typeof window !== 'undefined' ? localStorage.getItem('ls_ob') : null;
    const lsU = typeof window !== 'undefined' ? localStorage.getItem('ls_u') : null;
    const lsO = typeof window !== 'undefined' ? localStorage.getItem('ls_o') : null;
    let restoredUser: User | null = null;
    let restoredOrders: Order[] = [];
    try {
      if (lsU) restoredUser = JSON.parse(lsU) as User;
      if (lsO) restoredOrders = JSON.parse(lsO) as Order[];
    } catch (_) {}
    setUser(restoredUser);
    setOrders(restoredOrders);

    const hasAuthHash = typeof window !== 'undefined' && !!window.location.hash && /access_token|refresh_token/.test(window.location.hash);
    const t = setTimeout(() => {
      if (!mounted) return;
      if (screen === 'splash') {
        if (restoredUser) setScreen('home');
        else if (hasAuthHash) { /* stay on splash; init() will set complete-profile or home */ }
        else setScreen(lsOb ? 'login' : 'onboarding');
      }
    }, 900);

    async function tryApplySession(session: { user: unknown } | null) {
      if (!mounted || !session?.user) return false;
      let profile = await LSApi.upsertUserFromAuth(session.user as { id: string; email?: string | null; user_metadata?: { full_name?: string; name?: string } });
      if (!profile) return false;
      if (!profile.phone?.trim()) {
        const refetched = await LSApi.fetchUserById(profile.id);
        if (refetched?.phone?.trim()) profile = refetched;
      }
      const u = rowToUser(profile);
      setUser(u);
      saveUser(u);
      const ords = await LSApi.fetchOrdersForUser(profile.id);
      if (mounted && ords) {
        const mapped = ords.map(rowToOrder);
        setOrders(mapped);
        saveO(mapped);
      }
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      const needsProfile = !profile.phone?.trim();
      if (needsProfile) {
        setSignupPh(profile.phone ?? '');
        setSignupWa(profile.whatsapp ?? '');
        setStudentCid(profile.college_id ?? 'general');
        setStudentRn(profile.reg_no ?? '');
        setStudentHos(profile.hostel_block ?? '');
        setStudentRm(profile.room_number ?? '');
        setStudentYr(profile.year != null ? String(profile.year) : '');
        setScreen('complete-profile');
        showToast('Complete your profile', 'ok');
      } else {
        setScreen('home');
        showToast('Signed in with Google!', 'ok');
      }
      return true;
    }

    async function init() {
      let session = await LSApi.getAuthSession();
      if (!mounted) return;
      if (session?.user) {
        const isRecovery = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash || '');
        if (isRecovery) {
          setScreen('set-password');
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
          return;
        }
        await tryApplySession(session);
        return;
      }
      // After OAuth redirect, tokens can be in the URL hash; Supabase may need a moment to process.
      const hasHash = typeof window !== 'undefined' && window.location.hash && /access_token|refresh_token/.test(window.location.hash);
      if (hasHash) {
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 200));
          if (!mounted) return;
          session = await LSApi.getAuthSession();
          if (session?.user) {
            const isRecovery = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash || '');
            if (isRecovery) {
              setScreen('set-password');
              if (typeof window !== 'undefined' && window.history?.replaceState) {
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
              }
              return;
            }
            const applied = await tryApplySession(session);
            if (applied) return;
          }
        }
      }
      if (LSApi.hasSupabase && restoredUser?.sid) {
        const ords = await LSApi.fetchOrdersForUser(restoredUser.sid);
        if (mounted && ords) {
          const mapped = ords.map(rowToOrder);
          setOrders(mapped);
          saveO(mapped);
        }
        if (mounted && restoredUser) setScreen('home');
      } else if (restoredUser) {
        setScreen('home');
      }
    }
    init();
    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (user) saveUser(user);
  }, [user, saveUser]);
  useEffect(() => {
    saveO(orders);
  }, [orders, saveO]);

  useEffect(() => {
    if (!user?.sid || !LSApi.hasSupabase) return;
    if (screen !== 'my-bills' && screen !== 'profile') return;
    const showMyBillsSpinner = screen === 'my-bills';
    setMyBillsError('');
    if (showMyBillsSpinner) setMyBillsLoading(true);
    LSApi.fetchVendorBillsForUser(user.sid)
      .then((data) => {
        if (data === null) {
          setMyBills([]);
          setMyBillsError('Could not load your bills right now. Please try again.');
          return;
        }
        setMyBills(data);
      })
      .finally(() => {
        if (showMyBillsSpinner) setMyBillsLoading(false);
      });
  }, [screen, user?.sid]);

  // Refetch orders when user views Orders or order-detail so vendor status updates (picked_up, delivered) show
  useEffect(() => {
    if ((screen === 'orders' || screen === 'order-detail') && user?.sid) {
      setOrdersListLoading(true);
      LSApi.fetchOrdersForUser(user.sid).then((ords) => {
        if (ords && ords.length >= 0) {
          const mapped = ords.map(rowToOrder);
          setOrders(mapped);
          saveO(mapped);
        }
      }).finally(() => setOrdersListLoading(false));
    }
  }, [screen, user?.sid, saveO]);

  // Bills on Home / Orders / Order detail / Profile so list badges and My bills prefetch stay in sync
  useEffect(() => {
    if (!user?.sid || !LSApi.hasSupabase) return;
    if (!['home', 'orders', 'order-detail', 'profile'].includes(screen)) return;
    LSApi.fetchVendorBillsForUser(user.sid).then((rows) => setUserOrderBills(rows ?? []));
  }, [user?.sid, screen]);

  const { billByOrderToken, visibleOrderIds } = useMemo(
    () => billMapAndVisibleOrderIds(orders, userOrderBills),
    [orders, userOrderBills],
  );

  const visibleOrdersSorted = useMemo(
    () =>
      orders
        .filter((o) => visibleOrderIds.has(o.id))
        .slice()
        .sort((a, b) => String(b.ca).localeCompare(String(a.ca))),
    [orders, visibleOrderIds],
  );

  // Load schedule on home + schedule so Star Wash (slot-gated) and dates step stay accurate.
  useEffect(() => {
    if (!['home', 'schedule'].includes(screen) || !LSApi.hasSupabase) return;
    const refreshSchedule = () => {
      Promise.all([LSApi.fetchScheduleSlots(), LSApi.fetchScheduleDates()]).then(([slots, dates]) => {
        setScheduleSlots(slots ?? []);
        setScheduleDates(dates ?? []);
      });
    };
    refreshSchedule();
    const onFocus = () => refreshSchedule();
    if (typeof window !== 'undefined') window.addEventListener('focus', onFocus);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus);
    };
  }, [screen]);

  const profileForVendor = useCallback((vendor: VendorForUi): VendorProfileRow => {
    return vendorProfilesBySlug[vendor.id] ?? defaultVendorProfileFor(vendor);
  }, [vendorProfilesBySlug]);

  const normalizeScheduleIdForVendor = useCallback((id: string, vendorId?: string) => {
    const raw = String(id ?? '').trim();
    if (!raw) return null;
    const marker = raw.indexOf('__');
    if (marker < 0) return raw; // legacy/global slot id
    const scopedVendor = raw.slice(0, marker);
    const localId = raw.slice(marker + 2);
    if (!scopedVendor || !localId) return null;
    if (!vendorId) return null;
    return scopedVendor === vendorId ? localId : null;
  }, []);

  const slotIdsForDateByVendor = useCallback((date: string, vendorId?: string) => {
    const row = scheduleDates.find((d) => d.date === date);
    if (!row) return [] as string[];
    const normalized = (Array.isArray(row.slot_ids) ? row.slot_ids : [])
      .map((id) => normalizeScheduleIdForVendor(id, vendorId))
      .filter((id): id is string => !!id);
    return Array.from(new Set(normalized));
  }, [normalizeScheduleIdForVendor, scheduleDates]);

  const isDateEnabledForVendor = useCallback((date: string, vendorId?: string) => {
    const row = scheduleDates.find((d) => d.date === date);
    if (!row) return false;
    if (!vendorId) return Boolean(row.enabled);
    const vendorEnabledMap = row.enabled_by_vendor;
    if (vendorEnabledMap && typeof vendorEnabledMap === 'object') {
      if (typeof vendorEnabledMap[vendorId] === 'boolean') {
        return Boolean(vendorEnabledMap[vendorId]);
      }
      // If vendor-scoped map exists and this vendor has no explicit entry, treat as disabled.
      if (Object.keys(vendorEnabledMap).length > 0) return false;
    }
    return Boolean(row.enabled);
  }, [scheduleDates]);

  const vendorHasBookableSlots = useCallback(
    (vendorId: string) => {
      if (scheduleDates.length === 0) return false;
      const activeSlotIds = new Set(scheduleSlots.filter((s) => s.active).map((s) => s.id));
      const todayStr = new Date().toISOString().split('T')[0];
      return scheduleDates.some((d) => {
        if (d.date < todayStr) return false;
        if (!isDateEnabledForVendor(d.date, vendorId)) return false;
        const ids = slotIdsForDateByVendor(d.date, vendorId);
        if (ids.length === 0) return false;
        if (activeSlotIds.size === 0) return true;
        return ids.some((id) => activeSlotIds.has(id));
      });
    },
    [scheduleDates, scheduleSlots, isDateEnabledForVendor, slotIdsForDateByVendor],
  );

  const isVendorAvailable = useCallback(
    (vendor: VendorForUi) => {
      if (vendor.comingSoon) return { ok: false, reason: 'Coming soon' };
      if (vendor.bookOnlyWhenSlotsAvailable && !vendorHasBookableSlots(vendor.id)) {
        return { ok: false, reason: 'No slots available right now' };
      }
      const availability = vendor.availability;
      if (!availability) return { ok: true, reason: '' };
      if (availability.type === 'nearby') {
        // VIT Chennai booking should not be blocked by location permission.
        if (pickupLocation === 'vit-chn') return { ok: true, reason: '' };
        if (!geo.coords) return { ok: false, reason: 'Enable location to check availability' };
        const d = haversineKm(geo.coords, { lat: availability.lat, lng: availability.lng });
        return d <= availability.radiusKm ? { ok: true, reason: '' } : { ok: false, reason: 'Not available in your region' };
      }
      return { ok: true, reason: '' };
    },
    [geo.coords, haversineKm, pickupLocation, vendorHasBookableSlots],
  );

  // Load vendor profiles when user is on home (refetch when entering home so admin updates show)
  useEffect(() => {
    if (screen !== 'home' || !LSApi.hasSupabase) return;
    const slugs = homeVendors.map((v) => v.id);
    if (slugs.length === 0) return;
    Promise.all(
      slugs.map(async (id) => {
        const p = await LSApi.fetchVendorProfile(id);
        return { slug: id, profile: p };
      }),
    ).then((rows) => {
      const next: Record<string, VendorProfileRow> = {};
      rows.forEach(({ slug, profile }) => {
        if (profile) next[slug] = profile;
      });
      setVendorProfilesBySlug(next);
    });
  }, [screen, homeVendors]);

  // Once logged in, never show login again — redirect to home
  useEffect(() => {
    if (screen === 'login' && user) go('home');
  }, [screen, user, go]);

  // Prefill edit profile form when opening
  useEffect(() => {
    if (screen === 'edit-profile' && user) {
      setEditFn(user.fn ?? '');
      setEditPh(user.ph ?? '');
      setEditWa(user.wa ?? '');
      setEditCid(user.cid ?? 'general');
      setEditRn(user.rn ?? '');
      setEditHos(user.hos ?? '');
      setEditRm(user.room ?? '');
      setEditYr(user.yr != null ? String(user.yr) : '');
      setEditPhErr('');
      setEditWaErr('');
    }
  }, [screen, user]);

  // Load notifications when opening notifications screen; sync header badge with fetched list
  useEffect(() => {
    if (screen !== 'notifications' || !LSApi.hasSupabase) return;
    setNotificationsLoading(true);
    LSApi.fetchNotifications()
      .then((list) => {
        if (list) {
          setNotifications(list);
          setUnreadNotificationCount(list.filter((n) => !n.read_at).length);
        } else {
          setNotifications([]);
          setUnreadNotificationCount(0);
        }
      })
      .finally(() => setNotificationsLoading(false));
  }, [screen]);

  // Fetch unread count for header badge when user is on main screens
  useEffect(() => {
    if (!user?.sid || !LSApi.hasSupabase || !['home', 'schedule', 'orders', 'profile', 'order-detail', 'my-bills'].includes(screen)) return;
    LSApi.fetchNotifications()
      .then((list) => {
        if (list) setUnreadNotificationCount(list.filter((n) => !n.read_at).length);
        else setUnreadNotificationCount(0);
      })
      .catch(() => setUnreadNotificationCount(0));
  }, [user?.sid, screen]);

  useEffect(() => {
    if (!user?.sid) {
      profileSheetSyncedSidRef.current = null;
    }
  }, [user?.sid]);

  const MAIN_SHELL_SCREENS = ['home', 'schedule', 'orders', 'profile', 'order-detail', 'my-bills'] as const;
  useEffect(() => {
    const onMain = MAIN_SHELL_SCREENS.includes(screen as (typeof MAIN_SHELL_SCREENS)[number]);
    if (!onMain || !user?.sid || !LSApi.hasSupabase) return;
    if (profileSheetSyncedSidRef.current === user.sid) return;
    profileSheetSyncedSidRef.current = user.sid;
    LSApi.fetchUserById(user.sid).then((row) => {
      if (!row) return;
      const fresh = rowToUser(row);
      setUser(fresh);
      saveUser(fresh);
      if (needsStudentHostelDetails(fresh)) setShowStudentDetailsModal(true);
    });
  }, [screen, user?.sid, saveUser]);

  useEffect(() => {
    if (!showStudentDetailsModal || !user) return;
    setModalRn((user.rn ?? '').trim());
    setModalBlk((user.hos ?? '').trim());
    setModalRm((user.room ?? '').trim());
    const cid = (user.cid ?? '').trim();
    setModalCid(cid && cid !== 'general' ? cid : '');
  }, [showStudentDetailsModal, user]);

  const handleObNext = () => {
    if (obSlide < 2) setObSlide((obSlide + 1) as 0 | 1 | 2);
    else {
      if (typeof window !== 'undefined') localStorage.setItem('ls_ob', '1');
      setScreen('login');
    }
  };
  const handleObSkip = () => {
    if (typeof window !== 'undefined') localStorage.setItem('ls_ob', '1');
    setScreen('login');
  };

  const handleLoginEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEm.trim()) {
      showToast('Enter your email', 'er');
      return;
    }
    if (!loginPw) {
      showToast('Enter your password', 'er');
      return;
    }
    if (!LSApi.hasSupabase) {
      showToast('Service unavailable. Please try again later.', 'er');
      return;
    }
    setAuthLoading(true);
    try {
      const { user: profile, error } = await LSApi.signInWithPassword(loginEm.trim(), loginPw);
      if (profile) {
        const u = rowToUser(profile);
        setUser(u);
        saveUser(u);
        const ords = await LSApi.fetchOrdersForUser(profile.id);
        if (ords) {
          const mapped = ords.map(rowToOrder);
          setOrders(mapped);
          saveO(mapped);
        }
        go('home');
        showToast('Welcome back!', 'ok');
      } else {
        showToast(error || 'Invalid email or password', 'er');
      }
    } catch (_) {
      showToast('Login failed', 'er');
    }
    setAuthLoading(false);
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    const { error } = await LSApi.signInWithGoogle();
    if (error) {
      showToast(error.message || 'Google sign-in failed', 'er');
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = forgotEm.trim();
    if (!email) {
      showToast('Enter your email', 'er');
      return;
    }
    if (!LSApi.hasSupabase) {
      showToast('Service unavailable.', 'er');
      return;
    }
    setAuthLoading(true);
    const { error } = await LSApi.resetPasswordForEmail(email);
    setAuthLoading(false);
    if (error) {
      showToast(error, 'er');
      return;
    }
    setResetSent(true);
    showToast('Check your email for a reset link', 'ok');
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'er');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      showToast('Passwords do not match', 'er');
      return;
    }
    if (!LSApi.hasSupabase) {
      showToast('Service unavailable.', 'er');
      return;
    }
    setAuthLoading(true);
    const { error } = await LSApi.updatePassword(newPassword);
    setAuthLoading(false);
    if (error) {
      showToast(error, 'er');
      return;
    }
    showToast('Password updated. Signing you in…', 'ok');
    const session = await LSApi.getAuthSession();
    if (session?.user) {
      let profile = await LSApi.upsertUserFromAuth(session.user as { id: string; email?: string | null; user_metadata?: { full_name?: string; name?: string } });
      if (profile && !profile.phone?.trim()) {
        const refetched = await LSApi.fetchUserById(profile.id);
        if (refetched?.phone?.trim()) profile = refetched;
      }
      if (profile) {
        const u = rowToUser(profile);
        setUser(u);
        saveUser(u);
        const needsProfile = !profile.phone?.trim();
        if (needsProfile) {
          setSignupPh(profile.phone ?? '');
          setSignupWa(profile.whatsapp ?? '');
          setStudentCid(profile.college_id ?? 'general');
          setStudentRn(profile.reg_no ?? '');
          setStudentHos(profile.hostel_block ?? '');
          setStudentRm(profile.room_number ?? '');
          setStudentYr(profile.year != null ? String(profile.year) : '');
          setScreen('complete-profile');
        } else {
          setScreen('home');
        }
      } else {
        setScreen('login');
      }
    } else {
      setScreen('login');
    }
  };

  const handleSaveStudentDetailsModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.sid) return;
    const effectiveCid =
      modalCid.trim() && modalCid.trim() !== 'general'
        ? modalCid.trim()
        : (user.cid ?? '').trim() && (user.cid ?? '').trim() !== 'general'
          ? (user.cid ?? '').trim()
          : null;
    if (needsStudentCollegeChoice(user)) {
      if (!modalCid.trim() || modalCid.trim() === 'general') {
        showToast('Select your college', 'er');
        return;
      }
    }
    if (!effectiveCid) {
      showToast('Select your college', 'er');
      return;
    }
    if (!modalRn.trim() || !modalBlk.trim() || !modalRm.trim()) {
      showToast('Enter registration number, hostel block, and room number', 'er');
      return;
    }
    setStudentModalSaving(true);
    try {
      const { user: updated, error } = await LSApi.updateUser(user.sid, {
        user_type: 'student',
        college_id: effectiveCid,
        reg_no: modalRn.trim(),
        hostel_block: modalBlk.trim(),
        room_number: modalRm.trim(),
      });
      if (updated) {
        const u = rowToUser(updated);
        setUser(u);
        saveUser(u);
        setShowStudentDetailsModal(false);
        showToast('Details saved', 'ok');
      } else {
        showToast(error || 'Update failed', 'er');
      }
    } catch {
      showToast('Update failed', 'er');
    }
    setStudentModalSaving(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupPhErr('');
    setSignupWaErr('');
    const phCheck = validateIndianPhone(signupPh.trim());
    const waCheck = validateIndianPhone(signupWa.trim());
    if (!phCheck.valid) {
      setSignupPhErr(phCheck.message || 'Invalid phone');
      return;
    }
    if (!waCheck.valid) {
      setSignupWaErr(waCheck.message || 'Invalid WhatsApp');
      return;
    }
    if (!signupFn.trim() || !signupEm.trim()) {
      showToast('Fill all required fields', 'er');
      return;
    }
    if (!signupPw || signupPw.length < 6) {
      showToast('Please enter a password (at least 6 characters) to sign in with email later', 'er');
      return;
    }
    const isGeneral = !studentCid || studentCid === 'general';
    if (!isGeneral && !studentRn.trim()) {
      showToast('Registration number required for students', 'er');
      return;
    }
    if (!isGeneral && (!studentHos.trim() || !studentRm.trim())) {
      showToast('Hostel block and room number are required for students', 'er');
      return;
    }
    setAuthLoading(true);
    try {
      const { user: row, error } = await LSApi.signUpWithEmail(
        signupEm.trim(),
        signupPw,
        {
          full_name: signupFn.trim(),
          phone: signupPh.trim(),
          whatsapp: signupWa.trim(),
          user_type: isGeneral ? 'general' : 'student',
          college_id: isGeneral ? null : studentCid,
          reg_no: isGeneral ? null : studentRn.trim() || null,
          hostel_block: isGeneral ? null : studentHos.trim() || null,
          room_number: isGeneral ? null : studentRm.trim() || null,
          year: studentYr?.trim() ? parseInt(studentYr, 10) || null : null,
        }
      );
      if (row) {
        const u = rowToUser(row);
        setUser(u);
        saveUser(u);
        const ords = await LSApi.fetchOrdersForUser(row.id);
        if (ords) {
          const mapped = ords.map(rowToOrder);
          setOrders(mapped);
          saveO(mapped);
        }
        go('home');
        showToast('Account created. You can sign in with email + password anytime.', 'ok');
      } else {
        showToast(error || 'Sign up failed', 'er');
      }
    } catch (_) {
      showToast('Sign up failed', 'er');
    }
    setAuthLoading(false);
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupPhErr('');
    setSignupWaErr('');
    const phCheck = validateIndianPhone(signupPh.trim());
    const waCheck = validateIndianPhone(signupWa.trim());
    if (!phCheck.valid) {
      setSignupPhErr(phCheck.message || 'Invalid phone');
      return;
    }
    if (!waCheck.valid) {
      setSignupWaErr(waCheck.message || 'Invalid WhatsApp');
      return;
    }
    if (!user?.sid) return;
    const isGeneral = !studentCid || studentCid === 'general';
    if (!isGeneral && !studentRn.trim()) {
      showToast('Registration number required for students', 'er');
      return;
    }
    if (!isGeneral && (!studentHos.trim() || !studentRm.trim())) {
      showToast('Hostel block and room number are required for students', 'er');
      return;
    }
    setAuthLoading(true);
    try {
      const yearNum = studentYr?.trim() ? parseInt(studentYr, 10) : null;
      const { user: updated, error } = await LSApi.updateUser(user.sid, {
        phone: signupPh.trim(),
        whatsapp: signupWa.trim(),
        user_type: isGeneral ? 'general' : 'student',
        college_id: isGeneral ? null : studentCid,
        reg_no: isGeneral ? null : studentRn.trim() || null,
        hostel_block: isGeneral ? null : studentHos.trim() || null,
        room_number: isGeneral ? null : studentRm.trim() || null,
        year: yearNum != null && !Number.isNaN(yearNum) ? yearNum : null,
      });
      if (updated) {
        const u = rowToUser(updated);
        setUser(u);
        saveUser(u);
        go('home');
        showToast('Profile complete', 'ok');
      } else {
        showToast(error || 'Update failed', 'er');
      }
    } catch (_) {
      showToast('Update failed', 'er');
    }
    setAuthLoading(false);
  };

  const handleSaveEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditPhErr('');
    setEditWaErr('');
    const phCheck = validateIndianPhone(editPh.trim());
    const waCheck = validateIndianPhone(editWa.trim());
    if (!phCheck.valid) {
      setEditPhErr(phCheck.message ?? 'Invalid phone');
      return;
    }
    if (!waCheck.valid) {
      setEditWaErr(waCheck.message ?? 'Invalid WhatsApp');
      return;
    }
    if (!user?.sid) return;
    const isGeneral = !editCid || editCid === 'general';
    if (!isGeneral && !editRn.trim()) {
      showToast('Registration number required for students', 'er');
      return;
    }
    if (!isGeneral && (!editHos.trim() || !editRm.trim())) {
      showToast('Hostel block and room number are required for students', 'er');
      return;
    }
    setEditProfileSaving(true);
    try {
      const yearNum = editYr?.trim() ? parseInt(editYr, 10) : null;
      const { user: updated, error } = await LSApi.updateUser(user.sid, {
        full_name: editFn.trim() || undefined,
        phone: editPh.trim(),
        whatsapp: editWa.trim(),
        user_type: isGeneral ? 'general' : 'student',
        college_id: isGeneral ? null : editCid,
        reg_no: isGeneral ? null : editRn.trim() || null,
        hostel_block: isGeneral ? null : editHos.trim() || null,
        room_number: isGeneral ? null : editRm.trim() || null,
        year: yearNum != null && !Number.isNaN(yearNum) ? yearNum : null,
      });
      if (updated) {
        const u = rowToUser(updated);
        setUser(u);
        saveUser(u);
        go('profile');
        showToast('Profile updated', 'ok');
      } else {
        showToast(error ?? 'Update failed', 'er');
      }
    } catch (_) {
      showToast('Update failed', 'er');
    }
    setEditProfileSaving(false);
  };

  const handleSelectVendor = (vendorId: string) => {
    setSd((s) => ({ ...s, step: s.svc ? 2 : 1, vendorId }));
  };

  const handleScheduleService = (svcId: string) => {
    setSd((s) => ({ ...s, step: 2, svc: svcId }));
  };

  const handleScheduleDateSlot = (date: string, ts: string, ins: string) => {
    setSd((s) => ({ ...s, step: 3, date, ts, ins }));
  };

  const handleConfirmOrder = async () => {
    if (!user || !sd.svc || !sd.date || !sd.ts) return;
    if (!user.ph?.trim()) {
      go('complete-profile');
      showToast('Add your phone number to place orders', 'er');
      return;
    }
    if (needsStudentHostelDetails(user)) {
      setShowStudentDetailsModal(true);
      showToast('Add your registration number, hostel block, and room number to place an order', 'er');
      return;
    }
    const existingSameDay = orders.some(
      (o) => o.pd === sd.date && o.svc === sd.svc && o.status !== 'delivered'
    );
    if (existingSameDay) {
      const svcName = SERVICES.find((x) => x.id === sd.svc)?.name ?? 'this service';
      showToast(`You already have a ${svcName} order for this date. Complete it first.`, 'er');
      return;
    }
    if (!hasAcceptedLatestTerms) {
      setTermsChecked(false);
      setShowTermsModal(true);
      return;
    }
    const svc = SERVICES.find((x) => x.id === sd.svc);
    const selectedVendor = homeVendors.find((v) => v.id === sd.vendorId);
    setOrderSubmitting(true);
    try {
      const vendorName = selectedVendor?.name ?? 'Pro Fab Power Laundry Services';
      let row: any = null;
      let lastError = 'Order failed';

      // Short tokens can collide; retry several times if DB unique constraint rejects.
      for (let attempt = 0; attempt < 8; attempt++) {
        const payload = {
          on: genOid(),
          tk: genTk(),
          svc: sd.svc,
          sl: svc?.name ?? sd.svc,
          pd: sd.date,
          ts: sd.ts,
          status: 'scheduled',
          ins: sd.ins ?? undefined,
          vendorName,
          vendorSlug: sd.vendorId,
          campusId: effectiveCampusId,
        };
        const result = await LSApi.createOrder(payload, user.sid);
        if (result.order) {
          row = result.order;
          break;
        }
        if (result.error) lastError = result.error;
        if (result.code === 'TERMS_NOT_ACCEPTED') {
          setTermsChecked(false);
          setShowTermsModal(true);
          setOrderSubmitting(false);
          return;
        }
        if (result.code === 'STUDENT_DETAILS_REQUIRED') {
          setShowStudentDetailsModal(true);
          showToast(result.error || 'Add your student details to book', 'er');
          setOrderSubmitting(false);
          return;
        }
      }

      if (row) {
        const newOrder = rowToOrder(row);
        setOrders((prev) => [newOrder, ...prev]);
        saveO([newOrder, ...orders]);
        setSd({ step: 0 });
        go('token-success', { oid: row.id });
      } else {
        showToast(lastError, 'er');
      }
    } catch (_) {
      showToast('Order failed', 'er');
    }
    setOrderSubmitting(false);
  };

  const handleConfirmDelivery = async (orderId: string) => {
    setConfirmingDelivery(true);
    try {
      const updated = await LSApi.confirmDelivery(orderId, deliveryComments.trim() || undefined);
      if (updated) {
        const u = rowToOrder(updated);
        const newOrders = orders.map((o) => (o.id === orderId ? u : o));
        setOrders(newOrders);
        saveO(newOrders);
        setDeliveryComments('');
        showToast('Thanks for confirming!', 'ok');
      } else {
        showToast('Could not confirm', 'er');
      }
    } catch (_) {
      showToast('Could not confirm', 'er');
    }
    setConfirmingDelivery(false);
  };

  const handleLogout = async () => {
    await LSApi.signOutAuth();
    setUser(null);
    setOrders([]);
    localStorage.removeItem('ls_u');
    localStorage.removeItem('ls_o');
    setScreen('login');
    showToast('Signed out', 'ok');
  };

  const handleSetPasswordForEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profilePw.length < 6) {
      showToast('Password must be at least 6 characters', 'er');
      return;
    }
    if (profilePw !== profilePwConfirm) {
      showToast('Passwords do not match', 'er');
      return;
    }
    setProfilePwSaving(true);
    const { error } = await LSApi.updatePassword(profilePw);
    setProfilePwSaving(false);
    if (error) {
      showToast(error, 'er');
      return;
    }
    setProfilePw('');
    setProfilePwConfirm('');
    if (user?.sid && typeof window !== 'undefined') {
      localStorage.setItem('ls_password_set_' + user.sid, '1');
      setPasswordAlreadySet(true);
    }
    showToast('Password set. You can now sign in with email + password.', 'ok');
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const selectedSvc = SERVICES.find((s) => s.id === sd.svc);
  const selectedVendor = homeVendors.find((vendor) => vendor.id === sd.vendorId);
  const daysFromApi = scheduleDates
    .filter((d) => d.date >= todayStr && isDateEnabledForVendor(d.date, selectedVendor?.id))
    .map((d) => formatScheduleDay(d.date));
  const days = daysFromApi.length > 0 ? daysFromApi : getScheduleDates();
  const selectedVendorProfile = selectedVendor ? profileForVendor(selectedVendor) : null;
  const selectedVendorSlotList = selectedVendor
    ? scheduleSlots
        .map((slot) => {
          const normalizedId = normalizeScheduleIdForVendor(slot.id, selectedVendor.id);
          return normalizedId ? { ...slot, id: normalizedId } : null;
        })
        .filter((slot): slot is ScheduleSlotRow => !!slot)
    : scheduleSlots.filter((slot) => !String(slot.id).includes('__'));
  const timeSlotsForStep2 =
    selectedVendorSlotList.length > 0 && scheduleDates.length > 0 && sd.date
      ? selectedVendorSlotList.filter(
          (s) => s.active && slotIdsForDateByVendor(sd.date!, selectedVendor?.id).includes(s.id)
        )
      : TIME_SLOTS;
  const selectedTsFromApi = selectedVendorSlotList.find((t) => t.id === sd.ts);
  const selectedTs = selectedTsFromApi
    ? { id: selectedTsFromApi.id, label: selectedTsFromApi.label, emoji: '🕐' }
    : TIME_SLOTS.find((t) => t.id === sd.ts);
  const afternoonDisabled = !selectedTsFromApi && sd.date ? isEveningOnlyDate(sd.date) : false;

  if (screen === 'splash') {
    return (
      <div className="splash" id="splash">
        <div className="splash-logo">
          <img src="/icon-192.png" alt="LaundroSwipe" width={80} height={80} />
        </div>
        <h2>LaundroSwipe</h2>
        <p>Your laundry sorted in one swipe</p>
        <div className="splash-l" />
        <div className="splash-legal">
          <Link href="/privacy">Privacy</Link>
          {' · '}
          <Link href="/terms">Terms</Link>
        </div>
      </div>
    );
  }

  if (screen === 'onboarding') {
    return (
      <div className="ob">
        <div className="obs">
          <div className={`osl ${obSlide === 0 ? 'active' : obSlide > 0 ? 'prev' : 'next'}`}>
            <div className="oi s1">🧺</div>
            <div className="ott">Schedule in a swipe</div>
            <div className="otd">Pick a service, date & time. We&apos;ll pick up and deliver.</div>
          </div>
          <div className={`osl ${obSlide === 1 ? 'active' : obSlide > 1 ? 'prev' : 'next'}`}>
            <div className="oi s2">📅</div>
            <div className="ott">Tue, Sat & Sun pickups</div>
            <div className="otd">Campus pickups. Afternoon or evening slot for your convenience.</div>
          </div>
          <div className={`osl ${obSlide === 2 ? 'active' : obSlide < 2 ? 'next' : 'prev'}`}>
            <div className="oi s3">✨</div>
            <div className="ott">Track & relax</div>
            <div className="otd">Get token and status updates. One less thing to worry about.</div>
          </div>
        </div>
        <div className="obt">
          <div className="ods">
            {([0, 1, 2] as const).map((i) => (
              <div key={i} className={`od ${obSlide === i ? 'a' : ''}`} />
            ))}
          </div>
          <button type="button" className="btn bp bbl" onClick={handleObNext}>
            {obSlide < 2 ? 'Next' : 'Get Started'}
          </button>
          <button type="button" className="btn bout bbl" onClick={handleObSkip}>
            Skip
          </button>
          <div className="ob-legal">
            <Link href="/privacy">Privacy</Link>
            {' · '}
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>
    );
  }

  const isStudentSignup = studentCid && studentCid !== 'general';

  if (screen === 'login') {
    return (
      <div className="as">
        <div className="ah">
          <div className="lg">
            <img src="/icon-192.png" alt="" className="lgi" width={40} height={40} />
            <span className="lgt">LaundroSwipe</span>
          </div>
          <h1 className="atl">Sign in</h1>
          <p className="asu">Use your account to schedule pickups</p>
        </div>
        {LSApi.hasSupabase && (
          <button type="button" className="btn bp bbl" onClick={handleGoogleLogin} disabled={authLoading}>
            Continue with Google
          </button>
        )}
        <form onSubmit={handleLoginEmail} style={{ marginTop: LSApi.hasSupabase ? 16 : 0 }}>
          <div className="fg">
            <label className="fl">Email</label>
            <input
              type="email"
              className="fi"
              placeholder="you@example.com"
              value={loginEm}
              onChange={(e) => setLoginEm(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="fg">
            <label className="fl">Password</label>
            <input
              type="password"
              className="fi"
              placeholder="••••••••"
              value={loginPw}
              onChange={(e) => setLoginPw(e.target.value)}
              autoComplete="current-password"
            />
            <p className="aft" style={{ marginTop: 6 }}>
              <span className="al" onClick={() => go('forgot-password')} role="button">
                Forgot password?
              </span>
            </p>
            <p className="vd" style={{ marginTop: 4, fontSize: 12 }}>Signed up with Google? Set a password in Profile to sign in with email (same account).</p>
          </div>
          <button type="submit" className="btn bout bbl" disabled={authLoading}>
            {authLoading ? 'Signing in…' : 'Sign in with email'}
          </button>
        </form>
        <p className="aft" style={{ marginTop: 24, fontWeight: 600, color: 'var(--tx)' }}>
          New here? Create an account
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" className="btn bout bbl" onClick={() => go('signup')}>
            Sign up
          </button>
        </div>
        <p className="aft legal" style={{ marginTop: 20 }}>
          <Link href="/privacy">Privacy</Link>
          {' · '}
          <Link href="/terms">Terms</Link>
        </p>
        <p className="aft" style={{ marginTop: 12, fontSize: 13 }}>
          <Link href="/admin" style={{ color: 'var(--ts)' }}>Admin login</Link>
        </p>
      </div>
    );
  }

  if (screen === 'forgot-password') {
    return (
      <div className="as">
        <div className="ah">
          <h1 className="atl">Forgot password?</h1>
          <p className="asu">Enter your email and we’ll send you a link to reset your password.</p>
        </div>
        {resetSent ? (
          <>
            <p className="vd" style={{ marginBottom: 16 }}>We’ve sent a link to <strong>{forgotEm}</strong>. Check your inbox and click the link to set a new password.</p>
            <button type="button" className="btn bout bbl" onClick={() => { setResetSent(false); setForgotEm(''); go('login'); }}>
              Back to sign in
            </button>
          </>
        ) : (
          <form onSubmit={handleForgotPassword}>
            <div className="fg">
              <label className="fl">Email</label>
              <input
                type="email"
                className="fi"
                placeholder="you@example.com"
                value={forgotEm}
                onChange={(e) => setForgotEm(e.target.value)}
                autoComplete="email"
              />
            </div>
            <button type="submit" className="btn bout bbl" disabled={authLoading}>
              {authLoading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
        <p className="aft" style={{ marginTop: 20 }}>
          <span className="al" onClick={() => go('login')} role="button">
            Back to sign in
          </span>
        </p>
      </div>
    );
  }

  if (screen === 'set-password') {
    return (
      <div className="as">
        <div className="ah">
          <h1 className="atl">Set new password</h1>
          <p className="asu">Choose a new password for your account.</p>
        </div>
        <form onSubmit={handleSetPassword}>
          <div className="fg">
            <label className="fl">New password</label>
            <input
              type="password"
              className="fi"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <div className="fg">
            <label className="fl">Confirm password</label>
            <input
              type="password"
              className="fi"
              placeholder="Same as above"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <button type="submit" className="btn bout bbl" disabled={authLoading}>
            {authLoading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    );
  }

  if (screen === 'complete-profile') {
    return (
      <div className="as">
        <div className="ah">
          <h1 className="atl">Complete your profile</h1>
          <p className="asu">We need your details for orders & updates. Phone and WhatsApp must be 10-digit Indian numbers.</p>
        </div>
        <form onSubmit={handleCompleteProfile}>
          <div className="fg">
            <label className="fl">Full name</label>
            <input type="text" className="fi" value={user?.fn ?? ''} readOnly style={{ background: 'var(--bg)', color: 'var(--ts)' }} />
          </div>
          <div className="fg">
            <label className="fl">Email</label>
            <input type="email" className="fi" value={user?.em ?? ''} readOnly style={{ background: 'var(--bg)', color: 'var(--ts)' }} />
          </div>
          <div className="fg">
            <label className="fl">Phone</label>
            <input type="tel" className="fi" placeholder="10-digit mobile number" value={signupPh} onChange={(e) => { setSignupPh(e.target.value); setSignupPhErr(''); }} required />
            {signupPhErr && <p className="field-error">{signupPhErr}</p>}
          </div>
          <div className="fg">
            <label className="fl">WhatsApp</label>
            <input type="tel" className="fi" placeholder="10-digit WhatsApp number" value={signupWa} onChange={(e) => { setSignupWa(e.target.value); setSignupWaErr(''); }} required />
            {signupWaErr && <p className="field-error">{signupWaErr}</p>}
          </div>
          <div className="fg">
            <label className="fl">College</label>
            <select className="fi fs" value={studentCid} onChange={(e) => setStudentCid(e.target.value)} required>
              <option value="">Select one</option>
              <option value="general">Not a student</option>
              {COLLEGES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{!c.active ? ' (coming soon)' : ''}
                </option>
              ))}
            </select>
          </div>
          {isStudentSignup && (
            <>
              <div className="fg">
                <label className="fl">Registration number</label>
                <input type="text" className="fi" placeholder="Reg no" value={studentRn} onChange={(e) => setStudentRn(e.target.value)} required />
              </div>
              <div className="fg">
                <label className="fl">Hostel block</label>
                <input type="text" className="fi" placeholder="e.g. D2, A" value={studentHos} onChange={(e) => setStudentHos(e.target.value)} required />
              </div>
              <div className="fg">
                <label className="fl">Room number</label>
                <input type="text" className="fi" placeholder="e.g. 405" value={studentRm} onChange={(e) => setStudentRm(e.target.value)} required />
              </div>
              <div className="fg">
                <label className="fl">Year (optional)</label>
                <input type="number" className="fi" placeholder="e.g. 2" min={1} max={5} value={studentYr} onChange={(e) => setStudentYr(e.target.value)} />
              </div>
            </>
          )}
          <button type="submit" className="btn bp bbl" disabled={authLoading}>
            {authLoading ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </div>
    );
  }

  if (screen === 'signup' || screen === 'student-signup') {
    return (
      <div className="as">
        <div className="ah">
          <h1 className="atl">Create account</h1>
          <p className="asu">Students: pick your college. Not a student? Choose &quot;Not a student&quot; below.</p>
        </div>
        <form onSubmit={handleSignup}>
          <div className="fg">
            <label className="fl">Full name</label>
            <input type="text" className="fi" placeholder="Your name" value={signupFn} onChange={(e) => setSignupFn(e.target.value)} required />
          </div>
          <div className="fg">
            <label className="fl">Email</label>
            <input type="email" className="fi" placeholder="you@example.com" value={signupEm} onChange={(e) => setSignupEm(e.target.value)} required />
          </div>
          <div className="fg">
            <label className="fl">Phone</label>
            <input type="tel" className="fi" placeholder="10-digit mobile number" value={signupPh} onChange={(e) => { setSignupPh(e.target.value); setSignupPhErr(''); }} required />
            {signupPhErr && <p className="field-error">{signupPhErr}</p>}
          </div>
          <div className="fg">
            <label className="fl">WhatsApp</label>
            <input type="tel" className="fi" placeholder="10-digit WhatsApp number" value={signupWa} onChange={(e) => { setSignupWa(e.target.value); setSignupWaErr(''); }} required />
            {signupWaErr && <p className="field-error">{signupWaErr}</p>}
          </div>
          <div className="fg">
            <label className="fl">Password (required)</label>
            <input type="password" className="fi" placeholder="Min 6 characters — you’ll use this with email to sign in" value={signupPw} onChange={(e) => setSignupPw(e.target.value)} required minLength={6} autoComplete="new-password" />
            <p className="vd" style={{ marginTop: 4, fontSize: 12 }}>Required to sign in with email after sign out.</p>
          </div>
          <div className="fg">
            <label className="fl">College</label>
            <select className="fi fs" value={studentCid} onChange={(e) => setStudentCid(e.target.value)} required>
              <option value="">Select one</option>
              <option value="general">Not a student</option>
              {COLLEGES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{!c.active ? ' (coming soon)' : ''}
                </option>
              ))}
            </select>
          </div>
          {isStudentSignup && (
            <>
              <div className="fg">
                <label className="fl">Registration number</label>
                <input type="text" className="fi" placeholder="Reg no" value={studentRn} onChange={(e) => setStudentRn(e.target.value)} required />
              </div>
              <div className="fg">
                <label className="fl">Hostel block</label>
                <input type="text" className="fi" placeholder="e.g. D2, A" value={studentHos} onChange={(e) => setStudentHos(e.target.value)} required />
              </div>
              <div className="fg">
                <label className="fl">Room number</label>
                <input type="text" className="fi" placeholder="e.g. 405" value={studentRm} onChange={(e) => setStudentRm(e.target.value)} required />
              </div>
              <div className="fg">
                <label className="fl">Year (optional)</label>
                <input type="number" className="fi" placeholder="e.g. 2" min={1} max={5} value={studentYr} onChange={(e) => setStudentYr(e.target.value)} />
              </div>
            </>
          )}
          <button type="submit" className="btn bp bbl" disabled={authLoading}>
            {authLoading ? 'Creating…' : 'Sign up'}
          </button>
        </form>
        <p className="aft">
          Already have an account?{' '}
          <span className="al" onClick={() => go('login')} role="button">
            Sign in
          </span>
        </p>
      </div>
    );
  }

  if (screen === 'token-success') {
    const order = orders.find((o) => o.id === dd.oid) ?? orders[0];
    return (
      <div className="as si token-success-page">
        <div className="vc token-success-card">
          <div className="vn" style={{ fontSize: 20, marginBottom: 8 }}>Order confirmed</div>
          <div className="vd" style={{ marginBottom: 20 }}>Show this token at pickup</div>
          {order && (
            <div className="tnb token-display">
              <div className="token-label">YOUR TOKEN NUMBER</div>
              <div className="token-value">#{order.tk}</div>
            </div>
          )}
          {order && (
            <div className="token-order-info">
              <div className="vd"><strong>Order:</strong> {order.on}</div>
              <div className="vd"><strong>Service:</strong> {order.sl} · {order.pd} · {order.ts}</div>
            </div>
          )}
          <ul className="tkins">
            <li>Keep this token handy for pickup</li>
            <li>We&apos;ll notify you on WhatsApp</li>
          </ul>
        </div>
        <button type="button" className="btn bp bbl" onClick={() => go('home')}>
          Back to Home
        </button>
      </div>
    );
  }

  if (screen === 'edit-profile') {
    return (
      <div className="as">
        <div className="ah">
          <h1 className="atl">Edit profile</h1>
          <p className="asu">Update your details for orders and updates.</p>
        </div>
        <form onSubmit={handleSaveEditProfile}>
          <div className="fg">
            <label className="fl">Full name</label>
            <input type="text" className="fi" placeholder="Your name" value={editFn} onChange={(e) => setEditFn(e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">Email</label>
            <input type="email" className="fi" value={user?.em ?? ''} readOnly style={{ background: 'var(--bg)', color: 'var(--ts)' }} />
          </div>
          <div className="fg">
            <label className="fl">Phone</label>
            <input type="tel" className="fi" placeholder="10-digit mobile number" value={editPh} onChange={(e) => { setEditPh(e.target.value); setEditPhErr(''); }} />
            {editPhErr && <p className="field-error">{editPhErr}</p>}
          </div>
          <div className="fg">
            <label className="fl">WhatsApp</label>
            <input type="tel" className="fi" placeholder="10-digit WhatsApp number" value={editWa} onChange={(e) => { setEditWa(e.target.value); setEditWaErr(''); }} />
            {editWaErr && <p className="field-error">{editWaErr}</p>}
          </div>
          <div className="fg">
            <label className="fl">College</label>
            <select className="fi fs" value={editCid} onChange={(e) => setEditCid(e.target.value)}>
              <option value="">Select one</option>
              <option value="general">Not a student</option>
              {COLLEGES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{!c.active ? ' (coming soon)' : ''}
                </option>
              ))}
            </select>
          </div>
          {editCid && editCid !== 'general' && (
            <>
              <div className="fg">
                <label className="fl">Registration number</label>
                <input type="text" className="fi" placeholder="Reg no" value={editRn} onChange={(e) => setEditRn(e.target.value)} />
              </div>
              <div className="fg">
                <label className="fl">Hostel block</label>
                <input type="text" className="fi" placeholder="e.g. D2, A" value={editHos} onChange={(e) => setEditHos(e.target.value)} required />
              </div>
              <div className="fg">
                <label className="fl">Room number</label>
                <input type="text" className="fi" placeholder="e.g. 405" value={editRm} onChange={(e) => setEditRm(e.target.value)} required />
              </div>
              <div className="fg">
                <label className="fl">Year (optional)</label>
                <input type="number" className="fi" placeholder="e.g. 2" min={1} max={5} value={editYr} onChange={(e) => setEditYr(e.target.value)} />
              </div>
            </>
          )}
          <button type="submit" className="btn bp bbl" disabled={editProfileSaving}>
            {editProfileSaving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn bout bbl" style={{ marginTop: 8 }} onClick={() => go('profile')}>
            Cancel
          </button>
        </form>
      </div>
    );
  }

  if (screen === 'notifications') {
    return (
      <div className="as">
        <div className="ah" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="btn bout bsm" onClick={() => go('profile')} aria-label="Back">←</button>
          <div>
            <h1 className="atl" style={{ margin: 0 }}>Notifications</h1>
            <p className="asu" style={{ margin: 0 }}>Messages from LaundroSwipe</p>
          </div>
        </div>
        {notificationsLoading ? (
          <p className="vd" style={{ marginTop: 24 }}>Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="vd" style={{ marginTop: 24 }}>No messages yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }}>
            {notifications.map((n) => (
              <li
                key={n.id}
                style={{
                  background: n.read_at ? 'var(--bg)' : 'rgba(23,70,162,.06)',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 10,
                  border: '1px solid var(--bd)',
                }}
                onClick={() => {
                  if (!n.read_at) {
                    LSApi.markNotificationRead(n.id).then((ok) => {
                      if (ok) {
                        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
                        setUnreadNotificationCount((c) => Math.max(0, c - 1));
                      }
                    });
                  }
                }}
              >
                <strong style={{ display: 'block', marginBottom: 4 }}>{n.title}</strong>
                {n.body && <p className="vd" style={{ margin: 0, fontSize: 14 }}>{n.body}</p>}
                <p className="vd" style={{ margin: '6px 0 0', fontSize: 12 }}>{n.sent_at ? new Date(n.sent_at).toLocaleString() : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (screen === 'coming-soon') {
    return (
      <div className="as si">
        <div className="csw" />
        <div className="csb" />
        <div className="csb" />
        <div className="csb" />
        <h2 className="st" style={{ marginTop: 120 }}>Coming soon</h2>
        <p className="fn">This feature is under construction.</p>
        <button type="button" className="btn bp bbl" onClick={() => go('home')}>
          Back
        </button>
      </div>
    );
  }

  const tab = screen === 'order-detail' ? 'orders' : screen === 'my-bills' ? 'profile' : screen === 'home' ? 'home' : screen === 'schedule' ? 'schedule' : screen === 'orders' ? 'orders' : 'profile';
  const showMain = ['home', 'schedule', 'orders', 'profile', 'order-detail', 'my-bills'].includes(screen);

  if (showMain && user) {
    return (
      <>
        <header className="tn">
          <img src="/icon-192.png" alt="" className="tn-logo" width={36} height={36} />
          <h1>LaundroSwipe</h1>
          <button
            type="button"
            className="tn-notif touch-target"
            onClick={() => go('notifications')}
            aria-label={unreadNotificationCount > 0 ? `${unreadNotificationCount} unread notifications` : 'Notifications'}
          >
            <Bell className="tn-notif-icon" size={22} aria-hidden />
            {unreadNotificationCount > 0 && (
              <span className="tn-notif-badge" aria-hidden>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>
            )}
          </button>
        </header>
        <main className={`scr scr-${screen}`}>
          <div className={`si si-${screen}`} key={screen}>
            {screen === 'home' && (
              <>
                <div className="hh">
                  <p>Hi, {user.fn || 'User'} 👋</p>
                  <p className="hh-sub">Schedule pickup with the right laundry partner for your hostel, with cleaner booking steps and clearer pricing info.</p>
                  <button type="button" className="scta" onClick={goToSchedule}>
                    Schedule pickup
                    <span className="aw">→</span>
                  </button>
                </div>

                <div className="oc" style={{ marginBottom: 16, padding: 16, borderRadius: 20, background: 'linear-gradient(180deg, rgba(23,70,162,0.06), rgba(23,70,162,0.01))' }}>
                  <p className="st" style={{ marginBottom: 6 }}>Pick a partner</p>
                  <p className="vd" style={{ marginBottom: 12 }}>
                    Choose a laundry partner based on your hostel block.
                  </p>
                  <div className="dss" aria-label="Laundry partners" role="list">
                    {homeVendors.length === 0 ? (
                      <p className="vd" style={{ marginBottom: 0 }}>
                        No laundry partners are listed for your campus yet. Check your college in Profile, or contact support if this campus should be live.
                      </p>
                    ) : (
                      homeVendors.map((v) => (
                        (() => {
                          const vp = profileForVendor(v);
                          const available = isVendorAvailable(v);
                          return (
                            <button
                              key={v.id}
                              type="button"
                              className={`ds ${available.ok ? '' : 'dis'}`}
                              onClick={() => available.ok && goToScheduleWithVendor(v.id)}
                              aria-label={`Schedule with ${vp.name || v.name}`}
                              disabled={!available.ok}
                            >
                              {vp.logo_url ? (
                                <img src={vp.logo_url} alt="" style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 6 }} />
                              ) : (
                                <span aria-hidden style={{ width: 22, height: 22, display: 'inline-block' }} />
                              )}
                              <span className="dy" style={{ marginTop: 2 }}>{vp.name || v.name}</span>
                              <span className="mo">{available.ok ? v.audienceLabel || v.location : available.reason}</span>
                            </button>
                          );
                        })()
                      ))
                    )}
                  </div>
                </div>

                <div className="oc" style={{ marginBottom: 16, padding: 16, borderRadius: 20 }}>
                <p className="st">Services</p>
                <div className="sg" style={{ marginTop: 12 }}>
                  {SERVICES.filter((s) => !s.comingSoon).map((s) => {
                    const Icon = SERVICE_ICONS[s.id] ?? Shirt;
                    return (
                      <button
                        type="button"
                        key={s.id}
                        className="sc"
                        onClick={() => goToScheduleWithService(s.id)}
                      >
                        <span className="ic sc-icon">
                          <Icon size={28} strokeWidth={1.8} />
                        </span>
                        <span className="nm">{s.name}</span>
                      </button>
                    );
                  })}
                </div>
                </div>
                <p className="fn">LaundroSwipe makes pickup selection clearer for your hostel and location.</p>
                <p className="st">Vendors available in your location</p>
                {homeVendors.length === 0 ? (
                  <p className="vd">None yet for this campus.</p>
                ) : (
                  homeVendors.map((v) => {
                    const vp = profileForVendor(v);
                    return (
                      <div
                        key={v.id}
                        className="oc oc-row"
                        style={{ marginBottom: 10 }}
                        onClick={() => setViewingVendor(vp)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewingVendor(vp); } }}
                      >
                        {vp.logo_url ? (
                          <img src={vp.logo_url} alt="" className="oc-logo" />
                        ) : (
                          <span aria-hidden style={{ width: 40, height: 40, display: 'inline-block', flexShrink: 0 }} />
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span className="nm oc-vendor-name">{vp.name || v.name}</span>
                          <span className="vd" style={{ fontSize: 12 }}>{v.audienceLabel || v.location}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div className="hiw">
                  <div className="hiws">
                    <div className="hiwn">1</div>
                    <div className="hiwt">Pick service & date</div>
                  </div>
                  <div className="hiws">
                    <div className="hiwn">2</div>
                    <div className="hiwt">We pick up</div>
                  </div>
                  <div className="hiws">
                    <div className="hiwn">3</div>
                    <div className="hiwt">Delivery</div>
                  </div>
                </div>
                {visibleOrdersSorted.length > 0 && (
                  <>
                    <p className="st">Recent orders</p>
                    {visibleOrdersSorted.slice(0, 3).map((o) => {
                      const hasBill = billByOrderToken.has(orderTokenKey(o.tk));
                      return (
                      <div
                        key={o.id}
                        className="oc"
                        onClick={() => go('order-detail', { oid: o.id })}
                        onKeyDown={(e) => e.key === 'Enter' && go('order-detail', { oid: o.id })}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="oc-row oc-head">
                          <span className="aotkv">#{o.tk}</span>
                          <span className={`vdb ${customerFacingStatusClass(o.status, hasBill)}`}>{customerFacingStatusLabel(o.status, hasBill)}</span>
                        </div>
                        <p className="vd">{o.sl} · {o.pd}</p>
                      </div>
                    );})}
                  </>
                )}
              </>
            )}

            {screen === 'schedule' && (
              <>
                <div className="spi">
                  <div className={`spd ${sd.step >= 0 ? 'ac' : ''} ${sd.step > 0 ? 'dn' : ''}`}>1</div>
                  <div className={`spl ${sd.step > 0 ? 'dn' : ''}`} />
                  <div className={`spd ${sd.step >= 1 ? 'ac' : ''} ${sd.step > 1 ? 'dn' : ''}`}>2</div>
                  <div className={`spl ${sd.step > 1 ? 'dn' : ''}`} />
                  <div className={`spd ${sd.step >= 2 ? 'ac' : ''} ${sd.step > 2 ? 'dn' : ''}`}>3</div>
                  <div className={`spl ${sd.step > 2 ? 'dn' : ''}`} />
                  <div className={`spd ${sd.step >= 3 ? 'ac' : ''} ${sd.step > 2 ? 'dn' : ''}`}>4</div>
                </div>
                {sd.step === 0 && (
                  <>
                    <p className="st">Select vendor</p>
                    <p className="vd" style={{ marginBottom: 12 }}>VIT Chennai booking is open for everyone.</p>
                    <p className="vd" style={{ marginBottom: 12 }}>
                      VIT Chennai split: Pro Fab for A, D1, D2 blocks · Star Wash for B, C, E blocks.
                    </p>
                    {homeVendors.length === 0 ? (
                      <p className="vd" style={{ marginBottom: 12 }}>
                        No vendors for this campus yet. If you think this is a mistake, contact support.
                      </p>
                    ) : (
                      homeVendors.map((v) => (
                        (() => {
                          const vp = profileForVendor(v);
                          const avail = isVendorAvailable(v);
                          const canPick = avail.ok;
                          const vendorTitle = vp.name || v.name;
                          return (
                            <div
                              key={v.id}
                              className={`ssc vendor-card ${canPick ? '' : 'coming-soon'}`}
                              onClick={() => canPick && handleSelectVendor(v.id)}
                              onKeyDown={(e) => e.key === 'Enter' && canPick && handleSelectVendor(v.id)}
                              role="button"
                              tabIndex={canPick ? 0 : -1}
                            >
                              {vp.logo_url ? (
                                <img src={vp.logo_url} alt="" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 10, flexShrink: 0 }} />
                              ) : (
                                <span aria-hidden style={{ width: 44, height: 44, display: 'inline-block', flexShrink: 0 }} />
                              )}
                              <div className="inf">
                                <div className="sn">
                                  {vendorTitle}{' '}
                                  {!canPick && (
                                    <span style={{ fontWeight: 700, color: 'var(--tm)' }}>
                                      ({avail.reason || 'Not available'})
                                    </span>
                                  )}
                                </div>
                                <div className="sd">{v.audienceLabel || v.location}</div>
                              </div>
                              <span className="aw" style={{ fontSize: 20, opacity: canPick ? 1 : 0.35 }}>→</span>
                            </div>
                          );
                        })()
                      ))
                    )}
                    <button type="button" className="btn bout bbl" style={{ marginTop: 16 }} onClick={() => go('home')}>
                      Back
                    </button>
                  </>
                )}
                {sd.step === 1 && (
                  <>
                    <p className="st">Choose service</p>
                    {SERVICES.map((s) => (
                      <div
                        key={s.id}
                        className={`ssc ${sd.svc === s.id ? 'sel' : ''} ${s.comingSoon ? 'coming-soon' : ''}`}
                        onClick={() => !s.comingSoon && handleScheduleService(s.id)}
                        onKeyDown={(e) => !s.comingSoon && e.key === 'Enter' && handleScheduleService(s.id)}
                        role="button"
                        tabIndex={s.comingSoon ? -1 : 0}
                      >
                        <span className="em">{s.emoji}</span>
                        <div className="inf">
                          <div className="sn">{s.name} {s.comingSoon ? '(Coming soon)' : ''}</div>
                          <div className="sd">{s.desc}</div>
                        </div>
                        {!s.comingSoon && <div className="rd" />}
                      </div>
                    ))}
                    <button type="button" className="btn bout bbl" style={{ marginTop: 16 }} onClick={() => setSd((s) => ({ ...s, step: 0 }))}>
                      Back
                    </button>
                  </>
                )}
                {sd.step === 2 && (
                  <>
                    <p className="st">Pick date</p>
                    {days.length === 0 && <p className="vd" style={{ marginBottom: 12 }}>No dates available. Add and enable dates in admin Schedule.</p>}
                    <div className="dss">
                      {days.map((d) => {
                        return (
                          <button
                            type="button"
                            key={d.full}
                            className={`ds ${sd.date === d.full ? 'sel' : ''}`}
                            onClick={() => {
                              const allowedIds =
                                scheduleDates.length > 0
                                  ? slotIdsForDateByVendor(d.full, selectedVendor?.id)
                                  : isEveningOnlyDate(d.full)
                                    ? ['evening']
                                    : ['afternoon', 'evening'];
                              setSd((s) => ({
                                ...s,
                                date: d.full,
                                ts: allowedIds.includes(s.ts ?? '') ? s.ts : undefined,
                              }));
                            }}
                          >
                            <span className="dy">{d.day}</span>
                            <div className="dn2">{d.num}</div>
                            <span className="mo">{d.month}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="st" style={{ marginTop: 20 }}>Time slot</p>
                    {timeSlotsForStep2.length === 0 && sd.date && <p className="vd" style={{ marginBottom: 8 }}>No slots enabled for this date. Enable slots in admin Schedule.</p>}
                    {timeSlotsForStep2.map((t) => {
                      const slotId = 'id' in t ? t.id : (t as { id: string }).id;
                      const slotLabel = 'label' in t ? t.label : (t as { label: string }).label;
                      const slotEmoji = 'emoji' in t ? (t as { emoji?: string }).emoji : '🕐';
                      const isDisabled = scheduleSlots.length === 0 && slotId === 'afternoon' && isEveningOnlyDate(sd.date);
                      return (
                        <div
                          key={slotId}
                          className={`ts2 ${sd.ts === slotId ? 'sel' : ''} ${isDisabled ? 'ts2-dis' : ''}`}
                          onClick={() => !isDisabled && setSd((s) => ({ ...s, ts: slotId }))}
                          onKeyDown={(e) => !isDisabled && e.key === 'Enter' && setSd((s) => ({ ...s, ts: slotId }))}
                          role="button"
                          tabIndex={isDisabled ? -1 : 0}
                        >
                          <span>{slotEmoji}</span>
                          <span>{slotLabel}{isDisabled ? ' (not available this day)' : ''}</span>
                        </div>
                      );
                    })}
                    <p className="vd" style={{ marginTop: 10, fontSize: 12 }}>Timings may vary.</p>
                    <div className="fg" style={{ marginTop: 16 }}>
                      <label className="fl">Instructions (optional)</label>
                      <textarea
                        className="fi fta"
                        placeholder="e.g. Leave at guard"
                        value={sd.ins ?? ''}
                        onChange={(e) => setSd((s) => ({ ...s, ins: e.target.value }))}
                      />
                    </div>
                    <button type="button" className="btn bp bbl" style={{ marginTop: 8 }} onClick={() => sd.date && sd.ts && handleScheduleDateSlot(sd.date, sd.ts, sd.ins ?? '')} disabled={!sd.date || !sd.ts}>
                      Continue
                    </button>
                    <button type="button" className="btn bout bbl" style={{ marginTop: 8 }} onClick={() => setSd((s) => ({ ...s, step: 1 }))}>
                      Back
                    </button>
                  </>
                )}
                {sd.step === 3 && (
                  <>
                    <p className="st">Confirm</p>
                    <div className="vc" style={{ borderRadius: 22, padding: 18 }}>
                      <div className="vn">{selectedSvc?.name} {selectedSvc?.emoji}</div>
                      <div className="vd">{selectedTs?.label} · {sd.date}</div>
                      {selectedVendorProfile && <div className="vd" style={{ marginTop: 4 }}>Partner: {selectedVendorProfile.name}</div>}
                      {sd.ins && <div className="vd">Instructions: {sd.ins}</div>}
                    </div>
                    <div className="oc" style={{ marginTop: 12, padding: 16, borderRadius: 20, background: 'rgba(23,70,162,0.03)' }}>
                      <div className="vd" style={{ fontSize: 14, color: 'var(--tx)', lineHeight: 1.6 }}>
                        By confirming the booking, you accept the <Link href="/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--b)', fontWeight: 700 }}>Terms &amp; Conditions</Link> and the applicable service charges.
                      </div>
                    </div>
                    <div className="warn">
                      Pickup at {selectedVendor?.location || 'your selected pickup point'} on {sd.date}. Keep your token ready.
                    </div>
                    <p className="vd" style={{ marginTop: 8, fontSize: 12 }}>Timings may vary.</p>
                    <p className="vd" style={{ marginBottom: 12, fontWeight: 600 }}>Swipe to confirm order</p>
                    <SwipeToConfirm
                      onConfirm={handleConfirmOrder}
                      disabled={orderSubmitting}
                      placing={orderSubmitting}
                    />
                    <button type="button" className="btn bout bbl" style={{ marginTop: 16 }} onClick={() => setSd((s) => ({ ...s, step: 2 }))}>
                      Back
                    </button>
                  </>
                )}
              </>
            )}

            {screen === 'orders' && (
              <>
                <p className="st">Your orders</p>
                {ordersListLoading ? (
                  <>
                    <div className="skeleton skeleton-card" />
                    <div className="skeleton skeleton-card" />
                    <div className="skeleton skeleton-card" />
                  </>
                ) : visibleOrdersSorted.length === 0 ? (
                  <p className="fn">No orders yet. Schedule a pickup from Home.</p>
                ) : (
                  visibleOrdersSorted.map((o) => {
                    const hasBill = billByOrderToken.has(orderTokenKey(o.tk));
                    return (
                    <div
                      key={o.id}
                      className="oc"
                      onClick={() => go('order-detail', { oid: o.id })}
                      onKeyDown={(e) => e.key === 'Enter' && go('order-detail', { oid: o.id })}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="oc-row oc-head">
                        <span className="aotkv">#{o.tk}</span>
                        <span className={`vdb ${customerFacingStatusClass(o.status, hasBill)}`}>{customerFacingStatusLabel(o.status, hasBill)}</span>
                      </div>
                      <p className="vd">{o.sl} · {o.pd} · {o.ts}</p>
                    </div>
                  );})
                )}
              </>
            )}

            {screen === 'order-detail' && (() => {
              const order = orders.find((o) => o.id === dd.oid);
              if (!order) return <p className="fn">Order not found.</p>;
              const canConfirmDelivery = order.status === 'delivered' && !order.deliveryConfirmedAt;
              const billForOrder = billByOrderToken.get(orderTokenKey(order.tk));
              const hasBillForOrder = Boolean(billForOrder);
              const showDigitalHandshake = order.status !== 'delivered' && !order.deliveryConfirmedAt;
              return (
                <>
                  <div className="vc">
                    <div className="vn">Token #{order.tk}</div>
                    <div className="vd">{order.sl}</div>
                    <div className="vd">{order.pd} · {order.ts}</div>
                    <div className="vds">
                      <span className={`vdb ${customerFacingStatusClass(order.status, hasBillForOrder)}`}>{customerFacingStatusLabel(order.status, hasBillForOrder)}</span>
                    </div>
                    {order.ins && <div className="vd">Instructions: {order.ins}</div>}
                  </div>
                  {showDigitalHandshake && <DigitalHandshake token={order.tk} />}
                  {billForOrder && (
                    <div className="vc" style={{ marginTop: 12, background: 'rgba(23,70,162,0.06)', borderColor: 'rgba(23,70,162,0.18)' }}>
                      <div className="vn" style={{ fontSize: 15 }}>Your bill is ready</div>
                      <p className="vd" style={{ marginBottom: 12 }}>
                        The vendor has posted itemized charges for this pickup. Open the bill to review totals.
                      </p>
                      <button type="button" className="btn bp bbl" onClick={() => setViewingBill(billForOrder)}>
                        View bill
                      </button>
                    </div>
                  )}
                  {!billForOrder && (order.status === 'scheduled' || order.status === 'agent_assigned') && (
                    <p className="vd" style={{ marginTop: 12, fontSize: 13, color: 'var(--ts)', lineHeight: 1.55 }}>
                      After your clothes are collected, the vendor usually posts your bill within a few days.
                    </p>
                  )}
                  {(order.status === 'delivered' || order.deliveryConfirmedAt) && (
                    <div className="vc" style={{ background: '#DCFCE7', borderColor: 'rgba(22,163,74,.2)' }}>
                      {order.deliveryConfirmedAt ? (
                        <div className="vd">✓ You confirmed you received all items.{order.deliveryComments && ` "${order.deliveryComments}"`}</div>
                      ) : (
                        <>
                          <div className="vn" style={{ fontSize: 15 }}>Confirm you got all items</div>
                          <div className="vd" style={{ marginBottom: 12 }}>Mark that you collected your clothes.</div>
                          <textarea
                            placeholder="Optional comments"
                            className="fi fta"
                            value={deliveryComments}
                            onChange={(e) => setDeliveryComments(e.target.value)}
                            rows={2}
                            style={{ marginBottom: 12 }}
                          />
                          <button type="button" className="btn bp bbl" disabled={confirmingDelivery} onClick={() => handleConfirmDelivery(order.id)}>
                            {confirmingDelivery ? 'Submitting…' : 'Submit confirmation'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {order.status !== 'delivered' && !order.deliveryConfirmedAt && (
                    <div className="vd" style={{ marginBottom: 12 }}>Once delivered, you can confirm here that you received all items.</div>
                  )}
                  <button type="button" className="btn bout bbl" onClick={() => go('orders')}>
                    Back to orders
                  </button>
                </>
              );
            })()}

            {screen === 'my-bills' && (
              <>
                <button type="button" className="btn bout bsm" style={{ marginBottom: 12 }} onClick={() => go('profile')}>
                  ← Back to profile
                </button>
                <p className="st">My bills</p>
                <p className="vd" style={{ marginBottom: 16 }}>Bills generated for your orders.</p>
                {myBillsLoading ? (
                  <>
                    <div className="skeleton skeleton-card" />
                    <div className="skeleton skeleton-card" />
                  </>
                ) : myBillsError ? (
                  <p className="vd">{myBillsError}</p>
                ) : myBills.length === 0 ? (
                  <p className="vd">No bills yet. Bills appear here after a vendor generates one for your order.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {myBills.map((b) => (
                      <div key={b.id} className="oc" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                        <div style={{ fontWeight: 700, color: 'var(--b)' }}>Token #{b.order_token} · {b.order_number ?? '—'}</div>
                        <div style={{ fontSize: 13, color: 'var(--ts)' }}>₹{b.total} · {b.created_at ? new Date(b.created_at).toLocaleDateString() : ''}</div>
                        <button type="button" className="btn bout bbl" onClick={() => setViewingBill(b)}>
                          View bill
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {screen === 'profile' && (
              <>
                <div style={{ marginBottom: 24 }}>
                  <div className="pa">{(user.fn || 'U').charAt(0).toUpperCase()}</div>
                  <p className="st" style={{ marginTop: 8 }}>{user.fn || 'User'}</p>
                  <p className="vd">{user.em || ''}</p>
                  {user.ph && <p className="vd">{user.ph}</p>}
                </div>
                {LSApi.hasSupabase && !passwordAlreadySet && (
                  <div className="oc" style={{ marginBottom: 16 }}>
                    <p className="st" style={{ marginBottom: 8 }}>Sign in with email</p>
                    <p className="vd" style={{ fontSize: 13, marginBottom: 12 }}>Set a password so you can also sign in with {user.em || 'your email'} and password (same account).</p>
                    <form onSubmit={handleSetPasswordForEmail}>
                      <div className="fg">
                        <label className="fl">Password</label>
                        <input type="password" className="fi" placeholder="Min 6 characters" value={profilePw} onChange={(e) => setProfilePw(e.target.value)} minLength={6} autoComplete="new-password" />
                      </div>
                      <div className="fg">
                        <label className="fl">Confirm password</label>
                        <input type="password" className="fi" placeholder="Same as above" value={profilePwConfirm} onChange={(e) => setProfilePwConfirm(e.target.value)} minLength={6} autoComplete="new-password" />
                      </div>
                      <button type="submit" className="btn bout bbl" disabled={profilePwSaving || !profilePw || !profilePwConfirm}>
                        {profilePwSaving ? 'Setting…' : 'Set password for email sign-in'}
                      </button>
                    </form>
                  </div>
                )}
                <div className="oc" style={{ marginBottom: 16 }}>
                    <p className="st" style={{ marginBottom: 8 }}>Push notifications</p>
                    <p className="vd" style={{ fontSize: 13 }}>Pickup reminders and updates are sent to the LaundroSwipe mobile app. Enable notifications in the app to receive them.</p>
                  </div>
                <div className="pmi" onClick={() => go('my-bills')}>
                  <div className="pmic bl2">🧾</div>
                  <span>My bills</span>
                </div>
                <div className="pmi" onClick={() => go('edit-profile')}>
                  <div className="pmic bl2">📋</div>
                  <span>Edit profile</span>
                </div>
                <div className="pmi" onClick={() => go('notifications')}>
                  <div className="pmic tl3">🔔</div>
                  <span>Notifications</span>
                </div>
                <button type="button" className="btn bout bbl" style={{ marginTop: 24 }} onClick={handleLogout}>
                  Sign out
                </button>
              </>
            )}
          </div>
        </main>
        <nav className="bn">
          <button type="button" className={`ni ${tab === 'home' ? 'a' : ''}`} onClick={() => go('home')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            Home
          </button>
          <button type="button" className={`ni ${tab === 'schedule' ? 'ct a' : ''}`} onClick={goToSchedule}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            Schedule
          </button>
          <button type="button" className={`ni ${tab === 'orders' ? 'a' : ''}`} onClick={() => go('orders')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>
            Orders
          </button>
          <button type="button" className={`ni ${tab === 'profile' ? 'a' : ''}`} onClick={() => go('profile')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            Profile
          </button>
        </nav>
        {showStudentDetailsModal && user && (
          <div
            className="bill-popup-overlay"
            onClick={() => !studentModalSaving && setShowStudentDetailsModal(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Student details required"
          >
            <div className="bill-popup-card" onClick={(e) => e.stopPropagation()} style={{ borderRadius: 24, padding: 24, maxWidth: 420 }}>
              <h3 style={{ fontFamily: 'var(--fd)', fontSize: 18, margin: '0 0 8px', color: 'var(--b)' }}>Campus details required</h3>
              <p style={{ fontSize: 14, color: 'var(--ts)', lineHeight: 1.6, marginBottom: 18 }}>
                Add your registration number, hostel block, and room number for billing and pickup. You won&apos;t be asked again after you save.
              </p>
              <form onSubmit={handleSaveStudentDetailsModal}>
                {needsStudentCollegeChoice(user) ? (
                  <div className="fg">
                    <label className="fl">College</label>
                    <select className="fi fs" value={modalCid} onChange={(e) => setModalCid(e.target.value)} required>
                      <option value="">Select college</option>
                      {COLLEGES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {!c.active ? ' (coming soon)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="vd" style={{ marginBottom: 14 }}>
                    <strong>College:</strong> {COLLEGES.find((c) => c.id === user.cid)?.name ?? user.cid ?? '—'}
                  </p>
                )}
                <div className="fg">
                  <label className="fl">Registration number</label>
                  <input className="fi" value={modalRn} onChange={(e) => setModalRn(e.target.value)} placeholder="Reg no" required />
                </div>
                <div className="fg">
                  <label className="fl">Hostel block</label>
                  <input className="fi" value={modalBlk} onChange={(e) => setModalBlk(e.target.value)} placeholder="e.g. D2" required />
                </div>
                <div className="fg">
                  <label className="fl">Room number</label>
                  <input className="fi" value={modalRm} onChange={(e) => setModalRm(e.target.value)} placeholder="e.g. 405" required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  <button type="submit" className="btn bp bbl" disabled={studentModalSaving}>
                    {studentModalSaving ? 'Saving…' : 'Save and continue'}
                  </button>
                  <button type="button" className="btn bout bbl" disabled={studentModalSaving} onClick={() => setShowStudentDetailsModal(false)}>
                    Later
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {viewingBill && (
          <div className="bill-popup-overlay" onClick={() => setViewingBill(null)} role="dialog" aria-modal="true" aria-label="View bill">
            <div className="bill-popup-card" onClick={(e) => e.stopPropagation()} style={{ borderRadius: 24, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--b)' }}>Bill #{viewingBill.order_token}</h3>
                <button type="button" className="btn bout bsm" onClick={() => setViewingBill(null)} aria-label="Close">Close</button>
              </div>
              <div style={{ maxHeight: 'min(70vh, 560px)', overflowY: 'auto', display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <ThermalReceipt data={vendorBillRowToThermalReceiptData(viewingBill)} showPrintButton />
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ts)', lineHeight: 1.4 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <p style={{ textAlign: 'right', margin: 0, fontSize: 11 }}>
                    {formatServiceFeeReceiptLine(
                      Number(viewingBill.subtotal ?? 0),
                      Number(viewingBill.convenience_fee ?? 0),
                      'inr',
                    )}
                  </p>
                  <button type="button" className="btn bout bsm" onClick={() => setShowServiceFeeInfo(true)} aria-label="Service fee details">
                    <CircleHelp size={14} />
                  </button>
                </div>
                <p style={{ textAlign: 'right', fontSize: 10, color: 'var(--ts)', marginBottom: 0 }}>{SERVICE_FEE_SHORT_EXPLANATION}</p>
              </div>
            </div>
          </div>
        )}
        {viewingVendor && (
          <div className="bill-popup-overlay" onClick={() => setViewingVendor(null)} role="dialog" aria-modal="true" aria-label="Vendor info">
            <div className="bill-popup-card stitch-service-detail-modal" onClick={(e) => e.stopPropagation()} style={{ borderRadius: 24, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {viewingVendor.logo_url ? (
                    <img src={viewingVendor.logo_url} alt="" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 10 }} />
                  ) : (
                    <span aria-hidden style={{ width: 48, height: 48, display: 'inline-block', borderRadius: 10, background: 'rgba(23,70,162,0.06)' }} />
                  )}
                  <div>
                    <h3 style={{ fontFamily: 'var(--fd)', fontSize: 18, margin: 0, color: 'var(--b)' }}>{viewingVendor.name}</h3>
                    <p style={{ fontSize: 12, color: 'var(--ts)', marginTop: 4 }}>Vendor profile</p>
                  </div>
                </div>
                <button type="button" className="btn bout bsm" onClick={() => setViewingVendor(null)} aria-label="Close">Close</button>
              </div>
              <div className="stitch-service-detail-hero">
                <div className="stitch-service-detail-badges">
                  <span className="stitch-service-pill">Premium Partner</span>
                  <span className="stitch-service-pill stitch-service-pill-soft">Fast Pickup</span>
                </div>
                <p className="stitch-service-detail-subtitle">
                  Transparent pricing and campus-aware laundry handling with quick status updates.
                </p>
              </div>
              {viewingVendor.brief && (
                <div style={{ padding: 14, borderRadius: 16, background: 'rgba(23,70,162,0.05)', marginBottom: 16 }}>
                  <p style={{ fontSize: 14, color: 'var(--tx)', margin: 0, lineHeight: 1.6 }}>{viewingVendor.brief}</p>
                </div>
              )}
              <div className="stitch-service-detail-services">
                <p className="stitch-service-detail-label">Services</p>
                <div className="stitch-service-detail-grid">
                  {SERVICES.filter((s) => !s.comingSoon).slice(0, 4).map((s) => (
                    <div key={s.id} className="stitch-service-detail-item">
                      <span aria-hidden>{s.emoji}</span>
                      <span>{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              {viewingVendor.pricing_details && (
                <>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--b)', marginBottom: 8 }}>Pricing</p>
                  <div style={{ padding: 14, borderRadius: 16, border: '1px solid rgba(148,163,184,.28)', background: '#fff' }}>
                    <p style={{ fontSize: 13, color: 'var(--ts)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{viewingVendor.pricing_details}</p>
                  </div>
                </>
              )}
              <div className="stitch-service-detail-actions">
                <button
                  type="button"
                  className="btn bp bbl"
                  onClick={() => {
                    const v = homeVendors.find((x) => profileForVendor(x).slug === viewingVendor.slug);
                    if (v) goToScheduleWithVendor(v.id);
                    setViewingVendor(null);
                  }}
                >
                  Select this partner
                </button>
              </div>
            </div>
          </div>
        )}
        {showServiceFeeInfo && (
          <div className="bill-popup-overlay" onClick={() => setShowServiceFeeInfo(false)} role="dialog" aria-modal="true" aria-label="Service fee details">
            <div className="bill-popup-card" onClick={(e) => e.stopPropagation()} style={{ borderRadius: 24, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontFamily: 'var(--fd)', fontSize: 18, margin: 0, color: 'var(--b)' }}>Service fee</h3>
                <button type="button" className="btn bout bsm" onClick={() => setShowServiceFeeInfo(false)}>Close</button>
              </div>
              <div style={{ padding: 16, borderRadius: 18, background: 'linear-gradient(180deg, rgba(23,70,162,0.08), rgba(23,70,162,0.02))', marginBottom: 14 }}>
                <p style={{ fontSize: 14, color: 'var(--tx)', lineHeight: 1.6, margin: 0 }}>{SERVICE_FEE_SHORT_EXPLANATION}</p>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 16, border: '1px solid rgba(148,163,184,.28)' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--b)', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '.04em' }}>Why it is charged</p>
                  <p style={{ fontSize: 13, color: 'var(--ts)', lineHeight: 1.6, margin: 0 }}>{SERVICE_FEE_TERMS_EXPLANATION}</p>
                </div>
                <div style={{ padding: 14, borderRadius: 16, border: '1px solid rgba(148,163,184,.28)' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--b)', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '.04em' }}>Current fee slabs</p>
                  <p style={{ fontSize: 13, color: 'var(--ts)', lineHeight: 1.6, margin: 0 }}>{formatServiceFeeTiers()}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        {showTermsModal && (
          <div className="bill-popup-overlay" onClick={() => !termsSaving && setShowTermsModal(false)} role="dialog" aria-modal="true" aria-label="Accept Terms & Conditions">
            <div className="bill-popup-card" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                <div className="pmic bl2" style={{ flexShrink: 0 }}>
                  <FileText size={18} />
                </div>
                <div>
                  <h3 style={{ fontFamily: 'var(--fd)', fontSize: 18, margin: 0, color: 'var(--b)' }}>Accept the latest Terms &amp; Conditions</h3>
                  <p style={{ fontSize: 13, color: 'var(--ts)', marginTop: 6, lineHeight: 1.6 }}>
                    Before placing an order, please accept the latest Terms &amp; Conditions. They explain the Service fee and how vendor laundry charges are billed separately.
                  </p>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 12 }}>
                Current version: <strong>{CURRENT_TERMS_VERSION}</strong>
              </p>
              <p style={{ marginBottom: 16 }}>
                <Link href="/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--b)', fontWeight: 600 }}>
                  Read Terms &amp; Conditions
                </Link>
              </p>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--tx)', lineHeight: 1.5, marginBottom: 18 }}>
                <input
                  type="checkbox"
                  checked={termsChecked}
                  onChange={(e) => setTermsChecked(e.target.checked)}
                  disabled={termsSaving}
                  style={{ marginTop: 3 }}
                />
                <span>I agree to the Terms &amp; Conditions.</span>
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn bp bbl" disabled={termsSaving || !termsChecked} onClick={handleAcceptLatestTerms} style={{ flex: 1 }}>
                  {termsSaving ? 'Saving…' : 'Accept'}
                </button>
                <button type="button" className="btn bout bbl" disabled={termsSaving} onClick={() => setShowTermsModal(false)} style={{ flex: 1 }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {toast && (
          <div className={`toast ${toast.type ?? ''}`}>
            {toast.msg}
          </div>
        )}
      </>
    );
  }

  return null;
}
