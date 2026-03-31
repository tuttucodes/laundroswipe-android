'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { printThermalReceipt, printThermalReceiptDirect } from '@/lib/thermal-print';
import { getPrinterConfigForPrint } from '@/lib/printer-settings';
import type { VendorBillRow } from '@/lib/api';

function billToHtml(b: VendorBillRow) {
  const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = Array.isArray(b.line_items) && b.line_items.length
    ? b.line_items.map((l: { label: string; qty: number; price: number }) => `<tr><td>${l.label} x${l.qty}</td><td class="right">₹${l.price * l.qty}</td></tr>`).join('')
    : '<tr><td colspan="2">No items</td></tr>';
  const emailLine =
    b.user_email != null && String(b.user_email).trim() !== ''
      ? `<p><strong>Email:</strong> ${esc(String(b.user_email))}</p>`
      : '';
  const idLine =
    b.user_display_id != null && String(b.user_display_id).trim() !== ''
      ? `<p><strong>Customer ID:</strong> ${esc(String(b.user_display_id))}</p>`
      : '';
  return `
    <h2>LaundroSwipe</h2>
    <p class="meta">Vendor name: ${esc(b.vendor_name ?? 'Vendor')}</p>
    <p><strong>Token:</strong> #${b.order_token} &nbsp; <strong>Order:</strong> ${b.order_number ?? '—'}</p>
    <p><strong>Customer:</strong> ${esc(b.customer_name ?? '—')}</p>
    <p><strong>Phone:</strong> ${esc(b.customer_phone ?? '—')}</p>
    ${emailLine}
    ${idLine}
    <p><strong>Date:</strong> ${b.created_at ? new Date(b.created_at).toLocaleString() : ''}</p>
    <table>
      <thead><tr><th>Item</th><th class="right">₹</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="right receipt-summary">Subtotal: ₹${b.subtotal}</p>
    <p class="right conv">Convenience fee: ₹${b.convenience_fee}</p>
    <p class="total right">Total: ₹${b.total}</p>
    <p class="foot">Thank you!</p>
  `;
}

function billToPlainText(b: VendorBillRow): string {
  const items = Array.isArray(b.line_items) && b.line_items.length
    ? b.line_items.map((l: { label: string; qty: number; price: number }) => `${l.label} x${l.qty}    ₹${l.price * l.qty}`)
    : [];
  const extra: string[] = [];
  if (b.user_email != null && String(b.user_email).trim() !== '') extra.push(`Email: ${b.user_email}`);
  if (b.user_display_id != null && String(b.user_display_id).trim() !== '') extra.push(`Customer ID: ${b.user_display_id}`);
  return [
    'LaundroSwipe',
    `Vendor: ${b.vendor_name ?? 'Vendor'}`,
    `Token: #${b.order_token}  Order: ${b.order_number ?? '—'}`,
    `Customer: ${b.customer_name ?? '—'}`,
    `Phone: ${b.customer_phone ?? '—'}`,
    ...extra,
    `Date: ${b.created_at ? new Date(b.created_at).toLocaleString() : ''}`,
    '---',
    ...items,
    '---',
    `Subtotal: ₹${b.subtotal}`,
    `Conv fee: ₹${b.convenience_fee}`,
    `TOTAL: ₹${b.total}`,
    'Thank you!',
  ].join('\n');
}

