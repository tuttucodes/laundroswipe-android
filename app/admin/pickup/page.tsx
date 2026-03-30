'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { OrderRow, UserRow } from '@/lib/api';

export default function AdminPickupPage() {
  const [token, setToken] = useState('');
  const [lookupErr, setLookupErr] = useState('');
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [user, setUser] = useState<UserRow | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const adminAuthHeaders = (): Record<string, string> => {
    const t = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const showToast = (msg: string, type: string) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupErr('');
    setOrder(null);
    setUser(null);
    const t = token.replace(/^#/, '').trim();
    if (!t) {
      setLookupErr('Enter a token number');
      return;
    }
    try {
      const res = await fetch('/api/vendor/orders/lookup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ token: t }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setLookupErr('Session expired. Log in again.');
        return;
      }
      if (!res.ok || !data?.ok) {
        setLookupErr(data?.error || 'Order not found for this token');
        return;
      }
      setOrder(data.order as OrderRow);
      setUser((data.user ?? null) as UserRow | null);
      showToast('Order loaded', 'ok');
    } catch {
      setLookupErr('Order lookup failed');
    }
  };

  const handleConfirmDelivery = async () => {
    if (!order) return;
    setConfirming(true);
    try {
      const res = await fetch('/api/vendor/orders/confirm-delivery', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ token: order.token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        showToast(data?.error || 'Failed to confirm', 'er');
        return;
      }
      setOrder({ ...order, status: 'delivered', delivery_confirmed_at: new Date().toISOString() } as any);
      showToast('Delivery confirmed', 'ok');
    } catch {
      showToast('Failed to confirm', 'er');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="vendor-page" style={{ fontFamily: 'var(--fb)', background: 'var(--bg)' }}>
      <p style={{ marginBottom: 16, fontSize: 14 }}>
        <Link href="/admin" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>← Back to Dashboard</Link>
      </p>
      <h1 style={{ fontFamily: 'var(--fd)', fontSize: 24, marginBottom: 6, color: 'var(--b)' }}>Pickup / Delivery</h1>
      <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>Enter token to confirm delivery of that order.</p>

      <div className="vendor-card">
        <form onSubmit={handleLookup}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Token number</label>
            <input
              type="text"
              className="vendor-input"
              placeholder="e.g. 472 or LS12345"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <button type="submit" className="vendor-btn-primary" style={{ width: '100%', minHeight: 52 }}>Lookup order</button>
          {lookupErr && <p style={{ color: 'var(--er)', fontSize: 13, marginTop: 8 }}>{lookupErr}</p>}
        </form>
      </div>

      {order && (
        <div className="vendor-card">
          <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--ts)', marginBottom: 18 }}>
            <p><strong style={{ color: 'var(--tx)' }}>Order:</strong> {order.order_number} &nbsp;|&nbsp; <strong>Token:</strong> #{order.token}</p>
            <p><strong style={{ color: 'var(--tx)' }}>Customer:</strong> {user?.full_name ?? user?.email ?? '—'}</p>
            <p><strong style={{ color: 'var(--tx)' }}>Service:</strong> {order.service_name} &nbsp;|&nbsp; <strong>Date:</strong> {order.pickup_date}</p>
            <p><strong style={{ color: 'var(--tx)' }}>Status:</strong> {order.status}</p>
          </div>
          {order.status !== 'delivered' && (
            <button
              type="button"
              onClick={handleConfirmDelivery}
              disabled={confirming}
              className="vendor-btn-primary"
              style={{ width: '100%', minHeight: 48 }}
            >
              {confirming ? 'Confirming…' : 'Confirm delivery'}
            </button>
          )}
          {order.status === 'delivered' && (
            <p style={{ color: 'var(--ok)', fontWeight: 600 }}>✓ Already delivered</p>
          )}
        </div>
      )}

      {toast && <div className={toast.type} style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '12px 20px', borderRadius: 12, background: toast.type === 'ok' ? 'var(--ok)' : 'var(--er)', color: '#fff', fontSize: 14, fontWeight: 500, zIndex: 9999 }}>{toast.msg}</div>}
    </div>
  );
}
