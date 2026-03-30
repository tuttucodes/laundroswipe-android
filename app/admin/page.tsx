'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LSApi } from '@/lib/api';
import { COLLEGES, VENDOR, CONVENIENCE_FEE, VIT_VENDOR_BLOCK_ACCESS } from '@/lib/constants';
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
type Tab = 'orders' | 'users' | 'colleges' | 'schedule' | 'notifications' | 'vendor' | 'gatepass' | 'settings';
type AdminRole = 'super_admin' | 'vendor';
type VendorId = keyof typeof VIT_VENDOR_BLOCK_ACCESS;

type ScheduleSlot = { id: string; label: string; time_from: string; time_to: string; sort_order: number; active: boolean };
type ScheduleDateRow = { date: string; enabled: boolean; slot_ids: string[] };
type AdminNotification = { id: string; title: string; body: string | null; sent_at: string | null; scheduled_at: string | null; created_at: string };
type VendorSummary = { id: string; slug: string; name: string; active: boolean };
type ServiceArea = { id: string; name: string; short_code: string; city: string | null; state: string | null; is_active: boolean };

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<AdminRole>('vendor');
  const [vendorId, setVendorId] = useState<VendorId | null>(null);
  const [registerVendorEmail, setRegisterVendorEmail] = useState('');
  const [registerVendorPassword, setRegisterVendorPassword] = useState('');
  const [registerVendorSlug, setRegisterVendorSlug] = useState<VendorId>('profab');
  const [registerJoinCode, setRegisterJoinCode] = useState('KRISHNAA');
  const [registerVendorSaving, setRegisterVendorSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [orders, setOrders] = useState<OrderWithUser[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [bills, setBills] = useState<{
    count: number;
    /** Sum of each bill’s final total (what customers paid). */
    totalRevenue: number;
    /** Sum of line-item amounts only (excludes convenience fee). */
    subtotalExcludingFees: number;
    /** Sum of convenience_fee across saved bills. */
    totalConvenienceFee: number;
  }>({ count: 0, totalRevenue: 0, subtotalExcludingFees: 0, totalConvenienceFee: 0 });
  const [tab, setTab] = useState<Tab>('orders');
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [scheduleDates, setScheduleDates] = useState<ScheduleDateRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  const [notifyScheduledAt, setNotifyScheduledAt] = useState('');
  const [notifySending, setNotifySending] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([]);
  const [adminNotificationsLoading, setAdminNotificationsLoading] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorBrief, setVendorBrief] = useState('');
  const [vendorPricing, setVendorPricing] = useState('');
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

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('admin_logged') : null;
    const savedRole = typeof window !== 'undefined' ? localStorage.getItem('admin_role') : null;
    const savedVendorId = typeof window !== 'undefined' ? localStorage.getItem('admin_vendor_id') : null;
    if (savedRole === 'super_admin' || savedRole === 'vendor') setRole(savedRole);
    if (savedVendorId === 'profab' || savedVendorId === 'starwash') setVendorId(savedVendorId);
    if (saved === 'true') setLoggedIn(true);
  }, []);

  useEffect(() => {
    if (!loggedIn || !LSApi.hasSupabase) return;
    setLoading(true);
    Promise.all([LSApi.fetchOrders(), LSApi.fetchUsers(), LSApi.fetchVendorBills()])
      .then(([ords, us, billList]) => {
        const userMap = new Map<string, UserRow>();
        (us ?? []).forEach((u) => userMap.set(u.id, u));
        setUsers(us ?? []);
        const withUser = (ords ?? []).map((o) => ({
          ...o,
          user: userMap.get(o.user_id ?? '')?.full_name ?? userMap.get(o.user_id ?? '')?.email ?? '—',
        }));
        const vendorScopedOrders = !isSuperAdmin && vendorId
          ? withUser.filter((o) => {
              const u = userMap.get(o.user_id ?? '');
              if (!u) return false;
              if (u.college_id !== 'vit-chn') return false;
              const block = String(u.hostel_block ?? '').trim().toUpperCase();
              const allowed = VIT_VENDOR_BLOCK_ACCESS[vendorId];
              return allowed.some((b) => block.startsWith(b));
            })
          : withUser;
        setOrders(vendorScopedOrders);
        const orderIds = new Set(vendorScopedOrders.map((o) => o.id));
        const bl = !isSuperAdmin ? (billList ?? []).filter((b) => (b.order_id ? orderIds.has(b.order_id) : false)) : (billList ?? []);
        const vendorTotals = new Map<string, number>();
        bl.forEach((b) => {
          const key = String((b as { vendor_name?: string | null }).vendor_name ?? 'Unassigned');
          vendorTotals.set(key, (vendorTotals.get(key) ?? 0) + (Number(b.total) || 0));
        });
        setVendorStats(Array.from(vendorTotals.entries()).map(([vendorName, total]) => ({ vendorName, total })).sort((a, b) => b.total - a.total));
        const agg = bl.reduce(
          (acc, b) => {
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
  }, [loggedIn, isSuperAdmin, vendorId]);

  useEffect(() => {
    if (!loggedIn || tab !== 'schedule') return;
    setScheduleLoading(true);
    fetch('/api/admin/schedule', { credentials: 'include', headers: adminAuthHeaders() })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.status === 401) {
          sessionStorage.removeItem('admin_token');
          localStorage.removeItem('admin_logged');
          setLoggedIn(false);
          return;
        }
        if (data.slots) setScheduleSlots(data.slots);
        if (data.dates) setScheduleDates(data.dates);
      })
      .catch(() => setScheduleSlots([]))
      .finally(() => setScheduleLoading(false));
  }, [loggedIn, tab]);

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
    fetch('/api/admin/vendor-profile', { credentials: 'include', headers: adminAuthHeaders() })
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
        }
      })
      .catch(() => {})
      .finally(() => setVendorProfileLoading(false));
  }, [loggedIn, tab]);

  useEffect(() => {
    if (!loggedIn || !isSuperAdmin || tab !== 'settings') return;
    Promise.all([
      fetch('/api/admin/vendors', { credentials: 'include', headers: adminAuthHeaders() }).then((r) => r.json().catch(() => ({}))),
      fetch('/api/admin/service-areas', { credentials: 'include', headers: adminAuthHeaders() }).then((r) => r.json().catch(() => ({}))),
    ]).then(([v, a]) => {
      if (Array.isArray(v?.vendors)) setVendorsList(v.vendors);
      if (Array.isArray(a?.areas)) setAreasList(a.areas);
    }).catch(() => {});
  }, [loggedIn, isSuperAdmin, tab]);

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
          if (data.token) sessionStorage.setItem('admin_token', data.token);
        }
        setRole(data.role === 'super_admin' ? 'super_admin' : 'vendor');
        setVendorId(data.vendorId === 'profab' || data.vendorId === 'starwash' ? data.vendorId : null);
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
    sessionStorage.removeItem('admin_token');
    setLoggedIn(false);
  };

  const adminAuthHeaders = (): Record<string, string> => {
    const t = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const advanceStatus = async (orderId: string) => {
    const updated = await LSApi.advanceOrderStatus(orderId);
    if (updated) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: updated.status } : o)));
      showToast('Status updated', 'ok');
    } else {
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

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  const filteredUsers = (users ?? []).filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return [u.display_id, u.full_name, u.email, u.phone, u.college_id, u.reg_no, u.hostel_block]
      .some((v) => String(v ?? '').toLowerCase().includes(q));
  });
  const totalOrders = orders.length;
  const active = orders.filter((o) => o.status !== 'delivered').length;
  const delivered = orders.filter((o) => o.status === 'delivered').length;
  const billsGenerated = bills.count;
  const tokensGenerated = totalOrders;
  const { totalRevenue, subtotalExcludingFees, totalConvenienceFee } = bills;
  const vitChennaiOrderCount = orders.filter((o) => users.find((u) => u.id === o.user_id)?.college_id === 'vit-chn').length;

  if (!loggedIn) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img src="/icon-192.png" alt="LaundroSwipe" style={{ height: 56, width: 56, objectFit: 'contain', marginBottom: 14, borderRadius: 12 }} />
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 24, color: 'var(--b)' }}>LaundroSwipe Vendor Login</h1>
            <p style={{ color: 'var(--ts)', fontSize: 13, marginTop: 6 }}>Vendor portal + super admin access</p>
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
        <h2 className="admin-header-title">{isSuperAdmin ? 'LaundroSwipe Super Admin' : 'LaundroSwipe Vendor Portal'}</h2>
      </header>

      {menuOpen && <div className="admin-drawer-overlay" onClick={closeMenu} aria-hidden />}

      <aside className={`admin-drawer ${menuOpen ? 'admin-drawer-open' : ''}`}>
        <div className="admin-drawer-head">
          <span className="admin-drawer-title">{isSuperAdmin ? 'LaundroSwipe Super Admin' : 'LaundroSwipe Vendor Portal'}</span>
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
            <button type="button" onClick={() => { setTab('vendor'); closeMenu(); }} className={`admin-nav-btn ${tab === 'vendor' ? 'active' : ''}`}>🧺 Vendor</button>
          </div>
          {isSuperAdmin && (
            <>
              <div className="admin-drawer-section">
                <span className="admin-drawer-section-label">Campus</span>
                <button type="button" onClick={() => { setTab('colleges'); closeMenu(); }} className={`admin-nav-btn ${tab === 'colleges' ? 'active' : ''}`}>🎓 Colleges</button>
                <button type="button" onClick={() => { setTab('schedule'); closeMenu(); }} className={`admin-nav-btn ${tab === 'schedule' ? 'active' : ''}`}>📅 Schedule</button>
                <button type="button" onClick={() => { setTab('notifications'); closeMenu(); }} className={`admin-nav-btn ${tab === 'notifications' ? 'active' : ''}`}>🔔 Notifications</button>
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
                  <div className="admin-stat-label">After convenience fee (laundry subtotal)</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-value" style={{ color: 'var(--o)' }}>₹{totalConvenienceFee.toFixed(0)}</div>
                  <div className="admin-stat-label">Total convenience fee (on saved bills)</div>
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
                <button type="button" className="btn bp bbl" disabled={scheduleSaving} onClick={async () => {
                  setScheduleSaving(true);
                  try {
                    const res = await fetch('/api/admin/schedule', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() }, body: JSON.stringify({ slots: scheduleSlots.filter((s) => s.id.trim()), dates: scheduleDates }) });
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
            <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>Edit the vendor card shown on the user homepage (brief and pricing).</p>
            {vendorProfileLoading ? (
              <p style={{ color: 'var(--ts)' }}>Loading…</p>
            ) : (
              <div className="vendor-card" style={{ maxWidth: 520 }}>
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
                  <textarea className="fi fta" value={vendorPricing} onChange={(e) => setVendorPricing(e.target.value)} rows={6} placeholder="e.g. Shirt: ₹19 | Pant: ₹22 | Convenience fee: ₹20" />
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
                        body: JSON.stringify({ name: vendorName.trim(), brief: vendorBrief.trim(), pricing_details: vendorPricing.trim() }),
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
                <p>This is to certify that <strong>{VENDOR.name}</strong> are official partners of <strong>LaundroSwipe</strong> (LaundroSwipe.com).</p>
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
              <button type="button" onClick={() => printGatePassLetter(VENDOR.name, vitChennaiOrderCount)} className="btn bp">
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
                <img src="/profab-logo.png" alt="" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 10 }} />
                <h3 style={{ fontFamily: 'var(--fd)', fontSize: 18, margin: 0 }}>Vendor Details</h3>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Vendor Name</label>
                <input readOnly value={VENDOR.name} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid var(--bd)', background: '#F8FAFC', fontSize: 14 }} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Available Days</label>
                <input readOnly value={VENDOR.days.join(', ')} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid var(--bd)', background: '#F8FAFC', fontSize: 14 }} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Pickup Location</label>
                <input readOnly value={VENDOR.location} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid var(--bd)', background: '#F8FAFC', fontSize: 14 }} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Convenience Fee</label>
                <input readOnly value={`₹${CONVENIENCE_FEE} per order`} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid var(--bd)', background: '#F8FAFC', fontSize: 14 }} />
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(249,115,22,.08)', borderRadius: 8, fontSize: 13, color: 'var(--o)' }}>To change settings, update the code (e.g. lib/constants.ts) or the admin database.</div>
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
                    onChange={(e) => setRegisterVendorSlug(e.target.value as VendorId)}
                    style={{ width: '100%' }}
                  >
                    <option value="profab">Pro Fab</option>
                    <option value="starwash">Star Wash</option>
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
                  disabled={registerVendorSaving}
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
