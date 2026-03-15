'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LSApi } from '@/lib/api';
import type { OrderRow, UserRow } from '@/lib/api';

export default function AdminPickupPage() {
  const [token, setToken] = useState('');
  const [lookupErr, setLookupErr] = useState('');
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [user, setUser] = useState<UserRow | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

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
    const result = await LSApi.fetchOrderByToken(t);
    if (result) {
      setOrder(result.order);
      setUser(result.user ?? null);
      showToast('Order loaded', 'ok');
    } else {
      setLookupErr('Order not found for this token');
    }
  };

  const handleConfirmDelivery = async () => {
    if (!order) return;
    setConfirming(true);
    const updated = await LSApi.confirmDeliveryByToken(order.token);
    setConfirming(false);
    if (updated) {
      setOrder({ ...order, status: 'delivered' });
      showToast('Delivery confirmed', 'ok');
    } else {
      showToast('Failed to confirm', 'er');
    }
  };

  return (
    <div className="vendor-page" style={{ fontFamily: 'var(--fb)', background: 'var(--bg)' }}>
      <p style={{ marginBottom: 12 }}>
        <Link href="/admin" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>← Back to Dashboard</Link>
      </p>
      <h1 style={{ fontFamily: 'var(--fd)', fontSize: 22, marginBottom: 8, color: 'var(--b)' }}>Pickup / Delivery</h1>
      <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 20 }}>Enter token to confirm delivery of that order.</p>

      <div className="vendor-card">
        <form onSubmit={handleLookup}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Token number</label>
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
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ts)', marginBottom: 16 }}>
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
