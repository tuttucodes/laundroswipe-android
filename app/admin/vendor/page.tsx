'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LSApi } from '@/lib/api';
import type { OrderRow, UserRow } from '@/lib/api';

const CONVENIENCE_FEE = 20;

export default function VendorPage() {
  const [token, setToken] = useState('');
  const [lookupErr, setLookupErr] = useState('');
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [user, setUser] = useState<UserRow | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

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
    } else {
      setLookupErr('Order not found for this token');
    }
  };

  const handleNewBill = () => {
    setToken('');
    setLookupErr('');
    setOrder(null);
    setUser(null);
  };

  return (
    <div style={{ padding: 16, fontFamily: 'var(--fb)', background: 'var(--bg)', minHeight: '100vh' }}>
      <p style={{ marginBottom: 12 }}>
        <Link href="/admin" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>← Back to Dashboard</Link>
      </p>
      <h1 style={{ fontFamily: 'var(--fd)', fontSize: 22, marginBottom: 8, color: 'var(--b)' }}>Vendor Bill</h1>
      <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 20 }}>Enter token to load order, then print bill.</p>

      <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <form onSubmit={handleLookup}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Token number</label>
            <input
              type="text"
              className="fi"
              placeholder="e.g. 472"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid var(--bd)', fontSize: 15 }}
            />
          </div>
          <button type="submit" className="btn bp">Lookup order</button>
          {lookupErr && <p style={{ color: 'var(--er)', fontSize: 13, marginTop: 8 }}>{lookupErr}</p>}
        </form>
      </div>

      {order && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ts)' }}>
            <p><strong style={{ color: 'var(--tx)' }}>Order:</strong> {order.order_number}</p>
            <p><strong style={{ color: 'var(--tx)' }}>Token:</strong> #{order.token}</p>
            <p><strong style={{ color: 'var(--tx)' }}>Service:</strong> {order.service_name}</p>
            <p><strong style={{ color: 'var(--tx)' }}>Date:</strong> {order.pickup_date}</p>
            {user && (
              <>
                <p><strong style={{ color: 'var(--tx)' }}>Customer:</strong> {user.full_name ?? user.email ?? '—'}</p>
                {user.phone && <p><strong style={{ color: 'var(--tx)' }}>Phone:</strong> {user.phone}</p>}
              </>
            )}
          </div>
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>
            <p style={{ fontWeight: 700, fontSize: 16 }}>Subtotal: ₹0 + Convenience fee: ₹{CONVENIENCE_FEE} = Total: ₹{CONVENIENCE_FEE}</p>
          </div>
          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button type="button" className="btn bp" onClick={() => window.print()}>Print bill</button>
            <button type="button" className="btn bout" onClick={handleNewBill}>New bill</button>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`} style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)' }}>{toast.msg}</div>}
    </div>
  );
}