export default function BillsPage() {
  const [bills, setBills] = useState<VendorBillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingBill, setViewingBill] = useState<VendorBillRow | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [vendorName, setVendorName] = useState<string | null>(null);

  useEffect(() => {
    const role = typeof window !== 'undefined' ? localStorage.getItem('admin_role') : null;
    const vendorId = typeof window !== 'undefined' ? localStorage.getItem('admin_vendor_id') : null;
    setIsSuperAdmin(role === 'super_admin');
    setVendorName(
      role === 'vendor' && vendorId
        ? localStorage.getItem('admin_vendor_name') || vendorId
        : null,
    );

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
    const headers = token
      ? ({ Authorization: `Bearer ${token}` } as Record<string, string>)
      : ({} as Record<string, string>);

    fetch('/api/vendor/bills', { credentials: 'include', headers })
      .then(async (r) => {
        if (r.status === 401) {
          sessionStorage.removeItem('admin_token');
          localStorage.removeItem('admin_logged');
          setLoading(false);
          return null;
        }
        const data = await r.json().catch(() => ({}));
        return data?.bills ?? [];
      })
      .then((rows) => {
        if (!rows) return;
        setBills(rows as VendorBillRow[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const escapeCsv = (v: string | number | null | undefined): string => {
    const s = v == null ? '' : String(v);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const exportBillsToCsv = () => {
    const cols = ['Token', 'Order', 'Customer', 'Phone', 'Date', 'Subtotal', 'Convenience fee', 'Total', 'Line items'];
    const rows = bills.map((b) => {
      const items = Array.isArray(b.line_items) && b.line_items.length
        ? b.line_items.map((l: { label: string; qty: number; price: number }) => `${l.label} x${l.qty} ₹${l.price * l.qty}`).join('; ')
        : '';
      return [
        escapeCsv(b.order_token),
        escapeCsv(b.order_number),
        escapeCsv(b.customer_name),
        escapeCsv(b.customer_phone),
        escapeCsv(b.created_at ? new Date(b.created_at).toISOString() : ''),
        escapeCsv(b.subtotal),
        escapeCsv(b.convenience_fee),
        escapeCsv(b.total),
        escapeCsv(items),
      ];
    });
    const csv = [cols.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `laundroswipe-bills-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const printBill = async (b: VendorBillRow) => {
    const config = getPrinterConfigForPrint();
    await printThermalReceiptDirect(
      `Bill #${b.order_token}`,
      billToHtml(b),
      billToPlainText(b),
      { printer: config ?? undefined, forceDialog: config?.forceDialog ?? true }
    );
  };

  const copyBill = async (b: VendorBillRow) => {
    try {
      await navigator.clipboard.writeText(billToPlainText(b));
      setCopyMsg('Copied. Paste in your printer app to print.');
      setTimeout(() => setCopyMsg(null), 3000);
    } catch {
      setCopyMsg('Copy failed');
      setTimeout(() => setCopyMsg(null), 2000);
    }
  };

  return (
    <div className="vendor-page" style={{ fontFamily: 'var(--fb)', background: 'var(--bg)' }}>
      <p style={{ marginBottom: 16, fontSize: 14 }}>
        <Link href="/admin" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>← Dashboard</Link>
        {' · '}
        <Link href="/admin/vendor" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>Vendor Bill</Link>
        {' · '}
        <Link href="/admin/printers" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>Printers</Link>
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--fd)', fontSize: 24, marginBottom: 6, color: 'var(--b)' }}>
            {isSuperAdmin ? 'All vendor bills' : `${vendorName ?? 'Vendor'} bills`}
          </h1>
          <p style={{ color: 'var(--ts)', fontSize: 14, margin: 0 }}>View and re-print past bills.</p>
        </div>
        <button type="button" onClick={exportBillsToCsv} disabled={loading || bills.length === 0} className="vendor-btn-secondary" style={{ marginLeft: 'auto' }}>
          📥 Export to Excel
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--ts)' }}>Loading…</p>
      ) : bills.length === 0 ? (
        <div className="vendor-card" style={{ padding: 32, textAlign: 'center', color: 'var(--ts)' }}>
          <p style={{ marginBottom: 8 }}>No saved bills yet.</p>
          <p style={{ margin: 0 }}><Link href="/admin/vendor" style={{ color: 'var(--b)', fontWeight: 600 }}>Create a bill</Link> and click &quot;Save bill&quot; to see it here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {bills.map((b) => (
            <div key={b.id} className="vendor-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ flex: '1 1 200px' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--b)' }}>#{b.order_token} · {b.order_number ?? '—'}</div>
                <div style={{ fontSize: 13, color: 'var(--ts)', marginTop: 4 }}>{b.customer_name ?? '—'} · {b.customer_phone ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--tm)', marginTop: 2 }}>{b.created_at ? new Date(b.created_at).toLocaleString() : ''}</div>
                <div style={{ fontSize: 14, marginTop: 6, fontWeight: 600 }}>₹{b.total}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button type="button" onClick={() => setViewingBill(b)} className="vendor-btn-secondary">
                  View bill
                </button>
                <button type="button" onClick={() => printBill(b)} className="vendor-btn-primary">
                  Print
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingBill && (
        <div className="bill-popup-overlay" onClick={() => setViewingBill(null)}>
          <div className="bill-popup-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontFamily: 'var(--fd)', fontSize: 18, margin: 0 }}>Bill #{viewingBill.order_token}</h3>
              <button type="button" onClick={() => setViewingBill(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--ts)', lineHeight: 1, padding: 4 }} aria-label="Close">×</button>
            </div>
            <style>{`.bill-view-content table{width:100%;border-collapse:collapse}.bill-view-content .right{text-align:right}.bill-view-content .total{font-weight:700;border-top:2px solid #000;padding-top:4px;margin-top:4px}.bill-view-content .conv{color:#666}.bill-view-content h2{text-align:center;margin:0 0 8px}.bill-view-content p{margin:4px 0}`}</style>
            <div className="bill-view-content" style={{ fontFamily: 'system-ui', fontSize: 13, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: billToHtml(viewingBill) }} />
            {isSuperAdmin && viewingBill.user_id && (
              <p style={{ marginTop: 14, fontSize: 13 }}>
                <Link
                  href={`/admin?tab=users&userSearch=${encodeURIComponent(viewingBill.user_id)}`}
                  style={{ color: 'var(--b)', fontWeight: 600 }}
                >
                  Open this user in Users
                </Link>
              </p>
            )}
            {copyMsg && <p style={{ marginTop: 12, fontSize: 13, color: 'var(--ok)' }}>{copyMsg}</p>}
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button type="button" onClick={() => printBill(viewingBill)} className="vendor-btn-primary" style={{ flex: 1 }}>Print</button>
              <button type="button" onClick={() => copyBill(viewingBill)} className="vendor-btn-secondary" style={{ flex: 1 }}>Copy receipt</button>
              <button type="button" onClick={() => setViewingBill(null)} className="vendor-btn-secondary" style={{ flex: 1 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
