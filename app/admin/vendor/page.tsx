'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { printThermalReceipt, printThermalReceiptDirect } from '@/lib/thermal-print';
import { getPrinterConfigForPrint } from '@/lib/printer-settings';
import { getVendorBillItems } from '@/lib/constants';
import { applyServiceFeeDiscount, SERVICE_FEE_SHORT_EXPLANATION } from '@/lib/fees';
import type { OrderRow, UserRow } from '@/lib/api';
type LineItem = { id: string; label: string; price: number; qty: number };
type LatestBill = { id: string; created_at: string; can_cancel: boolean };

export default function VendorPage() {
  const [vendorName, setVendorName] = useState('Vendor');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [lookupErr, setLookupErr] = useState('');
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [user, setUser] = useState<UserRow | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [billAlreadyGenerated, setBillAlreadyGenerated] = useState(false);
  const [showAnyway, setShowAnyway] = useState(false);
  const [sampleMode, setSampleMode] = useState(false);
  const [sampleCustomerName, setSampleCustomerName] = useState('');
  const [sampleCustomerPhone, setSampleCustomerPhone] = useState('');
  const [latestBill, setLatestBill] = useState<LatestBill | null>(null);
  const [cancellingLatestBill, setCancellingLatestBill] = useState(false);
  const lastSavedBillFingerprintRef = useRef<string | null>(null);
  const vendorBillItems = getVendorBillItems(vendorId);

  const adminAuthHeaders = (): Record<string, string> => {
    const t = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const showToast = (msg: string, type: string) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const role = localStorage.getItem('admin_role');
    const slug = localStorage.getItem('admin_vendor_id');
    const displayName = localStorage.getItem('admin_vendor_name');
    if (role !== 'vendor' || !slug) return;
    setVendorId(slug);
    setVendorName(displayName?.trim() || slug);
  }, []);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupErr('');
    setOrder(null);
    setUser(null);
    setLineItems([]);
    setBillAlreadyGenerated(false);
    setShowAnyway(false);
    setSampleMode(false);
    setLatestBill(null);
    lastSavedBillFingerprintRef.current = null;
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
      if (res.status === 401) {
        setLookupErr('Session expired. Log in again.');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setLookupErr(data?.error || 'Order not found for this token');
        return;
      }
      setOrder(data.order as OrderRow);
      setUser((data.user ?? null) as UserRow | null);
      setBillAlreadyGenerated(Number(data.existing_bills_count ?? 0) > 0);
      setLatestBill((data.latest_bill ?? null) as LatestBill | null);
      showToast('Order loaded', 'ok');
    } catch {
      setLookupErr('Order lookup failed');
    }
  };

  const addItem = (itemId: string) => {
    const item = vendorBillItems.find((i) => i.id === itemId);
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
  const feeBreakdown = applyServiceFeeDiscount(subtotal);
  const serviceFee = feeBreakdown.finalFee;
  const total = subtotal + serviceFee;

  const billFingerprint = (): string => {
    const orderToken = sampleMode ? 'sample' : (order?.token ?? token.replace(/^#/, '').trim()) || 'draft';
    const itemsKey = [...lineItems]
      .sort((a, b) => a.id.localeCompare(b.id) || a.qty - b.qty)
      .map((l) => `${l.id}:${l.qty}:${l.price}`)
      .join('|');
    return `${orderToken}|${itemsKey}|${subtotal}|${total}`;
  };

  const buildReceiptHtml = () => {
    const totalItems = lineItems.reduce((sum, item) => sum + item.qty, 0);
    const rows = lineItems.length
      ? lineItems.map((l) => `<tr><td class="qty-col">${l.qty}</td><td class="desc-col">${l.label}<br/><span class="meta">@₹${l.price.toFixed(2)}</span></td><td class="amt-col">₹${(l.price * l.qty).toFixed(2)}</td></tr>`).join('')
      : '<tr><td class="qty-col">0</td><td class="desc-col">No items</td><td class="amt-col">₹0.00</td></tr>';
    const o = order as OrderRow | null;
    const u = (user ?? {}) as Partial<UserRow & { display_id?: string | null }>;
    const tokenLabel = sampleMode ? 'SAMPLE' : o?.token ?? '';
    const orderLabel = sampleMode ? 'Sample Bill' : o?.order_number ?? '';
    const customerLabel = sampleMode ? (sampleCustomerName.trim() || 'Walk-in Customer') : (u.full_name ?? u.email ?? '—').toString().slice(0, 20);
    const phoneLabel = sampleMode ? (sampleCustomerPhone.trim() || '—') : (u.phone ?? '—').toString().slice(0, 14);
    const dateStr = new Date().toLocaleString();
    const serviceFeeHtml = feeBreakdown.active && feeBreakdown.originalFee > 0
      ? `<span>Service fee (7-day discount)</span><span><s>₹${feeBreakdown.originalFee.toFixed(2)}</s> ₹0.00</span>`
      : `<span>Service fee</span><span>₹${serviceFee.toFixed(2)}</span>`;
    return `
<h2>LaundroSwipe</h2>
<p class="meta center">${vendorName}</p>
<p class="center">Token: #${tokenLabel}</p>
<p class="center">Order: ${orderLabel}</p>
<p class="center">Customer: ${customerLabel}</p>
<p class="center">Phone: ${phoneLabel}</p>
<p class="center">Date: ${dateStr}</p>
<div class="row-divider"></div>
<table>
<thead><tr><th class="qty-col">Qty</th><th class="desc-col">Description</th><th class="amt-col">Amount</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<div class="row-divider"></div>
<div class="totals">
  <p><span>Total items</span><span>${totalItems}</span></p>
  <p><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></p>
  <p class="conv">${serviceFeeHtml}</p>
  <p class="total"><span>Total</span><span>₹${total.toFixed(2)}</span></p>
</div>
<p class="foot">Thank you!</p>
`;
  };

  const buildReceiptPlainText = () => {
    const o = order as OrderRow | null;
    const u = (user ?? {}) as Partial<UserRow>;
    const tokenLabel = sampleMode ? 'SAMPLE' : o?.token ?? '';
    const orderLabel = sampleMode ? 'Sample Bill' : o?.order_number ?? '';
    const customerLabel = sampleMode ? (sampleCustomerName.trim() || 'Walk-in Customer') : (u.full_name ?? u.email ?? '—').toString().slice(0, 24);
    const phoneLabel = sampleMode ? (sampleCustomerPhone.trim() || '—') : (u.phone ?? '—').toString().slice(0, 14);
    const totalItems = lineItems.reduce((sum, item) => sum + item.qty, 0);
    const lines = [
      'LaundroSwipe',
      `Vendor: ${vendorName}`,
      `Token: #${tokenLabel}  Order: ${orderLabel}`,
      `Customer ID: ${sampleMode ? '—' : (u.display_id ?? '—').toString().slice(0, 24)}`,
      `Customer: ${customerLabel}`,
      `Phone: ${phoneLabel}`,
      '---',
      ...lineItems.map((l) => `${l.label} x${l.qty}    ₹${l.price * l.qty}`),
      '---',
      `Total items: ${totalItems}`,
      `Subtotal: ₹${subtotal}`,
      feeBreakdown.active && feeBreakdown.originalFee > 0
        ? `Service fee: ₹0 (discounted from ₹${feeBreakdown.originalFee} for 7 days)`
        : `Service fee: ₹${serviceFee}`,
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
    if (sampleMode) {
      showToast('Sample bills are print/copy only and are not saved.', 'er');
      return;
    }
    if (!order?.token) {
      showToast('Load an order first', 'er');
      return;
    }
    const orderToken = order.token;
    setSaving(true);
    try {
      const res = await fetch('/api/vendor/bills/save', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({
          token: orderToken,
          order_number: order.order_number ?? null,
          line_items: lineItems.map((l) => ({ id: l.id, qty: l.qty })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        showToast(data?.error || 'Save failed', 'er');
        return;
      }
      setBillAlreadyGenerated(true);
      setLatestBill(null);
      showToast('Bill saved', 'ok');
    } catch {
      showToast('Save failed', 'er');
    } finally {
      setSaving(false);
    }
  };

  const doPrint = async () => {
    const title = sampleMode ? 'Sample Bill' : `Bill #${order?.token ?? ''}`;
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

  const handleCancelLatestBill = async () => {
    if (!latestBill?.id || !latestBill.can_cancel) return;
    setCancellingLatestBill(true);
    try {
      const res = await fetch('/api/vendor/bills/cancel', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ bill_id: latestBill.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        showToast(data?.error || 'Cancel failed', 'er');
        return;
      }
      setLatestBill(null);
      setBillAlreadyGenerated(false);
      showToast('Latest bill cancelled', 'ok');
    } catch {
      showToast('Cancel failed', 'er');
    } finally {
      setCancellingLatestBill(false);
    }
  };

  const handlePrint = async () => {
    const currentOrder = order;
    if (lineItems.length === 0) {
      showToast('Add at least one item', 'er');
      return;
    }
    if (!sampleMode && !currentOrder?.token) {
      showToast('Load an order first', 'er');
      return;
    }
    if (sampleMode) {
      showToast('Printing sample bill…', 'ok');
      await doPrint();
      return;
    }
    if (!currentOrder?.token) {
      showToast('Load an order first', 'er');
      return;
    }
    const fingerprint = billFingerprint();
    if (lastSavedBillFingerprintRef.current === fingerprint) {
      showToast('Printing…', 'ok');
      await doPrint();
      return;
    }
    showToast('Saving & printing…', 'ok');
    const orderToken = currentOrder.token;
    try {
      const res = await fetch('/api/vendor/bills/save', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({
          token: orderToken,
          order_number: currentOrder.order_number ?? null,
          line_items: lineItems.map((l) => ({ id: l.id, qty: l.qty })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        lastSavedBillFingerprintRef.current = fingerprint;
        showToast('Bill saved. Printing…', 'ok');
      } else {
        showToast('Printing…', 'er');
      }
    } catch {
      showToast('Printing…', 'er');
    }
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
    setSampleMode(false);
    setSampleCustomerName('');
    setSampleCustomerPhone('');
    setLatestBill(null);
    lastSavedBillFingerprintRef.current = null;
  };

  return (
    <div className="vendor-page" style={{ fontFamily: 'var(--fb)', background: 'var(--bg)' }}>
      <p style={{ marginBottom: 16, fontSize: 14 }}>
        <Link href="/admin" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>← Back to Dashboard</Link>
      </p>
      <h1 style={{ fontFamily: 'var(--fd)', fontSize: 24, marginBottom: 6, color: 'var(--b)' }}>{vendorName} · Vendor Bill</h1>
      <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>Enter token to load order, or create a sample bill for walk-ins/emergency print.</p>

      <div className="vendor-card">
        <form onSubmit={handleLookup}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Token number</label>
            <input
              type="text"
              className="vendor-input"
              placeholder="e.g. A7K4"
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
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            className="vendor-btn-secondary"
            style={{ width: '100%' }}
            onClick={() => {
              setOrder(null);
              setUser(null);
              setToken('');
              setLookupErr('');
              setLineItems([]);
              setBillAlreadyGenerated(false);
              setShowAnyway(false);
              setSampleMode(true);
              showToast('Sample bill mode enabled', 'ok');
            }}
          >
            Create sample bill (no token)
          </button>
        </div>
      </div>

      {order && billAlreadyGenerated && !showAnyway && (
        <div className="vendor-card">
          <div style={{ padding: '12px 16px', background: '#FEF3C7', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#92400E' }}>
            <strong>A bill was already generated for this token.</strong> If you need to add more items (e.g. few missed), click Continue below.
          </div>
          {latestBill && (
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--ts)' }}>
              Latest bill: {new Date(latestBill.created_at).toLocaleString()}
              {latestBill.can_cancel ? ' (can cancel within 1 hour)' : ''}
            </div>
          )}
          {latestBill?.can_cancel && (
            <button
              type="button"
              onClick={handleCancelLatestBill}
              className="vendor-btn-secondary"
              style={{ width: '100%', marginBottom: 10 }}
              disabled={cancellingLatestBill}
            >
              {cancellingLatestBill ? 'Cancelling latest bill…' : 'Cancel latest bill'}
            </button>
          )}
          <button type="button" onClick={() => setShowAnyway(true)} className="vendor-btn-primary" style={{ width: '100%' }}>Continue</button>
        </div>
      )}

      {(sampleMode || (order && (showAnyway || !billAlreadyGenerated))) && (
        <div className="vendor-card">
          {billAlreadyGenerated && showAnyway && !sampleMode && (
            <div style={{ padding: '12px 16px', background: '#FEF3C7', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#92400E' }}>
              Adding another bill for same token (e.g. missed items).
              <button type="button" onClick={() => setShowAnyway(false)} style={{ display: 'block', marginTop: 8, color: 'var(--b)', fontWeight: 600 }}>← Back</button>
            </div>
          )}
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ts)', marginBottom: 20 }}>
            {sampleMode ? (
              <>
                <p><strong style={{ color: 'var(--tx)' }}>Order:</strong> Sample Bill &nbsp;|&nbsp; <strong>Token:</strong> #SAMPLE</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(140px, 1fr))', gap: 10 }}>
                  <input className="vendor-input" placeholder="Customer name (optional)" value={sampleCustomerName} onChange={(e) => setSampleCustomerName(e.target.value)} />
                  <input className="vendor-input" placeholder="Phone (optional)" value={sampleCustomerPhone} onChange={(e) => setSampleCustomerPhone(e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <p><strong style={{ color: 'var(--tx)' }}>Order:</strong> {order?.order_number} &nbsp;|&nbsp; <strong>Token:</strong> #{order?.token}</p>
                <p><strong style={{ color: 'var(--tx)' }}>Customer ID:</strong> {(user as UserRow & { display_id?: string | null })?.display_id ?? '—'} &nbsp;|&nbsp; <strong>Customer:</strong> {user?.full_name ?? user?.email ?? '—'}</p>
                <p><strong style={{ color: 'var(--tx)' }}>Phone:</strong> {user?.phone ?? '—'} &nbsp;|&nbsp; <strong>Email:</strong> {user?.email ?? '—'}</p>
                <p><strong style={{ color: 'var(--tx)' }}>Service:</strong> {order?.service_name} &nbsp;|&nbsp; <strong>Date:</strong> {order?.pickup_date}</p>
              </>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 16, marginTop: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--tx)' }}>Tap an item to add one (tap again to add more)</p>
            <div className="vendor-item-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
              {vendorBillItems.map((i) => {
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
            {feeBreakdown.active && feeBreakdown.originalFee > 0 ? (
              <p style={{ fontWeight: 600, fontSize: 14 }}>
                Service fee: <span style={{ textDecoration: 'line-through', color: 'var(--ts)' }}>₹{feeBreakdown.originalFee}</span> ₹0
                <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--ok)' }}>(7-day discount)</span>
              </p>
            ) : (
              <p style={{ fontWeight: 600, fontSize: 14 }}>Service fee: ₹{serviceFee}</p>
            )}
            <p style={{ fontSize: 12, color: 'var(--ts)', lineHeight: 1.5 }}>{SERVICE_FEE_SHORT_EXPLANATION}</p>
            <p style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>Total: ₹{total}</p>

            <div className="vendor-action-row" style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" onClick={handlePrint} className="vendor-btn-primary" style={{ flex: '1 1 200px' }}>Print bill</button>
              <button type="button" onClick={handleCopyReceipt} disabled={lineItems.length === 0} className="vendor-btn-secondary" style={{ flex: '1 1 200px' }}>Copy receipt</button>
              <button
                type="button"
                onClick={handleSaveBill}
                disabled={sampleMode || saving || lineItems.length === 0}
                className="vendor-btn-secondary"
                style={{ flex: '1 1 200px' }}
              >
                {sampleMode ? 'Save disabled in sample mode' : saving ? 'Saving…' : 'Save bill'}
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
