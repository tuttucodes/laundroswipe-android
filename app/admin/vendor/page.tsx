'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { LSApi } from '@/lib/api';
import { VENDOR_BILL_ITEMS, CONVENIENCE_FEE } from '@/lib/constants';
import type { OrderRow, UserRow } from '@/lib/api';

type LineItem = { id: string; label: string; price: number; qty: number };

export default function VendorPage() {
  const [token, setToken] = useState('');
  const [lookupErr, setLookupErr] = useState('');
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [user, setUser] = useState<UserRow | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [qty, setQty] = useState(1);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  const showToast = (msg: string, type: string) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupErr('');
    setOrder(null);
    setUser(null);
    setLineItems([]);
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

  const addLine = () => {
    if (!selectedItem) return;
    const item = VENDOR_BILL_ITEMS.find((i) => i.id === selectedItem);
    if (!item) return;
    const q = Math.max(1, qty);
    setLineItems((prev) => [...prev, { id: item.id, label: item.label, price: item.price, qty: q }]);
    setSelectedItem('');
    setQty(1);
    selectRef.current?.focus();
  };

  const removeLine = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = lineItems.reduce((s, l) => s + l.price * l.qty, 0);
  const total = subtotal + CONVENIENCE_FEE;

  const buildReceiptHtml = () => {
    const rows = lineItems.length
      ? lineItems.map((l) => `<tr><td>${l.label} x${l.qty}</td><td class="right">${l.price * l.qty}</td></tr>`).join('')
      : '<tr><td colspan="2">No items</td></tr>';
    const o = order as OrderRow | null;
    const u = (user ?? {}) as Partial<UserRow>;
    return `
    <h2>LaundroSwipe</h2>
    <p class="meta">Pro Fab Power Laundry</p>
    <p><strong>Order:</strong> ${o?.order_number ?? ''} &nbsp; <strong>Token:</strong> #${o?.token ?? ''}</p>
    <p><strong>Customer:</strong> ${u.full_name ?? u.email ?? '—'}</p>
    <p><strong>Phone:</strong> ${u.phone ?? '—'}</p>
    <table>
      <thead><tr><th>Item</th><th class="right">₹</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="right">Subtotal: ₹${subtotal}</p>
    <p class="right conv">Convenience fee: ₹${CONVENIENCE_FEE}</p>
    <p class="total right">Total: ₹${total}</p>
    <p style="text-align:center;margin-top:12px;font-size:10px">Thank you!</p>
  `;
  };

  const handlePrint = () => {
    if (lineItems.length === 0) {
      showToast('Add at least one item', 'er');
      return;
    }
    const w = window.open('', '_blank', 'width=320,height=480');
    if (!w) {
      showToast('Allow popups to print', 'er');
      return;
    }
    w.document.write(`
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bill #${order?.token ?? ''}</title>
      <style>
      body{font-family:system-ui,sans-serif;font-size:11px;padding:8px;margin:0;width:58mm;max-width:58mm}
      table{width:100%;border-collapse:collapse;font-size:10px}
      th,td{padding:2px 0}
      .right{text-align:right}
      .total{font-weight:700;font-size:12px;border-top:2px solid #000;padding-top:4px;margin-top:4px}
      .conv{font-size:10px;color:#666}
      h2{text-align:center;font-size:13px;margin:0 0 2px}
      p{margin:2px 0;font-size:10px}
      @media print{body{width:58mm!important;max-width:58mm!important}}
      </style></head><body>
      ${buildReceiptHtml()}
      </body></html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 300);
    showToast('Print dialog opened. Select your Bluetooth thermal printer.', 'ok');
  };

  const handleNewBill = () => {
    setToken('');
    setLookupErr('');
    setOrder(null);
    setUser(null);
    setLineItems([]);
    setSelectedItem('');
    setQty(1);
  };

  return (
    <div className="vendor-page" style={{ fontFamily: 'var(--fb)', background: 'var(--bg)' }}>
      <p style={{ marginBottom: 12 }}>
        <Link href="/admin" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>← Back to Dashboard</Link>
      </p>
      <h1 style={{ fontFamily: 'var(--fd)', fontSize: 22, marginBottom: 8, color: 'var(--b)' }}>Vendor Bill</h1>
      <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 20 }}>Enter token to load order, add line items, then print bill.</p>

      <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <form onSubmit={handleLookup}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Token number</label>
            <input
              type="text"
              className="vendor-input"
              placeholder="e.g. 472"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <button type="submit" className="vendor-btn-primary">Lookup order</button>
          {lookupErr && <p style={{ color: 'var(--er)', fontSize: 13, marginTop: 8 }}>{lookupErr}</p>}
        </form>
      </div>

      {order && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ts)', marginBottom: 20 }}>
            <p><strong style={{ color: 'var(--tx)' }}>Order:</strong> {order.order_number} &nbsp;|&nbsp; <strong>Token:</strong> #{order.token}</p>
            <p><strong style={{ color: 'var(--tx)' }}>Customer:</strong> {user?.full_name ?? user?.email ?? '—'}</p>
            <p><strong style={{ color: 'var(--tx)' }}>Phone:</strong> {user?.phone ?? '—'} &nbsp;|&nbsp; <strong>Email:</strong> {user?.email ?? '—'}</p>
            <p><strong style={{ color: 'var(--tx)' }}>Service:</strong> {order.service_name} &nbsp;|&nbsp; <strong>Date:</strong> {order.pickup_date}</p>
          </div>

          <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 16, marginTop: 16 }}>
            <div className="vendor-line-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Item</label>
                <select
                  ref={selectRef}
                  value={selectedItem}
                  onChange={(e) => setSelectedItem(e.target.value)}
                  className="vendor-select"
                >
                  <option value="">Select item</option>
                  {VENDOR_BILL_ITEMS.map((i) => (
                    <option key={i.id} value={i.id}>{i.label} — ₹{i.price}</option>
                  ))}
                </select>
              </div>
              <div style={{ width: 80 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Qty</label>
                <input
                  type="number"
                  className="vendor-input"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLine())}
                />
              </div>
              <button type="button" onClick={addLine} className="vendor-add-btn" style={{ padding: '10px 18px', borderRadius: 8, fontWeight: 600, background: 'var(--bl)', color: 'var(--b)', border: 'none', cursor: 'pointer' }}>Add</button>
            </div>

            <div style={{ marginBottom: 12, minHeight: 24 }}>
              {lineItems.length === 0 ? (
                <p style={{ color: 'var(--ts)', fontSize: 13 }}>No items yet. Add items above.</p>
              ) : (
                lineItems.map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bd)', fontSize: 14 }}>
                    <span>{l.label} × {l.qty} @ ₹{l.price}</span>
                    <span>
                      ₹{l.price * l.qty}
                      <button type="button" onClick={() => removeLine(i)} style={{ marginLeft: 8, padding: '6px 10px', minWidth: 32, fontSize: 12, borderRadius: 6, border: '1px solid var(--bd)', background: '#fff', cursor: 'pointer' }} aria-label="Remove line">×</button>
                    </span>
                  </div>
                ))
              )}
            </div>

            <p style={{ fontSize: 13, color: 'var(--ts)' }}>Total items: {lineItems.reduce((s, l) => s + l.qty, 0)}</p>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Subtotal: ₹{subtotal}</p>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Convenience fee: ₹{CONVENIENCE_FEE}</p>
            <p style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>Total: ₹{total}</p>

            <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={handlePrint} className="vendor-btn-primary">Print bill</button>
              <button type="button" onClick={handleNewBill} className="vendor-btn-secondary">New bill</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={toast.type} style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '12px 20px', borderRadius: 12, background: toast.type === 'ok' ? 'var(--ok)' : 'var(--er)', color: '#fff', fontSize: 14, fontWeight: 500, zIndex: 9999 }}>{toast.msg}</div>}
    </div>
  );
}
