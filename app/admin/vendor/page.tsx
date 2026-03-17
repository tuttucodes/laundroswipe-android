'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { LSApi } from '@/lib/api';
import { printThermalReceipt, printThermalReceiptDirect } from '@/lib/thermal-print';
import { getPrinterConfigForPrint } from '@/lib/printer-settings';
import { VENDOR_BILL_ITEMS, CONVENIENCE_FEE } from '@/lib/constants';
import type { OrderRow, UserRow } from '@/lib/api';

type LineItem = { id: string; label: string; price: number; qty: number };

export default function VendorPage() {
  const [token, setToken] = useState('');
  const [lookupErr, setLookupErr] = useState('');
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [user, setUser] = useState<UserRow | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [billAlreadyGenerated, setBillAlreadyGenerated] = useState(false);
  const [showAnyway, setShowAnyway] = useState(false);
  const lastSavedBillFingerprintRef = useRef<string | null>(null);

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
    setBillAlreadyGenerated(false);
    setShowAnyway(false);
    lastSavedBillFingerprintRef.current = null;
    const t = token.replace(/^#/, '').trim();
    if (!t) {
      setLookupErr('Enter a token number');
      return;
    }
    const result = await LSApi.fetchOrderByToken(t);
    if (result) {
      setOrder(result.order);
      setUser(result.user ?? null);
      const existingCount = await LSApi.countBillsForOrderToken(t);
      setBillAlreadyGenerated(existingCount > 0);
      showToast('Order loaded', 'ok');
    } else {
      setLookupErr('Order not found for this token');
    }
  };

  const addItem = (itemId: string) => {
    const item = VENDOR_BILL_ITEMS.find((i) => i.id === itemId);
    if (!item) return;
    setLineItems((prev) => {
      const i = prev.findIndex((l) => l.id === itemId);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, { id: item.id, label: item.label, price: item.price, qty: 1 }];
    });
  };

  const removeOne = (itemId: string) => {
    setLineItems((prev) => {
      const i = prev.findIndex((l) => l.id === itemId);
      if (i < 0) return prev;
      const next = [...prev];
      if (next[i].qty <= 1) return next.filter((_, j) => j !== i);
      next[i] = { ...next[i], qty: next[i].qty - 1 };
      return next;
    });
  };

  const removeLine = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = lineItems.reduce((s, l) => s + l.price * l.qty, 0);
  const total = subtotal + CONVENIENCE_FEE;

  const billFingerprint = (): string => {
    const orderToken = (order?.token ?? token.replace(/^#/, '').trim()) || 'draft';
    const itemsKey = [...lineItems]
      .sort((a, b) => a.id.localeCompare(b.id) || a.qty - b.qty)
      .map((l) => `${l.id}:${l.qty}:${l.price}`)
      .join('|');
    return `${orderToken}|${itemsKey}|${subtotal}|${total}`;
  };

  const buildReceiptHtml = () => {
    const rows = lineItems.length
      ? lineItems.map((l) => `<tr><td>${l.label} x${l.qty}</td><td class="right">₹${l.price * l.qty}</td></tr>`).join('')
      : '<tr><td colspan="2">No items</td></tr>';
    const o = order as OrderRow | null;
    const u = (user ?? {}) as Partial<UserRow & { display_id?: string | null }>;
    const dateStr = new Date().toLocaleString();
    return `
<h2>LaundroSwipe</h2>
<p class="meta">Vendor name: Pro Fab Power Laundry</p>
<p><strong>Token:</strong> #${o?.token ?? ''} <strong>Order:</strong> ${o?.order_number ?? ''}</p>
<p><strong>Customer:</strong> ${(u.full_name ?? u.email ?? '—').toString().slice(0, 20)}</p>
<p><strong>Phone:</strong> ${(u.phone ?? '—').toString().slice(0, 14)}</p>
<p><strong>Date:</strong> ${dateStr}</p>
<table>
<thead><tr><th>Item</th><th class="right">₹</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p class="right receipt-summary">Subtotal: ₹${subtotal}</p>
<p class="right conv">Convenience fee: ₹${CONVENIENCE_FEE}</p>
<p class="total right">Total: ₹${total}</p>
<p class="foot">Thank you!</p>
`;
  };

  const buildReceiptPlainText = () => {
    const o = order as OrderRow | null;
    const u = (user ?? {}) as Partial<UserRow>;
    const lines = [
      'LaundroSwipe',
      'Vendor: Pro Fab Power Laundry',
      `Token: #${o?.token ?? ''}  Order: ${o?.order_number ?? ''}`,
      `Customer: ${(u.full_name ?? u.email ?? '—').toString().slice(0, 24)}`,
      `Phone: ${(u.phone ?? '—').toString().slice(0, 14)}`,
      '---',
      ...lineItems.map((l) => `${l.label} x${l.qty}    ₹${l.price * l.qty}`),
      '---',
      `Subtotal: ₹${subtotal}`,
      `Conv fee: ₹${CONVENIENCE_FEE}`,
      `TOTAL: ₹${total}`,
      'Thank you!',
    ];
    return lines.join('\n');
  };

  const handleCopyReceipt = async () => {
    if (lineItems.length === 0) {
      showToast('Add at least one item', 'er');
      return;
    }
    try {
      await navigator.clipboard.writeText(buildReceiptPlainText());
      showToast('Copied. Paste in your printer app to print.', 'ok');
    } catch {
      showToast('Copy failed', 'er');
    }
  };

  const handleSaveBill = async () => {
    if (lineItems.length === 0) {
      showToast('Add at least one item', 'er');
      return;
    }
    const orderToken = (order?.token ?? token.replace(/^#/, '').trim()) || 'draft';
    setSaving(true);
    const result = await LSApi.saveVendorBill({
      order_id: order?.id ?? null,
      order_token: orderToken,
      order_number: order?.order_number ?? null,
      customer_name: user?.full_name ?? null,
      customer_phone: user?.phone ?? null,
      user_id: order?.user_id ?? user?.id ?? null,
      line_items: lineItems,
      subtotal,
      convenience_fee: CONVENIENCE_FEE,
      total,
    });
    setSaving(false);
    if (result) {
      setBillAlreadyGenerated(true);
      showToast('Bill saved', 'ok');
    } else {
      showToast('Save failed. Run supabase/vendor_bills.sql if needed.', 'er');
    }
  };

  const doPrint = async () => {
    const title = `Bill #${order?.token ?? ''}`;
    const config = getPrinterConfigForPrint();
    const result = await printThermalReceiptDirect(title, buildReceiptHtml(), buildReceiptPlainText(), { printer: config ?? undefined, forceDialog: config?.forceDialog ?? true });
    if (result === 'blocked') {
      showToast('Allow pop-ups to print, or try again', 'er');
    } else if (result === 'dialog') {
      showToast('Select ESCPOS Bluetooth Print Service in the print dialog', 'ok');
    } else {
      showToast('Sent to printer', 'ok');
    }
  };

  const handlePrint = async () => {
    if (lineItems.length === 0) {
      showToast('Add at least one item', 'er');
      return;
    }
    const fingerprint = billFingerprint();
    if (lastSavedBillFingerprintRef.current === fingerprint) {
      showToast('Printing…', 'ok');
      await doPrint();
      return;
    }
    showToast('Saving & printing…', 'ok');
    const orderToken = (order?.token ?? token.replace(/^#/, '').trim()) || 'draft';
    const result = await LSApi.saveVendorBill({
      order_id: order?.id ?? null,
      order_token: orderToken,
      order_number: order?.order_number ?? null,
      customer_name: user?.full_name ?? null,
      customer_phone: user?.phone ?? null,
      user_id: order?.user_id ?? user?.id ?? null,
      line_items: lineItems,
      subtotal,
      convenience_fee: CONVENIENCE_FEE,
      total,
    });
    if (result) lastSavedBillFingerprintRef.current = fingerprint;
    showToast(result ? 'Bill saved. Printing…' : 'Printing…', result ? 'ok' : 'er');
    await doPrint();
  };

  const handleNewBill = () => {
    setToken('');
    setLookupErr('');
    setOrder(null);
    setUser(null);
    setLineItems([]);
    setBillAlreadyGenerated(false);
    setShowAnyway(false);
    lastSavedBillFingerprintRef.current = null;
  };

  return (
    <div className="vendor-page" style={{ fontFamily: 'var(--fb)', background: 'var(--bg)' }}>
      <p style={{ marginBottom: 16, fontSize: 14 }}>
        <Link href="/admin" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>← Back to Dashboard</Link>
      </p>
      <h1 style={{ fontFamily: 'var(--fd)', fontSize: 24, marginBottom: 6, color: 'var(--b)' }}>Vendor Bill</h1>
      <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>Enter token to load order, add line items, then print bill.</p>

      <div className="vendor-card">
        <form onSubmit={handleLookup}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Token number</label>
            <input
              type="text"
              className="vendor-input"
              placeholder="e.g. A704"
              value={token}
              onChange={(e) => setToken(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="off"
              style={{ textTransform: 'uppercase' }}
            />
          </div>
          <button type="submit" className="vendor-btn-primary" style={{ width: '100%', minHeight: 52 }}>Lookup order</button>
          {lookupErr && <p style={{ color: 'var(--er)', fontSize: 13, marginTop: 8 }}>{lookupErr}</p>}
        </form>
      </div>

      {order && billAlreadyGenerated && !showAnyway && (
        <div className="vendor-card">
          <div style={{ padding: '12px 16px', background: '#FEF3C7', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#92400E' }}>
            <strong>A bill was already generated for this token.</strong> If you need to add more items (e.g. few missed), click Continue below.
          </div>
          <button type="button" onClick={() => setShowAnyway(true)} className="vendor-btn-primary" style={{ width: '100%' }}>Continue</button>
        </div>
      )}

      {order && (showAnyway || !billAlreadyGenerated) && (
        <div className="vendor-card">
          {billAlreadyGenerated && showAnyway && (
            <div style={{ padding: '12px 16px', background: '#FEF3C7', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#92400E' }}>
              Adding another bill for same token (e.g. missed items).
              <button type="button" onClick={() => setShowAnyway(false)} style={{ display: 'block', marginTop: 8, color: 'var(--b)', fontWeight: 600 }}>← Back</button>
            </div>
          )}
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ts)', marginBottom: 20 }}>
            <p><strong style={{ color: 'var(--tx)' }}>Order:</strong> {order.order_number} &nbsp;|&nbsp; <strong>Token:</strong> #{order.token}</p>
            <p><strong style={{ color: 'var(--tx)' }}>Customer ID:</strong> {(user as UserRow & { display_id?: string | null })?.display_id ?? '—'} &nbsp;|&nbsp; <strong>Customer:</strong> {user?.full_name ?? user?.email ?? '—'}</p>
            <p><strong style={{ color: 'var(--tx)' }}>Phone:</strong> {user?.phone ?? '—'} &nbsp;|&nbsp; <strong>Email:</strong> {user?.email ?? '—'}</p>
            <p><strong style={{ color: 'var(--tx)' }}>Service:</strong> {order.service_name} &nbsp;|&nbsp; <strong>Date:</strong> {order.pickup_date}</p>
          </div>

          <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 16, marginTop: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--tx)' }}>Tap an item to add one (tap again to add more)</p>
            <div className="vendor-item-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
              {VENDOR_BILL_ITEMS.map((i) => {
                const line = lineItems.find((l) => l.id === i.id);
                const qty = line?.qty ?? 0;
                return (
                  <div key={i.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => addItem(i.id)}
                      className={`vendor-item-btn ${qty > 0 ? 'has-qty' : ''}`}
                    >
                      {i.label}
                      {qty > 0 && <span style={{ display: 'block', fontSize: 12, marginTop: 2 }}>×{qty} ₹{i.price * qty}</span>}
                    </button>
                    {qty > 0 && (
                      <button type="button" onClick={() => removeOne(i.id)} className="vendor-item-btn-minus">
                        −1
                      </button>
                    )}
                  </div>
                );
              })}
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
                      <button type="button" onClick={() => removeLine(i)} className="vendor-item-btn-minus" style={{ marginLeft: 8, minWidth: 44 }} aria-label="Remove line">×</button>
                    </span>
                  </div>
                ))
              )}
            </div>

            <p style={{ fontSize: 13, color: 'var(--ts)' }}>Total items: {lineItems.reduce((s, l) => s + l.qty, 0)}</p>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Subtotal: ₹{subtotal}</p>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Convenience fee: ₹{CONVENIENCE_FEE}</p>
            <p style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>Total: ₹{total}</p>

            <div className="vendor-action-row" style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" onClick={handlePrint} className="vendor-btn-primary" style={{ flex: '1 1 200px' }}>Print bill</button>
              <button type="button" onClick={handleCopyReceipt} disabled={lineItems.length === 0} className="vendor-btn-secondary" style={{ flex: '1 1 200px' }}>Copy receipt</button>
              <button
                type="button"
                onClick={handleSaveBill}
                disabled={saving || lineItems.length === 0}
                className="vendor-btn-secondary"
                style={{ flex: '1 1 200px' }}
              >
                {saving ? 'Saving…' : 'Save bill'}
              </button>
              <button type="button" onClick={handleNewBill} className="vendor-btn-secondary" style={{ flex: '1 1 200px' }}>New bill</button>
              <Link href="/admin/bills" className="vendor-btn-secondary" style={{ flex: '1 1 200px', textDecoration: 'none' }}>View saved bills</Link>
            </div>
            <p style={{ marginTop: 10, fontSize: 12, color: 'var(--ts)' }}>Set your printer in <Link href="/admin/printers" style={{ color: 'var(--b)', fontWeight: 600 }}>Admin → Printers</Link> (e.g. Epson M80 79mm). On Android: install <strong>ESCPOS Bluetooth Print Service</strong> if needed, then pair and choose it in the print dialog.</p>
          </div>
        </div>
      )}

      {toast && <div className={toast.type} style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '12px 20px', borderRadius: 12, background: toast.type === 'ok' ? 'var(--ok)' : 'var(--er)', color: '#fff', fontSize: 14, fontWeight: 500, zIndex: 9999 }}>{toast.msg}</div>}
    </div>
  );
}
