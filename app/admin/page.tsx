'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { COLLEGES } from '@/lib/constants';
import { formatServiceFeeTiers } from '@/lib/fees';
import type { OrderRow, UserRow } from '@/lib/api';

const STATUSES = ['scheduled', 'agent_assigned', 'picked_up', 'processing', 'ready', 'out_for_delivery', 'delivered'];
const STATUS_LABELS = ['Scheduled', 'Agent Assigned', 'Picked Up', 'Processing', 'Ready', 'Out for Delivery', 'Delivered'];

/** Builds the gate pass letter HTML (LaundroSwipe letterhead only, no ProFab). */
function getGatePassLetterHtml(vendorName: string, orderCount: number): string {
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const ordersText = orderCount !== 1 ? `${orderCount} pickup orders` : '1 pickup order';
  const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Permission Letter</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Georgia,'Times New Roman',serif;background:#fff;color:#1e293b;padding:32px;max-width:600px;margin:0 auto;font-size:14px}
  .letterhead{text-align:center;padding:32px 24px 24px;border-bottom:2px solid #1746a2}
  .logo-text{font-size:28px;font-weight:700;color:#1746a2;letter-spacing:-.02em;margin-bottom:6px}
  .tagline{font-size:12px;color:#64748b;margin-bottom:8px}
  .website{font-size:11px;color:#94a3b8;letter-spacing:.02em}
  .rule{height:0;border-bottom:1px solid #e2e8f0;margin-top:18px}
  .ref{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin:28px 0 10px}
  .date{font-size:13px;color:#64748b;margin:0 0 22px}
  .subject{font-size:18px;font-weight:700;margin:0 0 22px;color:#0f172a}
  .body{font-size:14px;line-height:1.8}
  .body p{margin-bottom:16px}
  .signoff{margin-top:32px;padding-bottom:40px}
  .regards{font-size:14px;font-weight:600;margin-bottom:8px}
  .team{font-size:16px;font-weight:700;color:#1746a2;margin-bottom:12px}
  .contact{font-size:13px;color:#64748b;margin:4px 0}
</style>
</head>
<body>
  <header class="letterhead">
    <div class="logo-text">LaundroSwipe</div>
    <div class="tagline">Your Laundry Sorted in One Swipe</div>
    <div class="website">www.laundroswipe.com</div>
    <div class="rule"></div>
  </header>
  <p class="ref">To be shown at the gate</p>
  <p class="date">Date: ${esc(date)}</p>
  <h2 class="subject">Permission Letter for Campus Entry</h2>
  <div class="body">
    <p>To whom it may concern,</p>
    <p>This is to certify that <strong>${esc(vendorName)}</strong> are official partners of <strong>LaundroSwipe</strong> (LaundroSwipe.com).</p>
    <p>They have received <strong>${ordersText}</strong> from students and are here to drop off the clothes. We request you to please allow these vendors to pass through the gate so they can complete the deliveries and carry out their work properly.</p>
    <p>Kindly extend your cooperation.</p>
  </div>
  <div class="signoff">
    <p class="regards">With regards,</p>
    <p class="team">Team LaundroSwipe</p>
    <p class="contact">Phone: +91 90744 17293</p>
    <p class="contact">Email: support@laundroswipe.com</p>
  </div>
</body>
</html>`;
}

/**
 * Prints or saves as PDF the gate pass letter only (no admin UI).
 * Uses a hidden iframe so it works without popups (PWA, mobile, strict browsers).
 */
function printGatePassLetter(vendorName: string, orderCount: number) {
  const html = getGatePassLetterHtml(vendorName, orderCount);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Permission Letter');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    alert('Unable to open print. Please try again or allow pop-ups for this site.');
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const printWindow = iframe.contentWindow;
  if (!printWindow) {
    document.body.removeChild(iframe);
    return;
  }

  const cleanup = () => {
    try {
      if (iframe.parentNode) document.body.removeChild(iframe);
    } catch (_) {}
  };

  if (typeof printWindow.onafterprint !== 'undefined') {
    printWindow.onafterprint = cleanup;
  }

  const doPrint = () => {
    try {
      printWindow.print();
    } catch (e) {
      cleanup();
      alert('Print failed. Try allowing pop-ups for this site and use Print / Save as PDF again.');
    }
  };

  if (iframe.contentDocument?.readyState === 'complete') {
    doPrint();
  } else {
    iframe.onload = () => {
      doPrint();
    };
    setTimeout(doPrint, 500);
  }
}

type OrderWithUser = OrderRow & { user?: string };
type Tab =
  | 'orders'
  | 'users'
  | 'colleges'
  | 'schedule'
  | 'notifications'
  | 'vendor'
  | 'gatepass'
  | 'settings'
  | 'area_requests';
type AdminRole = 'super_admin' | 'vendor';
type VendorId = string;

type ScheduleSlot = { id: string; label: string; time_from: string; time_to: string; sort_order: number; active: boolean };
type ScheduleDateRow = { date: string; enabled: boolean; slot_ids: string[] };
type AdminNotification = { id: string; title: string; body: string | null; sent_at: string | null; scheduled_at: string | null; created_at: string };
type VendorSummary = { id: string; slug: string; name: string; active: boolean };
type ServiceArea = { id: string; name: string; short_code: string; city: string | null; state: string | null; is_active: boolean };
type LocationRequestRow = {
  id: string;
  created_at: string;
  location_text: string;
  lat: number | null;
  lng: number | null;
  contact_email: string | null;
  source: string | null;
};

/** Default labels/times when adding a slot from order-history suggestions. */
const SLOT_SUGGEST_PRESETS: Record<string, { label: string; time_from: string; time_to: string }> = {
  afternoon: { label: 'Afternoon (12–4 PM)', time_from: '12:00', time_to: '16:00' },
  evening: { label: 'Evening (4–8 PM)', time_from: '16:00', time_to: '20:00' },
  morning: { label: 'Morning (8 AM–12 PM)', time_from: '08:00', time_to: '12:00' },
};

function sanitizeSuggestedSlotId(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return s || 'custom_slot';
}

function presetForSuggestedSlot(id: string): { label: string; time_from: string; time_to: string } {
  if (SLOT_SUGGEST_PRESETS[id]) return SLOT_SUGGEST_PRESETS[id];
  const label = id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { label, time_from: '10:00', time_to: '14:00' };
}

const TAB_FROM_QUERY: Tab[] = [
  'orders',
  'users',
  'colleges',
  'schedule',
  'notifications',
  'vendor',
  'gatepass',
  'settings',
  'area_requests',
];

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<AdminRole>('vendor');
  const [vendorId, setVendorId] = useState<VendorId | null>(null);
  const [registerVendorEmail, setRegisterVendorEmail] = useState('');
  const [registerVendorPassword, setRegisterVendorPassword] = useState('');
  const [registerVendorSlug, setRegisterVendorSlug] = useState('');
  const [registerJoinCode, setRegisterJoinCode] = useState('');
  const [registerVendorSaving, setRegisterVendorSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vendorDisplayName, setVendorDisplayName] = useState('');
  const [err, setErr] = useState('');
  const [orders, setOrders] = useState<OrderWithUser[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [bills, setBills] = useState<{
    count: number;
    /** Sum of each bill’s final total (what customers paid). */
    totalRevenue: number;
    /** Sum of line-item amounts only (excludes service fee). */
    subtotalExcludingFees: number;
    /** Sum of convenience_fee across saved bills. */
    totalConvenienceFee: number;
  }>({ count: 0, totalRevenue: 0, subtotalExcludingFees: 0, totalConvenienceFee: 0 });
  const [tab, setTab] = useState<Tab>('orders');
  const [filter, setFilter] = useState('all');
  const [superVendorFilter, setSuperVendorFilter] = useState('all');
  const [orderAreaFilter, setOrderAreaFilter] = useState('all');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [scheduleDates, setScheduleDates] = useState<ScheduleDateRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleVendorSlug, setScheduleVendorSlug] = useState('');
  const [scheduleSuggestions, setScheduleSuggestions] = useState<{
    slot_counts: { time_slot: string; count: number }[];
    dow_counts: { dow: number; label: string; count: number }[];
  } | null>(null);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  const [notifyScheduledAt, setNotifyScheduledAt] = useState('');
  const [notifySending, setNotifySending] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([]);
  const [adminNotificationsLoading, setAdminNotificationsLoading] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorBrief, setVendorBrief] = useState('');
  const [vendorPricing, setVendorPricing] = useState('');
  const [vendorLogoUrl, setVendorLogoUrl] = useState('');
  const [vendorProfileSlug, setVendorProfileSlug] = useState('');
  const [vendorProfileLoading, setVendorProfileLoading] = useState(false);
  const [vendorProfileSaving, setVendorProfileSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isSuperAdmin = role === 'super_admin';
  const [vendorsList, setVendorsList] = useState<VendorSummary[]>([]);
  const [areasList, setAreasList] = useState<ServiceArea[]>([]);
  const [vendorStats, setVendorStats] = useState<Array<{ vendorName: string; total: number }>>([]);
  const [newVendorSlug, setNewVendorSlug] = useState('');
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorSaving, setNewVendorSaving] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaCode, setNewAreaCode] = useState('');
  const [newAreaCity, setNewAreaCity] = useState('');
  const [newAreaState, setNewAreaState] = useState('');
  const [newAreaSaving, setNewAreaSaving] = useState(false);
  const [areaRequests, setAreaRequests] = useState<LocationRequestRow[]>([]);
  const [areaRequestsLoading, setAreaRequestsLoading] = useState(false);
  const [areaRequestsError, setAreaRequestsError] = useState<string | null>(null);
  const dashboardTitle = isSuperAdmin
    ? 'LaundroSwipe Super Admin'
    : `${vendorDisplayName || vendorsList.find((v) => v.slug === vendorId)?.name || vendorId || 'Vendor'} Dashboard`;

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const n = localStorage.getItem('admin_vendor_name');
    if (n) setVendorDisplayName(n);
  }, []);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('admin_logged') : null;
    const savedRole = typeof window !== 'undefined' ? localStorage.getItem('admin_role') : null;
    const savedVendorId = typeof window !== 'undefined' ? localStorage.getItem('admin_vendor_id') : null;
    if (savedRole === 'super_admin' || savedRole === 'vendor') setRole(savedRole);
    if (savedVendorId) setVendorId(savedVendorId);
    if (saved === 'true') setLoggedIn(true);
  }, []);

  useEffect(() => {
    if (!loggedIn || typeof window === 'undefined') return;
    const savedRole = localStorage.getItem('admin_role');
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab') as Tab | null;
    const qs = params.get('userSearch');
    if (t && TAB_FROM_QUERY.includes(t)) {
      if (t === 'users' && savedRole !== 'super_admin') {
        /* vendors cannot open Users tab from URL */
      } else if (
        (t === 'colleges' ||
          t === 'notifications' ||
          t === 'gatepass' ||
          t === 'settings' ||
          t === 'area_requests') &&
        savedRole !== 'super_admin'
      ) {
        /* vendors: schedule allowed; other super-only tabs blocked */
      } else {
        setTab(t);
      }
    }
    if (qs != null && qs !== '') setUserSearch(qs);
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn || !isSuperAdmin || tab !== 'area_requests') return;

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
    const headers = token ? ({ Authorization: `Bearer ${token}` } as Record<string, string>) : {};

    setAreaRequestsLoading(true);
    setAreaRequestsError(null);
    fetch('/api/admin/location-requests', { credentials: 'include', headers })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.status === 401) return { unauthorized: true as const };
        if (!r.ok) return { error: (data as { error?: string })?.error ?? 'Failed to load' };
        return { requests: (data as { requests?: LocationRequestRow[] }).requests ?? [] };
      })
      .then((result) => {
        if (result && 'unauthorized' in result) return;
        if (result && 'error' in result) {
          setAreaRequestsError(result.error ?? 'Failed to load');
          setAreaRequests([]);
          return;
        }
        if (result && 'requests' in result) setAreaRequests(result.requests);
      })
      .catch(() => {
        setAreaRequestsError('Failed to load');
        setAreaRequests([]);
      })
      .finally(() => setAreaRequestsLoading(false));
  }, [loggedIn, isSuperAdmin, tab]);

  useEffect(() => {
    if (!loggedIn) return;
    setLoading(true);

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
    const headers = token ? ({ Authorization: `Bearer ${token}` } as Record<string, string>) : {};

    fetch('/api/admin/overview', { credentials: 'include', headers })
      .then(async (r) => {
        if (r.status === 401) {
          sessionStorage.removeItem('admin_token');
          localStorage.removeItem('admin_logged');
          setLoggedIn(false);
          return null;
        }
        const data = await r.json().catch(() => ({}));
        if (!data?.orders || !data?.users) return null;
        return data as {
          orders: OrderRow[] & { vendor_slug?: string | null }[];
          users: UserRow[];
          vendor_bills: any[];
          vendors?: VendorSummary[];
        };
      })
      .then((data) => {
        if (!data) return;
        const { orders: ords, users: us, vendor_bills: billList, vendors: vendorsFromOverview } = data;
        if (Array.isArray(vendorsFromOverview)) setVendorsList(vendorsFromOverview);

        const userMap = new Map<string, UserRow>();
        (us ?? []).forEach((u) => userMap.set(u.id, u));
        setUsers(us ?? []);

        const withUser = (ords ?? []).map((o: any) => ({
          ...o,
          user: userMap.get(o.user_id ?? '')?.full_name ?? userMap.get(o.user_id ?? '')?.email ?? '—',
        }));

        const vendorScopedOrders = !isSuperAdmin && vendorId
          ? withUser.filter((o: any) => String(o.vendor_slug ?? '').toLowerCase() === String(vendorId).toLowerCase())
          : withUser;

        setOrders(vendorScopedOrders as any);
        const orderIds = new Set(vendorScopedOrders.map((o: any) => o.id));

        let bl = !isSuperAdmin
          ? (billList ?? []).filter((b: any) => {
              if (b.order_id) return orderIds.has(b.order_id);
              return String(b.vendor_slug ?? '').toLowerCase() === String(vendorId ?? '').toLowerCase();
            })
          : (billList ?? []);

        if (isSuperAdmin && superVendorFilter !== 'all') {
          const sv = superVendorFilter.toLowerCase();
          const scopedOrderIds = new Set(
            vendorScopedOrders
              .filter((o: any) => {
                const ov = String(o.vendor_slug ?? '').toLowerCase();
                return ov === sv || ov.includes(sv);
              })
              .map((o: any) => o.id),
          );

          bl = bl.filter((b: any) => {
            const bv = String(b.vendor_slug ?? '').toLowerCase();
            return (b.order_id ? scopedOrderIds.has(b.order_id) : false) || bv === sv || bv.includes(sv);
          });
        }

        const vendorTotals = new Map<string, number>();
        bl.forEach((b: any) => {
          const key = String(b.vendor_name ?? 'Unassigned');
          vendorTotals.set(key, (vendorTotals.get(key) ?? 0) + (Number(b.total) || 0));
        });

        setVendorStats(
          Array.from(vendorTotals.entries())
            .map(([vendorName, total]) => ({ vendorName, total }))
            .sort((a, b) => b.total - a.total),
        );

        const agg = bl.reduce(
          (acc: any, b: any) => {
            const sub = Number(b.subtotal) || 0;
            const conv = Number(b.convenience_fee) || 0;
            const tot = Number(b.total) || 0;
            return {
              subtotalExcludingFees: acc.subtotalExcludingFees + sub,
              totalConvenienceFee: acc.totalConvenienceFee + conv,
              totalRevenue: acc.totalRevenue + tot,
            };
          },
          { subtotalExcludingFees: 0, totalConvenienceFee: 0, totalRevenue: 0 },
        );

        setBills({ count: bl.length, ...agg });
      })
      .finally(() => setLoading(false));
  }, [loggedIn, isSuperAdmin, vendorId, superVendorFilter]);

  useEffect(() => {
    if (!loggedIn || tab !== 'schedule') return;
    if (isSuperAdmin && !scheduleVendorSlug) {
      setScheduleSlots([]);
      setScheduleDates([]);
      setScheduleSuggestions(null);
      setScheduleLoading(false);
      return;
    }
    setScheduleLoading(true);
    setScheduleSuggestions(null);
    const headers = adminAuthHeaders();
    const scheduleQuery = isSuperAdmin && scheduleVendorSlug
      ? `?vendor=${encodeURIComponent(scheduleVendorSlug)}`
      : '';
    Promise.all([
      fetch(`/api/admin/schedule${scheduleQuery}`, { credentials: 'include', headers }),
      fetch(`/api/admin/schedule/suggestions${scheduleQuery}`, { credentials: 'include', headers }),
    ])
      .then(async ([schedRes, sugRes]) => {
        const schedData = await schedRes.json().catch(() => ({}));
        const sugData = await sugRes.json().catch(() => ({}));
        if (schedRes.status === 401) {
          sessionStorage.removeItem('admin_token');
          localStorage.removeItem('admin_logged');
          setLoggedIn(false);
          return;
        }
        if (schedData.slots) setScheduleSlots(schedData.slots);
        if (schedData.dates) setScheduleDates(schedData.dates);
        if (sugRes.ok && sugData?.slot_counts && sugData?.dow_counts) {
          setScheduleSuggestions({
            slot_counts: sugData.slot_counts,
            dow_counts: sugData.dow_counts,
          });
        }
      })
      .catch(() => {
        setScheduleSlots([]);
        setScheduleSuggestions(null);
      })
      .finally(() => setScheduleLoading(false));
  }, [loggedIn, tab, isSuperAdmin, scheduleVendorSlug]);

  useEffect(() => {
    if (!loggedIn || tab !== 'notifications') return;
    setAdminNotificationsLoading(true);
    fetch('/api/admin/notifications', { credentials: 'include', headers: adminAuthHeaders() })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.status === 401) {
          sessionStorage.removeItem('admin_token');
          localStorage.removeItem('admin_logged');
          setLoggedIn(false);
          return;
        }
        if (data.notifications) setAdminNotifications(data.notifications);
      })
      .catch(() => setAdminNotifications([]))
      .finally(() => setAdminNotificationsLoading(false));
  }, [loggedIn, tab]);

  useEffect(() => {
    if (!loggedIn || tab !== 'vendor') return;
    setVendorProfileLoading(true);
    const profileUrl = isSuperAdmin
      ? `/api/admin/vendor-profile?slug=${encodeURIComponent(vendorProfileSlug)}`
      : '/api/admin/vendor-profile';
    fetch(profileUrl, { credentials: 'include', headers: adminAuthHeaders() })
      .then((r) => {
        if (r.status === 401) {
          sessionStorage.removeItem('admin_token');
          localStorage.removeItem('admin_logged');
          setLoggedIn(false);
          return null;
        }
        return r.json().catch(() => null);
      })
      .then((data) => {
        if (data && !data.error) {
          setVendorName(data.name ?? '');
          setVendorBrief(data.brief ?? '');
          setVendorPricing(data.pricing_details ?? '');
          setVendorLogoUrl(data.logo_url ?? '');
        }
      })
      .catch(() => {})
      .finally(() => setVendorProfileLoading(false));
  }, [loggedIn, tab, isSuperAdmin, vendorProfileSlug]);

  useEffect(() => {
    if (role === 'vendor' && vendorId) setVendorProfileSlug(vendorId);
    if (role === 'vendor') setOrderAreaFilter('vit-chn');
  }, [role, vendorId]);

  useEffect(() => {
    if (!loggedIn || !isSuperAdmin || !['settings', 'vendor'].includes(tab)) return;
    Promise.all([
      fetch('/api/admin/vendors', { credentials: 'include', headers: adminAuthHeaders() }).then((r) => r.json().catch(() => ({}))),
      fetch('/api/admin/service-areas', { credentials: 'include', headers: adminAuthHeaders() }).then((r) => r.json().catch(() => ({}))),
    ]).then(([v, a]) => {
      if (Array.isArray(v?.vendors)) setVendorsList(v.vendors);
      if (Array.isArray(a?.areas)) setAreasList(a.areas);
    }).catch(() => {});
  }, [loggedIn, isSuperAdmin, tab]);

  useEffect(() => {
    if (!loggedIn || !isSuperAdmin) return;
    fetch('/api/admin/vendors', { credentials: 'include', headers: adminAuthHeaders() })
      .then((r) => r.json().catch(() => ({})))
      .then((v) => {
        if (Array.isArray(v?.vendors)) setVendorsList(v.vendors);
      })
      .catch(() => {});
  }, [loggedIn, isSuperAdmin]);

  useEffect(() => {
    if (vendorsList.length === 0) return;
    setRegisterVendorSlug((prev) => (prev && vendorsList.some((v) => v.slug === prev) ? prev : vendorsList[0].slug));
  }, [vendorsList]);

  useEffect(() => {
    if (!isSuperAdmin || vendorsList.length === 0) return;
    setVendorProfileSlug((prev) => (prev && vendorsList.some((v) => v.slug === prev) ? prev : vendorsList[0].slug));
  }, [isSuperAdmin, vendorsList]);

  useEffect(() => {
    if (!isSuperAdmin || vendorsList.length === 0) return;
    setScheduleVendorSlug((prev) => (prev && vendorsList.some((v) => v.slug === prev) ? prev : vendorsList[0].slug));
  }, [isSuperAdmin, vendorsList]);

  const showToast = (msg: string, type: string) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('admin_logged', 'true');
          localStorage.setItem('admin_role', data.role === 'super_admin' ? 'super_admin' : 'vendor');
          if (data.vendorId) localStorage.setItem('admin_vendor_id', data.vendorId);
          else localStorage.removeItem('admin_vendor_id');
          if (typeof data.vendorDisplayName === 'string' && data.vendorDisplayName) {
            localStorage.setItem('admin_vendor_name', data.vendorDisplayName);
            setVendorDisplayName(data.vendorDisplayName);
          } else {
            localStorage.removeItem('admin_vendor_name');
            setVendorDisplayName('');
          }
          if (data.token) sessionStorage.setItem('admin_token', data.token);
        }
        setRole(data.role === 'super_admin' ? 'super_admin' : 'vendor');
        setVendorId(typeof data.vendorId === 'string' ? data.vendorId : null);
        setLoggedIn(true);
      } else {
        setErr(data?.error || 'Invalid email or password');
      }
    } catch {
      setErr('Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_logged');
    localStorage.removeItem('admin_role');
    localStorage.removeItem('admin_vendor_id');
    localStorage.removeItem('admin_vendor_name');
    sessionStorage.removeItem('admin_token');
    setVendorDisplayName('');
    setLoggedIn(false);
  };

  const adminAuthHeaders = (): Record<string, string> => {
    const t = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const applySuggestedSlot = (timeSlotRaw: string) => {
    const id = sanitizeSuggestedSlotId(timeSlotRaw);
    const preset = presetForSuggestedSlot(id);
    setScheduleSlots((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const maxOrd = prev.reduce((m, s) => Math.max(m, s.sort_order ?? 0), -1);
      if (idx < 0) {
        return [
          ...prev,
          {
            id,
            label: preset.label,
            time_from: `${preset.time_from}:00`,
            time_to: `${preset.time_to}:00`,
            sort_order: maxOrd + 1,
            active: true,
          },
        ];
      }
      return prev.map((s, i) =>
        i === idx ? { ...s, active: true, label: s.label?.trim() ? s.label : preset.label } : s,
      );
    });
    setScheduleDates((prev) =>
      prev.map((d) => {
        if (!d.enabled) return d;
        if (d.slot_ids.includes(id)) return d;
        return { ...d, slot_ids: [...d.slot_ids, id] };
      }),
    );
    showToast(`“${preset.label}” added — click Save schedule to publish.`, 'ok');
  };

  const advanceStatus = async (orderId: string) => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
    const headers = token
      ? ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } as Record<string, string>)
      : { 'Content-Type': 'application/json' };

    try {
      const res = await fetch('/api/admin/orders/advance', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        sessionStorage.removeItem('admin_token');
        localStorage.removeItem('admin_logged');
        setLoggedIn(false);
        showToast('Session expired. Log in again.', 'er');
        return;
      }
      if (res.ok && data?.order?.status) {
        setOrders((prev) => prev.map((o: any) => (o.id === orderId ? { ...o, status: data.order.status } : o)));
        showToast('Status updated', 'ok');
      } else {
        showToast(data?.error || 'Update failed', 'er');
      }
    } catch {
      showToast('Update failed', 'er');
    }
  };

  const statusBadge = (s: string) => {
    if (['scheduled', 'agent_assigned'].includes(s)) return 'b-sch';
    if (s === 'delivered') return 'b-del';
    return 'b-pro';
  };
  const statusLabel = (s: string) => {
    const i = STATUSES.indexOf(s);
    return STATUS_LABELS[i] ?? s;
  };

  const escapeCsv = (v: string | number | null | undefined): string => {
    const s = v == null ? '' : String(v);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const exportUsersToCsv = () => {
    const cols = ['ID', 'Full name', 'Email', 'Phone', 'WhatsApp', 'Type', 'College', 'Reg No', 'Hostel', 'Year'];
    const rows = (users ?? []).map((u) => [
      escapeCsv(u.display_id ?? u.id),
      escapeCsv(u.full_name),
      escapeCsv(u.email),
      escapeCsv(u.phone),
      escapeCsv(u.whatsapp),
      escapeCsv(u.user_type),
      escapeCsv(u.college_id ? (COLLEGES.find((c) => c.id === u.college_id)?.name ?? u.college_id) : ''),
      escapeCsv(u.reg_no),
      escapeCsv(u.hostel_block),
      escapeCsv(u.year),
    ]);
    const csv = [cols.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `laundroswipe-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Users exported', 'ok');
  };

  const areaScopedOrders = orderAreaFilter === 'all'
    ? orders
    : orders.filter((o) => users.find((u) => u.id === o.user_id)?.college_id === orderAreaFilter);
  const vendorScopedForSuperAdmin = isSuperAdmin && superVendorFilter !== 'all'
    ? areaScopedOrders.filter((o) => {
        const ov = String((o as { vendor_id?: string | null; vendor_name?: string | null }).vendor_id ?? (o as { vendor_name?: string | null }).vendor_name ?? '').toLowerCase();
        const sv = superVendorFilter.toLowerCase();
        return ov === sv || ov.includes(sv);
      })
    : areaScopedOrders;
  const filtered = filter === 'all' ? vendorScopedForSuperAdmin : vendorScopedForSuperAdmin.filter((o) => o.status === filter);
  const usersByVisibleOrders = new Set(vendorScopedForSuperAdmin.map((o) => o.user_id).filter(Boolean));
  const filteredUsers = (users ?? []).filter((u) => {
    if (isSuperAdmin && superVendorFilter !== 'all' && !usersByVisibleOrders.has(u.id)) return false;
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return [u.id, u.display_id, u.full_name, u.email, u.phone, u.college_id, u.reg_no, u.hostel_block]
      .some((v) => String(v ?? '').toLowerCase().includes(q));
  });
  const totalOrders = vendorScopedForSuperAdmin.length;
  const active = vendorScopedForSuperAdmin.filter((o) => o.status !== 'delivered').length;
  const delivered = vendorScopedForSuperAdmin.filter((o) => o.status === 'delivered').length;
  const billsGenerated = bills.count;
  const tokensGenerated = totalOrders;
  const { totalRevenue, subtotalExcludingFees, totalConvenienceFee } = bills;
  const vitChennaiOrderCount = vendorScopedForSuperAdmin.filter((o) => users.find((u) => u.id === o.user_id)?.college_id === 'vit-chn').length;

  const gatePassVendorLabel =
    !isSuperAdmin
      ? vendorDisplayName || vendorsList.find((v) => v.slug === vendorId)?.name || vendorId || 'Laundry partner'
      : superVendorFilter !== 'all'
        ? vendorsList.find((v) => v.slug === superVendorFilter)?.name ?? superVendorFilter
        : vendorsList.length > 0
          ? vendorsList.map((v) => v.name).join(' and ')
          : 'LaundroSwipe partner vendors';

  const settingsVendorLabel =
    !isSuperAdmin
      ? vendorDisplayName || vendorsList.find((v) => v.slug === vendorId)?.name || vendorId || '—'
      : vendorsList.find((v) => v.slug === vendorProfileSlug)?.name ?? vendorsList[0]?.name ?? '—';

  if (!loggedIn) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img src="/icon-192.png" alt="LaundroSwipe" style={{ height: 56, width: 56, objectFit: 'contain', margin: '0 auto 14px', borderRadius: 12, display: 'block' }} />
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 24, color: 'var(--b)' }}>LaundroSwipe Admin</h1>
            <p style={{ color: 'var(--ts)', fontSize: 13, marginTop: 6 }}>Sign in with the email and password for your account</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="fg">
              <label className="fl">Email</label>
              <input className="fi" type="email" placeholder="admin@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">Password</label>
              <input className="fi" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {err && <p style={{ color: 'var(--er)', fontSize: 13, marginTop: 8 }}>{err}</p>}
            <button type="submit" className="btn bp bbl" style={{ marginTop: 12, width: '100%' }} disabled={authLoading}>{authLoading ? 'Checking…' : 'Log In'}</button>
          </form>
        </div>
        {toast && <div className={`toast toast-dashboard ${toast.type}`}>{toast.msg}</div>}
      </div>
    );
  }

  return (
    <div className="admin-root">
      <header className="admin-header">
        <button type="button" className={`admin-hamburger ${menuOpen ? 'admin-hamburger-open' : ''}`} onClick={() => setMenuOpen((o) => !o)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
          <span className="admin-hamburger-bar" />
          <span className="admin-hamburger-bar" />
          <span className="admin-hamburger-bar" />
        </button>
        <h2 className="admin-header-title">{dashboardTitle}</h2>
      </header>

      {menuOpen && <div className="admin-drawer-overlay" onClick={closeMenu} aria-hidden />}

      <aside className={`admin-drawer ${menuOpen ? 'admin-drawer-open' : ''}`}>
        <div className="admin-drawer-head">
          <span className="admin-drawer-title">{dashboardTitle}</span>
          <button type="button" className="admin-drawer-close" onClick={closeMenu} aria-label="Close menu">×</button>
        </div>
        <nav className="admin-drawer-nav">
          <div className="admin-drawer-section">
            <span className="admin-drawer-section-label">Overview</span>
            <button type="button" onClick={() => { setTab('orders'); closeMenu(); }} className={`admin-nav-btn ${tab === 'orders' ? 'active' : ''}`}>📦 Orders</button>
            {isSuperAdmin && (
              <button type="button" onClick={() => { setTab('users'); closeMenu(); }} className={`admin-nav-btn ${tab === 'users' ? 'active' : ''}`}>👥 Users</button>
            )}
          </div>
          <div className="admin-drawer-section">
            <span className="admin-drawer-section-label">Vendor & Bills</span>
            <Link href="/admin/vendor" className="admin-nav-link" onClick={closeMenu}>🧾 Vendor / Bill</Link>
            <Link href="/admin/pickup" className="admin-nav-link" onClick={closeMenu}>📦 Pickup / Delivery</Link>
            <Link href="/admin/bills" className="admin-nav-link" onClick={closeMenu}>📋 Saved bills</Link>
            <Link href="/admin/printers" className="admin-nav-link" onClick={closeMenu}>🖨️ Printers</Link>
            {!isSuperAdmin && (
              <button type="button" onClick={() => { setTab('schedule'); closeMenu(); }} className={`admin-nav-btn ${tab === 'schedule' ? 'active' : ''}`}>
                📅 Schedule &amp; time slots
              </button>
            )}
            <button type="button" onClick={() => { setTab('vendor'); closeMenu(); }} className={`admin-nav-btn ${tab === 'vendor' ? 'active' : ''}`}>🧺 Vendor</button>
          </div>
          {isSuperAdmin && (
            <>
              <div className="admin-drawer-section">
                <span className="admin-drawer-section-label">Campus</span>
                <button type="button" onClick={() => { setTab('colleges'); closeMenu(); }} className={`admin-nav-btn ${tab === 'colleges' ? 'active' : ''}`}>🎓 Colleges</button>
                <button type="button" onClick={() => { setTab('schedule'); closeMenu(); }} className={`admin-nav-btn ${tab === 'schedule' ? 'active' : ''}`}>📅 Schedule</button>
                <button type="button" onClick={() => { setTab('notifications'); closeMenu(); }} className={`admin-nav-btn ${tab === 'notifications' ? 'active' : ''}`}>🔔 Notifications</button>
                <button type="button" onClick={() => { setTab('area_requests'); closeMenu(); }} className={`admin-nav-btn ${tab === 'area_requests' ? 'active' : ''}`}>📍 Area requests</button>
                <button type="button" onClick={() => { setTab('gatepass'); closeMenu(); }} className={`admin-nav-btn ${tab === 'gatepass' ? 'active' : ''}`}>🏫 Gate pass</button>
              </div>
              <div className="admin-drawer-section">
                <span className="admin-drawer-section-label">System</span>
                <button type="button" onClick={() => { setTab('settings'); closeMenu(); }} className={`admin-nav-btn ${tab === 'settings' ? 'active' : ''}`}>⚙️ Settings</button>
              </div>
            </>
          )}
        </nav>
        <div className="admin-drawer-foot">
          <button type="button" className="btn bout admin-drawer-logout" onClick={handleLogout}>Log out</button>
        </div>
      </aside>

      <main className="admin-main">
        {tab === 'orders' && (
          <>
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, marginBottom: 6 }}>Orders</h1>
            <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>Manage pickups and status</p>
            {!loading && (
              <div className="admin-stat-grid">
                <div className="admin-stat-card">
                  <div className="admin-stat-value" style={{ color: 'var(--b)' }}>{totalOrders}</div>
                  <div className="admin-stat-label">Orders (tokens)</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-value" style={{ color: 'var(--t)' }}>{billsGenerated}</div>
                  <div className="admin-stat-label">Bills generated</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-value" style={{ color: 'var(--ok)', fontSize: 20 }}>₹{totalRevenue.toFixed(0)}</div>
                  <div className="admin-stat-label">Total revenue (sum of bill totals)</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-value" style={{ color: 'var(--b)' }}>₹{subtotalExcludingFees.toFixed(0)}</div>
                  <div className="admin-stat-label">Laundry subtotal before service fee</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-value" style={{ color: 'var(--o)' }}>₹{totalConvenienceFee.toFixed(0)}</div>
                  <div className="admin-stat-label">Total service fee (on saved bills)</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-value" style={{ color: 'var(--o)' }}>{active}</div>
                  <div className="admin-stat-label">Active</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-value" style={{ color: 'var(--ok)' }}>{delivered}</div>
                  <div className="admin-stat-label">Delivered</div>
                </div>
                {isSuperAdmin && (
                  <div className="admin-stat-card">
                    <div className="admin-stat-value" style={{ color: 'var(--b)' }}>{users.length}</div>
                    <div className="admin-stat-label">Total users</div>
                  </div>
                )}
                {isSuperAdmin && vendorStats.slice(0, 3).map((vs) => (
                  <div className="admin-stat-card" key={vs.vendorName}>
                    <div className="admin-stat-value" style={{ color: 'var(--t)' }}>₹{vs.total.toFixed(0)}</div>
                    <div className="admin-stat-label">{vs.vendorName} sales</div>
                  </div>
                ))}
              </div>
            )}
            {!loading && (
              <div className="admin-filter-row">
                {isSuperAdmin && (
                  <select
                    className="admin-filter-btn"
                    value={superVendorFilter}
                    onChange={(e) => setSuperVendorFilter(e.target.value)}
                    style={{ minWidth: 170 }}
                  >
                    <option value="all">All vendors</option>
                    {vendorsList.map((v) => (
                      <option key={v.slug} value={v.slug}>{v.name}</option>
                    ))}
                  </select>
                )}
                <select
                  className="admin-filter-btn"
                  value={orderAreaFilter}
                  onChange={(e) => setOrderAreaFilter(e.target.value)}
                  style={{ minWidth: 170 }}
                >
                  <option value="all">All locations</option>
                  {COLLEGES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {['all', 'scheduled', 'processing', 'delivered'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`admin-filter-btn ${filter === f ? 'active' : ''}`}
                  >
                    {f === 'all' ? 'All' : statusLabel(f)}
                  </button>
                ))}
              </div>
            )}
            {loading ? (
              <>
                <div className="admin-stat-grid" aria-hidden>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="skeleton admin-skeleton-stat" />
                  ))}
                </div>
                <div className="skeleton admin-skeleton-row" />
                <div className="skeleton admin-skeleton-row" />
                <div className="skeleton admin-skeleton-row" />
                <div className="skeleton admin-skeleton-row" />
              </>
            ) : (
              <>
                <div className="admin-table-wrap">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>Order</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>Token</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>Customer</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>Status</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((o) => (
                        <tr key={o.id} style={{ borderBottom: '1px solid var(--bd)' }}>
                          <td style={{ padding: '14px 16px', fontSize: 14 }}>{o.order_number}</td>
                          <td style={{ padding: '14px 16px', fontFamily: 'var(--fd)', fontWeight: 800, color: 'var(--o)' }}>#{o.token}</td>
                          <td style={{ padding: '14px 16px', fontSize: 14 }}>{o.user}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: statusBadge(o.status) === 'b-sch' ? '#FEF3C7' : statusBadge(o.status) === 'b-del' ? '#DCFCE7' : 'var(--bl)', color: statusBadge(o.status) === 'b-sch' ? '#92400E' : statusBadge(o.status) === 'b-del' ? 'var(--ok)' : 'var(--b)' }}>{statusLabel(o.status)}</span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {o.status !== 'delivered' && (
                              <button type="button" onClick={() => advanceStatus(o.id)} className="admin-advance-btn">Advance</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length === 0 && <p style={{ textAlign: 'center', padding: 48, color: 'var(--ts)' }}>No orders</p>}
                </div>
                <div className="admin-order-cards">
                  {filtered.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: 24, color: 'var(--ts)', fontSize: 14 }}>No orders</p>
                  ) : (
                    filtered.map((o) => (
                      <div key={o.id} className="admin-order-card">
                        <div className="admin-order-card-head">
                          <span className="admin-order-card-token">#{o.token}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: statusBadge(o.status) === 'b-sch' ? '#FEF3C7' : statusBadge(o.status) === 'b-del' ? '#DCFCE7' : 'var(--bl)', color: statusBadge(o.status) === 'b-sch' ? '#92400E' : statusBadge(o.status) === 'b-del' ? 'var(--ok)' : 'var(--b)' }}>{statusLabel(o.status)}</span>
                        </div>
                        <div className="admin-order-card-meta">{o.order_number} · {o.user}</div>
                        {o.status !== 'delivered' && (
                          <div className="admin-order-card-actions">
                            <button type="button" onClick={() => advanceStatus(o.id)} className="admin-advance-btn">Advance</button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </>
        )}
        {isSuperAdmin && tab === 'users' && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div>
                <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, marginBottom: 6 }}>Users</h1>
                <p style={{ color: 'var(--ts)', fontSize: 14, margin: 0 }}>Registered app users</p>
              </div>
              <input
                type="text"
                className="fi"
                placeholder="Search by name, email, phone, ID, college..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{ minWidth: 260, flex: '1 1 280px', maxWidth: 420 }}
              />
              <button type="button" onClick={exportUsersToCsv} disabled={loading || !users?.length} className="admin-nav-btn" style={{ marginLeft: 'auto' }}>
                📥 Export to Excel
              </button>
            </div>
            {loading ? (
              <>
                <div className="skeleton admin-skeleton-row" />
                <div className="skeleton admin-skeleton-row" />
                <div className="skeleton admin-skeleton-row" />
                <div className="skeleton admin-skeleton-row" />
                <div className="skeleton admin-skeleton-row" />
              </>
            ) : (
              <>
                <div className="admin-table-wrap">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>ID</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>User</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>Email</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>Phone</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>Type</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>College</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>Reg No</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => {
                        const ini = (u.full_name ?? '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
                        const collegeName = u.college_id ? (COLLEGES.find((c) => c.id === u.college_id)?.name ?? u.college_id) : '—';
                        const displayId = u.display_id ?? '—';
                        return (
                          <tr key={u.id} style={{ borderBottom: '1px solid var(--bd)' }}>
                            <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--b)' }}>{displayId}</td>
                            <td style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--b)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, fontFamily: 'var(--fd)' }}>{ini}</div>
                              <span style={{ fontWeight: 600 }}>{u.full_name ?? '—'}</span>
                            </td>
                            <td style={{ padding: '14px 16px', fontSize: 14 }}>{u.email ?? '—'}</td>
                            <td style={{ padding: '14px 16px', fontSize: 14 }}>{u.phone ?? '—'}</td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: u.user_type === 'student' ? 'var(--ol)' : 'var(--bl)', color: u.user_type === 'student' ? 'var(--o)' : 'var(--b)' }}>{u.user_type === 'student' ? '🎓 Student' : 'General'}</span>
                            </td>
                            <td style={{ padding: '14px 16px', fontSize: 14 }}>{collegeName}</td>
                            <td style={{ padding: '14px 16px', fontSize: 14 }}>{u.reg_no ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && <p style={{ textAlign: 'center', padding: 48, color: 'var(--ts)' }}>No users found for this search.</p>}
                </div>
                <div className="admin-user-cards">
                  {(filteredUsers.length === 0) ? (
                    <p style={{ textAlign: 'center', padding: 24, color: 'var(--ts)', fontSize: 14 }}>No users found for this search.</p>
                  ) : (
                    filteredUsers.map((u) => {
                      const collegeName = u.college_id ? (COLLEGES.find((c) => c.id === u.college_id)?.name ?? u.college_id) : '—';
                      return (
                        <div key={u.id} className="admin-user-card">
                          <div className="admin-user-card-name">{u.full_name ?? '—'}</div>
                          <div className="admin-user-card-email">{u.email ?? '—'}</div>
                          <div className="admin-user-card-extra">{u.phone ?? '—'} · {u.user_type === 'student' ? 'Student' : 'General'} · {collegeName}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </>
        )}
        {isSuperAdmin && tab === 'area_requests' && (
          <>
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, marginBottom: 6 }}>Area activation requests</h1>
            <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>
              Submissions when users choose Other in schedule and request a new area. Stored in <code style={{ fontSize: 13 }}>location_requests</code>.
            </p>
            {areaRequestsLoading ? (
              <p style={{ color: 'var(--ts)' }}>Loading…</p>
            ) : areaRequestsError ? (
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: '#FEF3C7',
                  color: '#92400E',
                  fontSize: 14,
                  marginBottom: 16,
                }}
              >
                {areaRequestsError}. If the table is missing, run the migration{' '}
                <code style={{ fontSize: 12 }}>supabase/migrations/20260317_create_location_requests.sql</code> in Supabase.
              </div>
            ) : areaRequests.length === 0 ? (
              <p style={{ textAlign: 'center', padding: 48, color: 'var(--ts)' }}>No requests yet.</p>
            ) : (
              <div className="admin-table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>
                        When
                      </th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>
                        Request
                      </th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>
                        Email
                      </th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>
                        Source
                      </th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>
                        Map
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {areaRequests.map((row) => {
                      const when = row.created_at ? new Date(row.created_at).toLocaleString() : '—';
                      const mapHref =
                        row.lat != null && row.lng != null
                          ? `https://www.google.com/maps?q=${row.lat},${row.lng}`
                          : null;
                      return (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--bd)' }}>
                          <td style={{ padding: '14px 16px', color: 'var(--ts)', fontSize: 13, whiteSpace: 'nowrap' }}>{when}</td>
                          <td style={{ padding: '14px 16px', maxWidth: 360, fontSize: 14 }}>{row.location_text}</td>
                          <td style={{ padding: '14px 16px', fontSize: 13 }}>{row.contact_email ?? '—'}</td>
                          <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--ts)' }}>
                            {row.source ?? '—'}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {mapHref ? (
                              <a href={mapHref} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--b)' }}>
                                Open
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        {tab === 'colleges' && (
          <>
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, marginBottom: 6 }}>Colleges</h1>
            <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>Manage campus availability</p>
            <div className="admin-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>College</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>Code</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {COLLEGES.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--bd)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>{c.name}</td>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: 'var(--ts)' }}>{c.code}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: c.active ? '#DCFCE7' : '#FEF3C7', color: c.active ? 'var(--ok)' : '#92400E' }}>{c.active ? '✅ Active' : '🔜 Coming Soon'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {tab === 'schedule' && (
          <>
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, marginBottom: 6 }}>Schedule</h1>
            <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>Enable/disable dates and slots. Users only see enabled dates and the slots you allow per date.</p>
            {isSuperAdmin && (
              <div style={{ marginBottom: 16, maxWidth: 320 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Vendor schedule</label>
                <select
                  className="fi fs"
                  value={scheduleVendorSlug}
                  onChange={(e) => setScheduleVendorSlug(e.target.value)}
                >
                  {vendorsList.map((v) => (
                    <option key={v.slug} value={v.slug}>{v.name}</option>
                  ))}
                  {vendorsList.length === 0 && <option value="">No vendors</option>}
                </select>
              </div>
            )}
            {!scheduleLoading && scheduleSuggestions && (
              <div
                style={{
                  marginBottom: 24,
                  padding: 16,
                  borderRadius: 14,
                  background: '#F0F9FF',
                  border: '1px solid rgba(14, 165, 233, 0.35)',
                }}
              >
                <h2 style={{ fontFamily: 'var(--fd)', fontSize: 17, marginBottom: 8, color: 'var(--b)' }}>Suggestions from bookings</h2>
                <p style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 12, lineHeight: 1.5 }}>
                  {isSuperAdmin
                    ? 'Popular time slots and weekdays across all orders. One tap adds or activates the slot and attaches it to every enabled date (you can still tweak below).'
                    : 'Popular time slots and weekdays from your orders. One tap adds or activates the slot and attaches it to every enabled date.'}{' '}
                  <strong>Save schedule</strong> when you are done.
                </p>
                {scheduleSuggestions.dow_counts.length > 0 && (
                  <p style={{ fontSize: 13, color: 'var(--b)', marginBottom: 14, fontWeight: 600 }}>
                    Busiest pickup days:{' '}
                    {scheduleSuggestions.dow_counts
                      .slice(0, 4)
                      .map((d) => `${d.label} (${d.count})`)
                      .join(' · ')}
                  </p>
                )}
                {scheduleSuggestions.slot_counts.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--ts)', margin: 0 }}>No order history yet — add slots manually below.</p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {scheduleSuggestions.slot_counts.map((s) => {
                      const sid = sanitizeSuggestedSlotId(s.time_slot);
                      const exists = scheduleSlots.some((x) => x.id === sid);
                      return (
                        <li
                          key={s.time_slot}
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 10,
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            background: '#fff',
                            borderRadius: 10,
                            border: '1px solid var(--bd)',
                          }}
                        >
                          <span style={{ fontSize: 14 }}>
                            <strong style={{ color: 'var(--b)' }}>{s.time_slot}</strong>
                            <span style={{ color: 'var(--ts)', marginLeft: 8 }}>{s.count} orders</span>
                          </span>
                          <button type="button" className="admin-nav-btn" onClick={() => applySuggestedSlot(s.time_slot)}>
                            {exists ? 'Add to enabled dates' : 'Add slot (1-click)'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
            {scheduleLoading ? (
              <p style={{ color: 'var(--ts)' }}>Loading…</p>
            ) : (
              <>
                <section style={{ marginBottom: 32 }}>
                  <h2 style={{ fontFamily: 'var(--fd)', fontSize: 18, marginBottom: 12 }}>Time slots</h2>
                  <p style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 12 }}>Add or edit slot labels and timings. Toggle active to hide from users.</p>
                  <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                    {scheduleSlots.map((s) => (
                      <div key={s.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--bd)' }}>
                        <input placeholder="ID" value={s.id} onChange={(e) => setScheduleSlots((prev) => prev.map((x) => (x.id === s.id ? { ...x, id: e.target.value } : x)))} style={{ width: 100, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--bd)', fontSize: 13 }} />
                        <input placeholder="Label" value={s.label} onChange={(e) => setScheduleSlots((prev) => prev.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)))} style={{ flex: '1 1 200px', minWidth: 160, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--bd)', fontSize: 13 }} />
                        <input type="time" value={(s.time_from || '').slice(0, 5)} onChange={(e) => setScheduleSlots((prev) => prev.map((x) => (x.id === s.id ? { ...x, time_from: e.target.value + ':00' } : x)))} style={{ width: 90, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--bd)', fontSize: 13 }} />
                        <span style={{ color: 'var(--ts)' }}>–</span>
                        <input type="time" value={(s.time_to || '').slice(0, 5)} onChange={(e) => setScheduleSlots((prev) => prev.map((x) => (x.id === s.id ? { ...x, time_to: e.target.value + ':00' } : x)))} style={{ width: 90, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--bd)', fontSize: 13 }} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          <input type="checkbox" checked={s.active} onChange={(e) => setScheduleSlots((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: e.target.checked } : x)))} />
                          Active
                        </label>
                      </div>
                    ))}
                    <button type="button" className="admin-nav-btn" style={{ marginTop: 12 }} onClick={() => setScheduleSlots((prev) => [...prev, { id: '', label: '', time_from: '09:00', time_to: '17:00', sort_order: prev.length, active: true }])}>
                      + Add slot
                    </button>
                  </div>
                </section>
                <section style={{ marginBottom: 32 }}>
                  <h2 style={{ fontFamily: 'var(--fd)', fontSize: 18, marginBottom: 12 }}>Bookable dates</h2>
                  <p style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 12 }}>Enable or disable dates. For each date, choose which slots are available.</p>
                  <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                    {scheduleDates.map((d) => (
                      <div key={d.date} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--bd)' }}>
                        <strong style={{ minWidth: 120 }}>{d.date}</strong>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          <input type="checkbox" checked={d.enabled} onChange={(e) => setScheduleDates((prev) => prev.map((x) => (x.date === d.date ? { ...x, enabled: e.target.checked } : x)))} />
                          Enabled
                        </label>
                        <span style={{ color: 'var(--ts)', fontSize: 13 }}>Slots:</span>
                        {scheduleSlots.filter((sl) => sl.active || d.slot_ids.includes(sl.id)).map((sl) => (
                          <label key={sl.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                            <input type="checkbox" checked={d.slot_ids.includes(sl.id)} onChange={(e) => setScheduleDates((prev) => prev.map((x) => (x.date === d.date ? { ...x, slot_ids: e.target.checked ? [...x.slot_ids, sl.id] : x.slot_ids.filter((id) => id !== sl.id) } : x)))} />
                            {sl.label || sl.id}
                          </label>
                        ))}
                      </div>
                    ))}
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="date" id="new-schedule-date" style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--bd)', fontSize: 13 }} />
                      <button
                        type="button"
                        className="admin-nav-btn"
                        onClick={() => {
                          const el = document.getElementById('new-schedule-date') as HTMLInputElement | null;
                          const v = el?.value?.trim();
                          if (!v) return;
                          if (scheduleDates.some((x) => x.date === v)) return;
                          setScheduleDates((prev) => [...prev, { date: v, enabled: true, slot_ids: scheduleSlots.filter((s) => s.active).map((s) => s.id) }].sort((a, b) => a.date.localeCompare(b.date)));
                          if (el) el.value = '';
                        }}
                      >
                        Add date
                      </button>
                    </div>
                  </div>
                </section>
                <button type="button" className="btn bp bbl" disabled={scheduleSaving || (isSuperAdmin && !scheduleVendorSlug)} onClick={async () => {
                  setScheduleSaving(true);
                  try {
                    const scheduleQuery = isSuperAdmin && scheduleVendorSlug
                      ? `?vendor=${encodeURIComponent(scheduleVendorSlug)}`
                      : '';
                    const res = await fetch(`/api/admin/schedule${scheduleQuery}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() }, body: JSON.stringify({ slots: scheduleSlots.filter((s) => s.id.trim()), dates: scheduleDates }) });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok && data.ok) { showToast('Schedule saved. Users will see updated dates and slots.', 'ok'); } else {
                    if (res.status === 401) {
                      sessionStorage.removeItem('admin_token');
                      localStorage.removeItem('admin_logged');
                      setLoggedIn(false);
                      showToast('Session expired. Please log in again.', 'er');
                    } else { showToast(data?.error || 'Save failed', 'er'); }
                  }
                  } catch {
                    showToast('Save failed', 'er');
                  } finally {
                    setScheduleSaving(false);
                  }
                }}>
                  {scheduleSaving ? 'Saving…' : 'Save schedule'}
                </button>
              </>
            )}
          </>
        )}
        {tab === 'notifications' && (
          <>
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, marginBottom: 6 }}>Notifications</h1>
            <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>Send in-app messages to users. Push notifications are sent automatically to the LaundroSwipe mobile app when you send a message.</p>
            <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.04)', maxWidth: 520, marginBottom: 24 }}>
              <h3 style={{ fontFamily: 'var(--fd)', fontSize: 16, marginBottom: 12 }}>In-app message</h3>
              <div className="fg" style={{ marginBottom: 12 }}>
                <label className="fl">Title</label>
                <input className="fi" placeholder="e.g. Pickup reminder" value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} />
              </div>
              <div className="fg" style={{ marginBottom: 12 }}>
                <label className="fl">Body (optional)</label>
                <textarea className="fi fta" placeholder="Message text" value={notifyBody} onChange={(e) => setNotifyBody(e.target.value)} rows={3} />
              </div>
              <div className="fg" style={{ marginBottom: 12 }}>
                <label className="fl">Schedule for (optional)</label>
                <input type="datetime-local" className="fi" value={notifyScheduledAt} onChange={(e) => setNotifyScheduledAt(e.target.value)} />
                <p className="vd" style={{ fontSize: 12, marginTop: 4 }}>Leave empty to send now.</p>
              </div>
              <button
                type="button"
                className="btn bp bbl"
                disabled={!notifyTitle.trim() || notifySending}
                onClick={async () => {
                  setNotifySending(true);
                  try {
                    const res = await fetch('/api/admin/notifications', {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
                      body: JSON.stringify({
                        title: notifyTitle.trim(),
                        body: notifyBody.trim() || undefined,
                        send_now: !notifyScheduledAt,
                        scheduled_at: notifyScheduledAt || undefined,
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok && data.ok) {
                      showToast(notifyScheduledAt ? 'Scheduled.' : 'Sent to all users.', 'ok');
                      setNotifyTitle('');
                      setNotifyBody('');
                      setNotifyScheduledAt('');
                      const r = await fetch('/api/admin/notifications', { credentials: 'include', headers: adminAuthHeaders() });
                      const j = await r.json();
                      if (j.notifications) setAdminNotifications(j.notifications);
                    } else {
                      if (res.status === 401) {
                        sessionStorage.removeItem('admin_token');
                        localStorage.removeItem('admin_logged');
                        setLoggedIn(false);
                        showToast('Session expired. Please log in again.', 'er');
                      } else showToast(data?.error || 'Failed', 'er');
                    }
                  } catch {
                    showToast('Failed', 'er');
                  }
                  setNotifySending(false);
                }}
              >
                {notifySending ? 'Sending…' : notifyScheduledAt ? 'Schedule' : 'Send now'}
              </button>
            </div>
            <h3 style={{ fontFamily: 'var(--fd)', fontSize: 16, marginBottom: 12 }}>Recent messages</h3>
            {adminNotificationsLoading ? (
              <p style={{ color: 'var(--ts)' }}>Loading…</p>
            ) : (
              <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,.04)', overflow: 'hidden' }}>
                {adminNotifications.length === 0 ? (
                  <p style={{ padding: 24, color: 'var(--ts)' }}>No messages yet.</p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {adminNotifications.map((n) => (
                      <li key={n.id} style={{ padding: 14, borderBottom: '1px solid var(--bd)' }}>
                        <strong>{n.title}</strong>
                        {n.body && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ts)' }}>{n.body}</p>}
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ts)' }}>
                          {n.sent_at ? `Sent ${new Date(n.sent_at).toLocaleString()}` : n.scheduled_at ? `Scheduled ${new Date(n.scheduled_at).toLocaleString()}` : 'Draft'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
        {tab === 'vendor' && (
          <>
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, marginBottom: 6 }}>Vendor</h1>
            <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>
              Edit vendor card details. {isSuperAdmin ? 'Choose vendor to edit each profile independently.' : 'You can edit only your vendor profile.'}
            </p>
            {vendorProfileLoading ? (
              <p style={{ color: 'var(--ts)' }}>Loading…</p>
            ) : (
              <div className="vendor-card" style={{ maxWidth: 520 }}>
                {isSuperAdmin && (
                  <div className="fg" style={{ marginBottom: 12 }}>
                    <label className="fl">Vendor Profile</label>
                    <select className="fi fs" value={vendorProfileSlug} onChange={(e) => setVendorProfileSlug(e.target.value)}>
                      {vendorsList.map((v) => (
                        <option key={v.slug} value={v.slug}>{v.name} ({v.slug})</option>
                      ))}
                      {vendorsList.length === 0 && <option value={vendorProfileSlug}>{vendorProfileSlug}</option>}
                    </select>
                  </div>
                )}
                <div className="fg" style={{ marginBottom: 12 }}>
                  <label className="fl">Display name</label>
                  <input className="fi" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="e.g. Pro Fab Power Launders" />
                </div>
                <div className="fg" style={{ marginBottom: 12 }}>
                  <label className="fl">Brief (about the vendor)</label>
                  <textarea className="fi fta" value={vendorBrief} onChange={(e) => setVendorBrief(e.target.value)} rows={4} placeholder="Short description shown when user taps the vendor card" />
                </div>
                <div className="fg" style={{ marginBottom: 12 }}>
                  <label className="fl">Pricing details</label>
                  <textarea className="fi fta" value={vendorPricing} onChange={(e) => setVendorPricing(e.target.value)} rows={6} placeholder="e.g. Shirt: ₹19 | Pant: ₹22 | Service fee: based on subtotal" />
                </div>
                <div className="fg" style={{ marginBottom: 12 }}>
                  <label className="fl">Logo</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <img
                      src={vendorLogoUrl || '/profab-logo.png'}
                      alt=""
                      style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--bd)', background: '#fff' }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--ts)' }}>
                      Upload an image or paste image URL
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 1024 * 1024) {
                        showToast('Logo is too large. Keep it under 1MB.', 'er');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        const result = typeof reader.result === 'string' ? reader.result : '';
                        if (!result.startsWith('data:image/')) {
                          showToast('Invalid image file', 'er');
                          return;
                        }
                        setVendorLogoUrl(result);
                      };
                      reader.onerror = () => showToast('Logo upload failed', 'er');
                      reader.readAsDataURL(file);
                    }}
                    style={{ marginBottom: 8 }}
                  />
                  <input
                    className="fi"
                    value={vendorLogoUrl}
                    onChange={(e) => setVendorLogoUrl(e.target.value)}
                    placeholder="https://... (or data:image/...)" />
                </div>
                <button
                  type="button"
                  className="btn bp bbl"
                  disabled={vendorProfileSaving}
                  onClick={async () => {
                    setVendorProfileSaving(true);
                    try {
                      const res = await fetch('/api/admin/vendor-profile', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
                        body: JSON.stringify({
                          slug: isSuperAdmin ? vendorProfileSlug : undefined,
                          name: vendorName.trim(),
                          brief: vendorBrief.trim(),
                          pricing_details: vendorPricing.trim(),
                          logo_url: vendorLogoUrl.trim(),
                        }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok) {
                        showToast('Vendor profile saved. Users will see the updated card on the home page.', 'ok');
                      } else {
                        if (res.status === 401) {
                          sessionStorage.removeItem('admin_token');
                          localStorage.removeItem('admin_logged');
                          setLoggedIn(false);
                          showToast('Session expired. Please log in again.', 'er');
                        } else showToast(data?.error || 'Save failed', 'er');
                      }
                    } catch {
                      showToast('Save failed', 'er');
                    }
                    setVendorProfileSaving(false);
                  }}
                >
                  {vendorProfileSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </>
        )}
        {tab === 'gatepass' && (
          <div className="gatepass-tab">
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, marginBottom: 6 }}>Gate pass</h1>
            <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>Show or print this letter at the gate for vendor entry.</p>
            <div className="gatepass-letter">
              <header className="gatepass-letterhead">
                <div className="gatepass-logo-text">LaundroSwipe</div>
                <div className="gatepass-tagline">Your Laundry Sorted in One Swipe</div>
                <div className="gatepass-website">www.laundroswipe.com</div>
                <div className="gatepass-letterhead-rule" />
              </header>
              <p className="gatepass-ref">To be shown at the gate</p>
              <p className="gatepass-date">Date: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <h2 className="gatepass-subject">Permission Letter for Campus Entry</h2>
              <div className="gatepass-body">
                <p>To whom it may concern,</p>
                <p>This is to certify that <strong>{gatePassVendorLabel}</strong> are official partners of <strong>LaundroSwipe</strong> (LaundroSwipe.com).</p>
                <p>They have received <strong>{vitChennaiOrderCount} pickup order{vitChennaiOrderCount !== 1 ? 's' : ''}</strong> from students and are here to drop off the clothes. We request you to please allow these vendors to pass through the gate so they can complete the deliveries and carry out their work properly.</p>
                <p>Kindly extend your cooperation.</p>
              </div>
              <div className="gatepass-signoff">
                <p className="gatepass-regards">With regards,</p>
                <p className="gatepass-team">Team LaundroSwipe</p>
                <p className="gatepass-contact">Phone: +91 90744 17293</p>
                <p className="gatepass-contact">Email: support@laundroswipe.com</p>
              </div>
            </div>
            <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => printGatePassLetter(gatePassVendorLabel, vitChennaiOrderCount)} className="btn bp">
                🖨️ Print / Save as PDF
              </button>
            </div>
          </div>
        )}
        {tab === 'settings' && (
          <>
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, marginBottom: 6 }}>Settings</h1>
            <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>Vendor and app configuration</p>
            <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)', maxWidth: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <img src="/icon-192.png" alt="" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 10 }} />
                <h3 style={{ fontFamily: 'var(--fd)', fontSize: 18, margin: 0 }}>Vendor summary</h3>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Vendor</label>
                <input readOnly value={settingsVendorLabel} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid var(--bd)', background: '#F8FAFC', fontSize: 14 }} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Service fee</label>
                <input readOnly value={formatServiceFeeTiers()} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid var(--bd)', background: '#F8FAFC', fontSize: 14 }} />
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(249,115,22,.08)', borderRadius: 8, fontSize: 13, color: 'var(--o)' }}>
                Edit vendor card copy and pricing text on the Vendor tab. Add new laundry partners under Vendor Directory below.
              </div>
            </div>

            {isSuperAdmin && (
              <div style={{ marginTop: 20, background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)', maxWidth: 600 }}>
                <h2 style={{ fontFamily: 'var(--fd)', fontSize: 18, margin: 0, marginBottom: 6 }}>Vendor Directory</h2>
                <p style={{ color: 'var(--ts)', fontSize: 13, marginBottom: 12 }}>Add a vendor to enable platform-level reporting and account assignment.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <input className="fi" placeholder="Vendor name" value={newVendorName} onChange={(e) => setNewVendorName(e.target.value)} />
                  <input className="fi" placeholder="slug (e.g. starwash)" value={newVendorSlug} onChange={(e) => setNewVendorSlug(e.target.value)} />
                </div>
                <button
                  type="button"
                  className="btn bp bbl"
                  disabled={newVendorSaving}
                  onClick={async () => {
                    setNewVendorSaving(true);
                    try {
                      const res = await fetch('/api/admin/vendors', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
                        body: JSON.stringify({ name: newVendorName.trim(), slug: newVendorSlug.trim(), active: true }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok) {
                        showToast('Vendor saved', 'ok');
                        setNewVendorName('');
                        setNewVendorSlug('');
                        setVendorsList((prev) => {
                          const row = data.vendor as VendorSummary;
                          const rest = prev.filter((v) => v.slug !== row.slug);
                          return [row, ...rest];
                        });
                      } else showToast(data?.error || 'Vendor save failed', 'er');
                    } catch {
                      showToast('Vendor save failed', 'er');
                    } finally {
                      setNewVendorSaving(false);
                    }
                  }}
                >
                  {newVendorSaving ? 'Saving…' : 'Add / Update vendor'}
                </button>
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ts)' }}>
                  {vendorsList.length > 0
                    ? vendorsList.map((v) => `${v.name} (${v.slug})`).join(' · ')
                    : 'No vendors loaded yet.'}
                </div>
              </div>
            )}

            {isSuperAdmin && (
              <div style={{ marginTop: 20, background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)', maxWidth: 600 }}>
                <h2 style={{ fontFamily: 'var(--fd)', fontSize: 18, margin: 0, marginBottom: 6 }}>Locality / Service Area</h2>
                <p style={{ color: 'var(--ts)', fontSize: 13, marginBottom: 12 }}>Add service areas for rollout (uses the colleges table).</p>
                <input className="fi" placeholder="Area name (e.g. SRM KTR)" value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} style={{ marginBottom: 8 }} />
                <input className="fi" placeholder="Code (e.g. SRM_KTR)" value={newAreaCode} onChange={(e) => setNewAreaCode(e.target.value)} style={{ marginBottom: 8 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <input className="fi" placeholder="City" value={newAreaCity} onChange={(e) => setNewAreaCity(e.target.value)} />
                  <input className="fi" placeholder="State" value={newAreaState} onChange={(e) => setNewAreaState(e.target.value)} />
                </div>
                <button
                  type="button"
                  className="btn bp bbl"
                  disabled={newAreaSaving}
                  onClick={async () => {
                    setNewAreaSaving(true);
                    try {
                      const res = await fetch('/api/admin/service-areas', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
                        body: JSON.stringify({
                          name: newAreaName.trim(),
                          short_code: newAreaCode.trim(),
                          city: newAreaCity.trim(),
                          state: newAreaState.trim(),
                          is_active: false,
                        }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok) {
                        showToast('Service area saved', 'ok');
                        setNewAreaName('');
                        setNewAreaCode('');
                        setNewAreaCity('');
                        setNewAreaState('');
                        setAreasList((prev) => {
                          const row = data.area as ServiceArea;
                          const rest = prev.filter((a) => a.short_code !== row.short_code);
                          return [row, ...rest];
                        });
                      } else showToast(data?.error || 'Service area save failed', 'er');
                    } catch {
                      showToast('Service area save failed', 'er');
                    } finally {
                      setNewAreaSaving(false);
                    }
                  }}
                >
                  {newAreaSaving ? 'Saving…' : 'Add / Update service area'}
                </button>
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ts)' }}>
                  {areasList.length > 0
                    ? areasList.slice(0, 8).map((a) => `${a.name} (${a.short_code})`).join(' · ')
                    : 'No areas loaded yet.'}
                </div>
              </div>
            )}

            {isSuperAdmin && (
              <div style={{ marginTop: 20, background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)', maxWidth: 600 }}>
                <h2 style={{ fontFamily: 'var(--fd)', fontSize: 18, margin: 0, marginBottom: 6 }}>Create Vendor Login</h2>
                <p style={{ color: 'var(--ts)', fontSize: 13, marginBottom: 18 }}>
                  Vendor accounts are created using the mandatory join code. If the code is wrong, the account will not be created.
                </p>

                <div className="fg" style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Vendor</label>
                  <select
                    className="fi fs"
                    value={registerVendorSlug}
                    onChange={(e) => setRegisterVendorSlug(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {vendorsList.length === 0 ? (
                      <option value="">Add vendors in Vendor Directory first</option>
                    ) : (
                      vendorsList.map((v) => (
                        <option key={v.slug} value={v.slug}>
                          {v.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="fg" style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Vendor login email</label>
                  <input
                    className="fi"
                    value={registerVendorEmail}
                    onChange={(e) => setRegisterVendorEmail(e.target.value)}
                    placeholder="e.g. starwash-admin@laundroswipe.com"
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="fg" style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Initial password</label>
                  <input
                    className="fi"
                    value={registerVendorPassword}
                    onChange={(e) => setRegisterVendorPassword(e.target.value)}
                    type="password"
                    placeholder="Min 8 characters"
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="fg" style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Join code</label>
                  <input
                    className="fi"
                    value={registerJoinCode}
                    onChange={(e) => setRegisterJoinCode(e.target.value)}
                    placeholder="e.g. KRISHNAA"
                    style={{ width: '100%' }}
                  />
                </div>

                <button
                  type="button"
                  className="btn bp bbl"
                  disabled={registerVendorSaving || !registerVendorSlug.trim()}
                  style={{ width: '100%' }}
                  onClick={async () => {
                    setRegisterVendorSaving(true);
                    try {
                      const res = await fetch('/api/admin/register-vendor', {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                          'Content-Type': 'application/json',
                          ...adminAuthHeaders(),
                        },
                        body: JSON.stringify({
                          email: registerVendorEmail.trim(),
                          password: registerVendorPassword,
                          vendor_slug: registerVendorSlug,
                          join_code: registerJoinCode.trim(),
                        }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok) {
                        showToast(data?.message ?? 'Vendor account created', 'ok');
                        setRegisterVendorEmail('');
                        setRegisterVendorPassword('');
                      } else {
                        showToast(data?.error ?? 'Vendor account creation failed', 'er');
                      }
                    } catch {
                      showToast('Vendor account creation failed', 'er');
                    } finally {
                      setRegisterVendorSaving(false);
                    }
                  }}
                >
                  {registerVendorSaving ? 'Creating…' : 'Create vendor account'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
      {toast && <div className={`toast toast-dashboard ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
