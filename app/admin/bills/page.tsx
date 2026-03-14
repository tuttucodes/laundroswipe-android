'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LSApi } from '@/lib/api';
import type { VendorBillRow } from '@/lib/api';
import { CONVENIENCE_FEE } from '@/lib/constants';

function billToHtml(b: VendorBillRow) {
  const rows = Array.isArray(b.line_items) && b.line_items.length
    ? b.line_items.map((l: { label: string; qty: number; price: number }) => `<tr><td>${l.label} x${l.qty}</td><td class="right">₹${l.price * l.qty}</td></tr>`).join('')
    : '<tr><td colspan="2">No items</td></tr>';
  return `
    <h2>LaundroSwipe</h2>
    <p class="meta">Pro Fab Power Laundry</p>
    <p><strong>Token:</strong> #${b.order_token} &nbsp; <strong>Order:</strong> ${b.order_number ?? '—'}</p>
    <p><strong>Customer:</strong> ${b.customer_name ?? '—'}</p>
    <p><strong>Phone:</strong> ${b.customer_phone ?? '—'}</p>
    <p><strong>Date:</strong> ${b.created_at ? new Date(b.created_at).toLocaleString() : ''}</p>
    <table>
      <thead><tr><th>Item</th><th class="right">₹</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="right">Subtotal: ₹${b.subtotal}</p>
    <p class="right conv">Convenience fee: ₹${b.convenience_fee}</p>
    <p class="total right">Total: ₹${b.total}</p>
    <p style="text-align:center;margin-top:12px;font-size:10px">Thank you!</p>
  `;
}

export default function BillsPage() {
  const [bills, setBills] = useState<VendorBillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingBill, setViewingBill] = useState<VendorBillRow | null>(null);

  useEffect(() => {
    LSApi.fetchVendorBills().then((data) => {
      setBills(data ?? []);
      setLoading(false);
    });
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

  const printBill = (b: VendorBillRow) => {
    const html = billToHtml(b);
    const w = window.open('', '_blank', 'width=320,height=480');
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bill #${b.order_token}</title>
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
      </style></head><body>${html}</body></html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  return (
    <div className="vendor-page" style={{ fontFamily: 'var(--fb)', background: 'var(--bg)' }}>
      <p style={{ marginBottom: 12 }}>
        <Link href="/admin" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>← Dashboard</Link>
        {' · '}
        <Link href="/admin/vendor" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>Vendor Bill</Link>
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--fd)', fontSize: 22, marginBottom: 8, color: 'var(--b)' }}>Saved bills</h1>
          <p style={{ color: 'var(--ts)', fontSize: 14, margin: 0 }}>View and re-print past bills.</p>
        </div>
        <button type="button" onClick={exportBillsToCsv} disabled={loading || bills.length === 0} className="vendor-btn-secondary" style={{ marginLeft: 'auto' }}>
          📥 Export to Excel
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--ts)' }}>Loading…</p>
      ) : bills.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 32, textAlign: 'center', color: 'var(--ts)' }}>
          <p>No saved bills yet.</p>
          <p style={{ marginTop: 8 }}><Link href="/admin/vendor" style={{ color: 'var(--b)', fontWeight: 600 }}>Create a bill</Link> and click &quot;Save bill&quot; to see it here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bills.map((b) => (
            <div
              key={b.id}
              style={{
                background: '#fff',
                borderRadius: 14,
                padding: 16,
                boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ flex: '1 1 200px' }}>
                <div style={{ fontWeight: 700, color: 'var(--b)' }}>#{b.order_token} · {b.order_number ?? '—'}</div>
                <div style={{ fontSize: 13, color: 'var(--ts)' }}>{b.customer_name ?? '—'} · {b.customer_phone ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--tm)' }}>{b.created_at ? new Date(b.created_at).toLocaleString() : ''}</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>₹{b.total}</div>
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setViewingBill(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, maxWidth: 360, width: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--fd)', fontSize: 18, margin: 0 }}>Bill #{viewingBill.order_token}</h3>
              <button type="button" onClick={() => setViewingBill(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ts)' }} aria-label="Close">×</button>
            </div>
            <style>{`.bill-view-content table{width:100%;border-collapse:collapse}.bill-view-content .right{text-align:right}.bill-view-content .total{font-weight:700;border-top:2px solid #000;padding-top:4px;margin-top:4px}.bill-view-content .conv{color:#666}.bill-view-content h2{text-align:center;margin:0 0 8px}.bill-view-content p{margin:4px 0}`}</style>
            <div className="bill-view-content" style={{ fontFamily: 'system-ui', fontSize: 13, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: billToHtml(viewingBill) }} />
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button type="button" onClick={() => printBill(viewingBill)} className="vendor-btn-primary" style={{ flex: 1 }}>Print</button>
              <button type="button" onClick={() => setViewingBill(null)} className="vendor-btn-secondary" style={{ flex: 1 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
