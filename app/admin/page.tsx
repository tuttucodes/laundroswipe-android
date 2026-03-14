'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LSApi } from '@/lib/api';
import { COLLEGES, VENDOR, CONVENIENCE_FEE } from '@/lib/constants';
import type { OrderRow, UserRow } from '@/lib/api';

const STATUSES = ['scheduled', 'agent_assigned', 'picked_up', 'processing', 'ready', 'out_for_delivery', 'delivered'];
const STATUS_LABELS = ['Scheduled', 'Agent Assigned', 'Picked Up', 'Processing', 'Ready', 'Out for Delivery', 'Delivered'];

type OrderWithUser = OrderRow & { user?: string };
type Tab = 'orders' | 'users' | 'colleges' | 'settings';

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [orders, setOrders] = useState<OrderWithUser[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tab, setTab] = useState<Tab>('orders');
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('admin_logged') : null;
    if (saved === 'true') setLoggedIn(true);
  }, []);

  useEffect(() => {
    if (!loggedIn || !LSApi.hasSupabase) return;
    setLoading(true);
    Promise.all([LSApi.fetchOrders(), LSApi.fetchUsers()])
      .then(([ords, us]) => {
        const userMap = new Map<string, UserRow>();
        (us ?? []).forEach((u) => userMap.set(u.id, u));
        setUsers(us ?? []);
        const withUser = (ords ?? []).map((o) => ({
          ...o,
          user: userMap.get(o.user_id ?? '')?.full_name ?? userMap.get(o.user_id ?? '')?.email ?? '—',
        }));
        setOrders(withUser);
      })
      .finally(() => setLoading(false));
  }, [loggedIn]);

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
        if (typeof window !== 'undefined') localStorage.setItem('admin_logged', 'true');
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
    setLoggedIn(false);
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

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  const total = orders.length;
  const active = orders.filter((o) => o.status !== 'delivered').length;
  const delivered = orders.filter((o) => o.status === 'delivered').length;
  const revenue = orders.length * CONVENIENCE_FEE;

  if (!loggedIn) {
    return (
      <div className="login-wrap" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'linear-gradient(135deg,#0F3285,var(--b),#2558C4)' }}>
        <div className="login-card" style={{ background: '#fff', borderRadius: 20, padding: '32px 24px', maxWidth: 400, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 24, color: 'var(--b)' }}>LaundroSwipe Admin</h1>
            <p style={{ color: 'var(--ts)', fontSize: 13, marginTop: 4 }}>Pro Fab Power Laundry</p>
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
            <button type="submit" className="btn bp bbl" style={{ marginTop: 8, width: '100%' }} disabled={authLoading}>{authLoading ? 'Checking…' : 'Log In'}</button>
          </form>
        </div>
        {toast && <div className={`toast ${toast.type}`} style={{ position: 'fixed', top: 20, right: 20 }}>{toast.msg}</div>}
      </div>
    );
  }

  return (
    <div className="admin-root">
      <aside className="admin-sidebar">
        <div className="admin-logo" style={{ padding: '0 24px 24px', borderBottom: '1px solid var(--bd)' }}>
          <h2 style={{ fontFamily: 'var(--fd)', fontSize: 18, color: 'var(--b)' }}>LaundroSwipe Admin</h2>
        </div>
        <nav style={{ padding: 16, flex: 1 }}>
          <button type="button" onClick={() => setTab('orders')} className={`admin-nav-btn ${tab === 'orders' ? 'active' : ''}`}>📦 Orders</button>
          <button type="button" onClick={() => setTab('users')} className={`admin-nav-btn ${tab === 'users' ? 'active' : ''}`}>👥 Users</button>
          <Link href="/admin/vendor" className="admin-nav-link">🧾 Vendor / Bill</Link>
          <button type="button" onClick={() => setTab('colleges')} className={`admin-nav-btn ${tab === 'colleges' ? 'active' : ''}`}>🎓 Colleges</button>
          <button type="button" onClick={() => setTab('settings')} className={`admin-nav-btn ${tab === 'settings' ? 'active' : ''}`}>⚙️ Settings</button>
        </nav>
        <div className="admin-foot" style={{ padding: 16, borderTop: '1px solid var(--bd)' }}>
          <button type="button" className="btn bout" onClick={handleLogout} style={{ width: '100%' }}>Log out</button>
        </div>
      </aside>
      <main className="admin-main">
        {tab === 'orders' && (
          <>
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, marginBottom: 6 }}>Orders</h1>
            <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>Manage pickups and status</p>
            <div className="admin-stat-grid">
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                <div style={{ fontFamily: 'var(--fd)', fontSize: 32, fontWeight: 800, color: 'var(--b)' }}>{total}</div>
                <div style={{ fontSize: 13, color: 'var(--ts)' }}>Total orders</div>
              </div>
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                <div style={{ fontFamily: 'var(--fd)', fontSize: 32, fontWeight: 800, color: 'var(--o)' }}>{active}</div>
                <div style={{ fontSize: 13, color: 'var(--ts)' }}>Active</div>
              </div>
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                <div style={{ fontFamily: 'var(--fd)', fontSize: 32, fontWeight: 800, color: 'var(--ok)' }}>{delivered}</div>
                <div style={{ fontSize: 13, color: 'var(--ts)' }}>Delivered</div>
              </div>
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                <div style={{ fontFamily: 'var(--fd)', fontSize: 32, fontWeight: 800, color: 'var(--t)' }}>₹{revenue}</div>
                <div style={{ fontSize: 13, color: 'var(--ts)' }}>Total order value</div>
              </div>
            </div>
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
            {loading ? (
              <p style={{ color: 'var(--ts)' }}>Loading…</p>
            ) : (
              <div className="admin-table-wrap" style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
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
            )}
          </>
        )}
        {tab === 'users' && (
          <>
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, marginBottom: 6 }}>Users</h1>
            <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>Registered app users</p>
            {loading ? (
              <p style={{ color: 'var(--ts)' }}>Loading…</p>
            ) : (
              <div className="admin-table-wrap" style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>User</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>Phone</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>College</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--tm)', textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>Reg No</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(users ?? []).map((u) => {
                      const ini = (u.full_name ?? '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
                      const collegeName = u.college_id ? (COLLEGES.find((c) => c.id === u.college_id)?.name ?? u.college_id) : '—';
                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--bd)' }}>
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
                {(!users || users.length === 0) && <p style={{ textAlign: 'center', padding: 48, color: 'var(--ts)' }}>No users yet. Users appear when they register.</p>}
              </div>
            )}
          </>
        )}
        {tab === 'colleges' && (
          <>
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, marginBottom: 6 }}>Colleges</h1>
            <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>Manage campus availability</p>
            <div className="admin-table-wrap" style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
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
        {tab === 'settings' && (
          <>
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 26, marginBottom: 6 }}>Settings</h1>
            <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>Vendor and app configuration</p>
            <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.04)', maxWidth: 600 }}>
              <h3 style={{ fontFamily: 'var(--fd)', fontSize: 18, marginBottom: 20 }}>Vendor Details</h3>
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
              <div style={{ padding: '12px 16px', background: 'rgba(249,115,22,.08)', borderRadius: 8, fontSize: 13, color: 'var(--o)' }}>To change settings, update the code (e.g. lib/constants.ts) or Supabase directly.</div>
            </div>
          </>
        )}
      </main>
      {toast && <div className={`toast ${toast.type}`} style={{ position: 'fixed', top: 20, right: 20 }}>{toast.msg}</div>}
    </div>
  );
}
