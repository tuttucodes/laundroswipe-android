'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { printThermalReceiptDirect } from '@/lib/thermal-print';
import { getPrinterConfigForPrint } from '@/lib/printer-settings';
import { buildVendorReceiptEscPos, printEscPosViaBluetooth } from '@/lib/printing';
import { getEffectiveEscPosPaperSize } from '@/lib/ble-printer-settings';
import type { VendorBillRow } from '@/lib/api';
import { calculateServiceFee } from '@/lib/fees';
import { getVendorBillItems } from '@/lib/constants';
import { applyServiceFeeDiscount, SERVICE_FEE_SHORT_EXPLANATION } from '@/lib/fees';
import { isWithinVendorBillCancelEditWindow } from '@/lib/vendor-bill-policy';

type LineItem = { id: string; label: string; price: number; qty: number; image_url?: string | null };
type CatalogRow = { id: string; label: string; price: number; image_url?: string | null };

function billLineItemsToState(b: VendorBillRow): LineItem[] {
  if (!Array.isArray(b.line_items)) return [];
  return b.line_items.map((x: { id: string; label: string; price: number; qty: number; image_url?: string | null }) => ({
    id: String(x.id),
    label: String(x.label),
    price: Number(x.price),
    qty: Math.max(1, Math.floor(Number(x.qty))),
    image_url: x.image_url ?? null,
  }));
}

function billToHtml(b: VendorBillRow) {
  const totalItems = Array.isArray(b.line_items)
    ? b.line_items.reduce((sum, l: { qty: number }) => sum + Number(l.qty || 0), 0)
    : 0;
  const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = Array.isArray(b.line_items) && b.line_items.length
    ? b.line_items.map((l: { label: string; qty: number; price: number }) => `<tr><td class="qty-col">${l.qty}</td><td class="desc-col">${esc(l.label)}<br/><span class="meta">@₹${Number(l.price).toFixed(2)}</span></td><td class="amt-col">₹${(Number(l.price) * Number(l.qty)).toFixed(2)}</td></tr>`).join('')
    : '<tr><td class="qty-col">0</td><td class="desc-col">No items</td><td class="amt-col">₹0.00</td></tr>';
  const emailLine =
    b.user_email != null && String(b.user_email).trim() !== ''
      ? `<p><strong>Email:</strong> ${esc(String(b.user_email))}</p>`
      : '';
  const idLine =
    b.user_display_id != null && String(b.user_display_id).trim() !== ''
      ? `<p><strong>Customer ID:</strong> ${esc(String(b.user_display_id))}</p>`
      : '';
  const reg = String(b.customer_reg_no ?? '').trim();
  const blk = String(b.customer_hostel_block ?? '').trim();
  const rm = String(b.customer_room_number ?? '').trim();
  const regLine = reg ? `<p class="center"><strong>Reg no:</strong> ${esc(reg)}</p>` : '';
  const hostelLine =
    blk || rm
      ? `<p class="center"><strong>Hostel:</strong> ${esc([blk && `Block ${blk}`, rm && `Room ${rm}`].filter(Boolean).join(' · '))}</p>`
      : '';
  const originalFee = calculateServiceFee(Number(b.subtotal ?? 0));
  const discountedFeeHtml = Number(b.convenience_fee ?? 0) === 0 && originalFee > 0
    ? `<span>Service fee (7-day discount)</span><span><s>₹${originalFee.toFixed(2)}</s> ₹0.00</span>`
    : `<span>Service fee</span><span>₹${Number(b.convenience_fee ?? 0).toFixed(2)}</span>`;
  return `
    <h2>LaundroSwipe</h2>
    <p class="meta center">${esc(b.vendor_name ?? 'Vendor')}</p>
    <p class="center">Token: #${b.order_token}</p>
    <p class="center">Order: ${esc(String(b.order_number ?? '—'))}</p>
    <p class="center">Customer: ${esc(b.customer_name ?? '—')}</p>
    <p class="center">Phone: ${esc(b.customer_phone ?? '—')}</p>
    ${idLine}
    ${emailLine}
    ${regLine}
    ${hostelLine}
    <p class="center">Date: ${b.created_at ? new Date(b.created_at).toLocaleString() : ''}</p>
    <div class="row-divider"></div>
    <table>
      <thead><tr><th class="qty-col">Qty</th><th class="desc-col">Description</th><th class="amt-col">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="row-divider"></div>
    <div class="totals">
      <p><span>Total items</span><span>${totalItems}</span></p>
      <p><span>Subtotal</span><span>₹${Number(b.subtotal ?? 0).toFixed(2)}</span></p>
      <p class="conv">${discountedFeeHtml}</p>
      <p class="total"><span>Total</span><span>₹${Number(b.total ?? 0).toFixed(2)}</span></p>
    </div>
    <p class="foot">Thank you!</p>
  `;
}

function billToPlainText(b: VendorBillRow): string {
  const items = Array.isArray(b.line_items) && b.line_items.length
    ? b.line_items.map((l: { label: string; qty: number; price: number }) => `${l.label} x${l.qty}    ₹${l.price * l.qty}`)
    : [];
  const totalItems = Array.isArray(b.line_items)
    ? b.line_items.reduce((sum, l: { qty: number }) => sum + Number(l.qty || 0), 0)
    : 0;
  const extra: string[] = [];
  if (b.user_email != null && String(b.user_email).trim() !== '') extra.push(`Email: ${b.user_email}`);
  if (b.user_display_id != null && String(b.user_display_id).trim() !== '') extra.push(`Customer ID: ${b.user_display_id}`);
  const regP = String(b.customer_reg_no ?? '').trim();
  const blkP = String(b.customer_hostel_block ?? '').trim();
  const rmP = String(b.customer_room_number ?? '').trim();
  if (regP) extra.push(`Reg no: ${regP}`);
  if (blkP || rmP) {
    extra.push(`Hostel: ${[blkP && `Block ${blkP}`, rmP && `Room ${rmP}`].filter(Boolean).join(' · ')}`);
  }
  const originalFee = calculateServiceFee(Number(b.subtotal ?? 0));
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
    `Total items: ${totalItems}`,
    `Subtotal: ₹${b.subtotal}`,
    Number(b.convenience_fee ?? 0) === 0 && originalFee > 0
      ? `Service fee: ₹0 (discounted from ₹${originalFee} for 7 days)`
      : `Service fee: ₹${b.convenience_fee}`,
    `TOTAL: ₹${b.total}`,
    'Thank you!',
  ].join('\n');
}

type RevenueBucket = { date_from: string; date_to: string; bill_count: number; subtotal: number; convenience_fee: number; total: number };
type RevenueData = { total_bills: number; grand_subtotal: number; grand_convenience_fee: number; grand_total: number; revenue: RevenueBucket[] } | null;
type DeliveredByDate = { date: string; order_count: number; total_items: number; total_amount: number };

function normalizeBillTokenForDup(t: string) {
  return String(t ?? '')
    .replace(/^#/, '')
    .trim()
    .toUpperCase();
}

function billTotalKeyForDup(total: unknown) {
  const n = Number(total);
  if (!Number.isFinite(n)) return '_';
  return (Math.round(n * 100) / 100).toFixed(2);
}

export default function BillsPage() {
  const [bills, setBills] = useState<VendorBillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingBill, setViewingBill] = useState<VendorBillRow | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [sessionVendorSlug, setSessionVendorSlug] = useState<string | null>(null);
  const [editingBill, setEditingBill] = useState<VendorBillRow | null>(null);
  const [editLineItems, setEditLineItems] = useState<LineItem[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editCustomDesc, setEditCustomDesc] = useState('');
  const [editCustomRate, setEditCustomRate] = useState('');
  const [editCustomQty, setEditCustomQty] = useState('1');
  const [editCustomImage, setEditCustomImage] = useState<string | null>(null);
  const [editBillCatalog, setEditBillCatalog] = useState<CatalogRow[] | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueDays, setRevenueDays] = useState(2);
  const [showRevenue, setShowRevenue] = useState(false);
  const [deliveredByDate, setDeliveredByDate] = useState<DeliveredByDate[] | null>(null);
  const [deliveredLoading, setDeliveredLoading] = useState(false);
  const [showDelivered, setShowDelivered] = useState(false);
  const [billsPage, setBillsPage] = useState(1);
  const [billsTotalPages, setBillsTotalPages] = useState(1);
  const [billsTotal, setBillsTotal] = useState(0);
  const BILLS_PER_PAGE = 50;

  const fetchBills = (page: number) => {
    setLoading(true);
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
    const headers = token
      ? ({ Authorization: `Bearer ${token}` } as Record<string, string>)
      : ({} as Record<string, string>);
    fetch(`/api/vendor/bills?page=${page}&limit=${BILLS_PER_PAGE}`, { credentials: 'include', headers })
      .then(async (r) => {
        if (r.status === 401) {
          sessionStorage.removeItem('admin_token');
          localStorage.removeItem('admin_logged');
          setLoading(false);
          return null;
        }
        const data = await r.json().catch(() => ({}));
        return data;
      })
      .then((data) => {
        if (!data) return;
        setBills((data.bills ?? []) as VendorBillRow[]);
        setBillsPage(data.page ?? 1);
        setBillsTotalPages(data.total_pages ?? 1);
        setBillsTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    const role = typeof window !== 'undefined' ? localStorage.getItem('admin_role') : null;
    const vendorId = typeof window !== 'undefined' ? localStorage.getItem('admin_vendor_id') : null;
    setIsSuperAdmin(role === 'super_admin');
    if (role === 'vendor' && vendorId) setSessionVendorSlug(vendorId);
    else setSessionVendorSlug(null);
    setVendorName(
      role === 'vendor' && vendorId
        ? localStorage.getItem('admin_vendor_name') || vendorId
        : null,
    );

    fetchBills(1);
  }, []);

  useEffect(() => {
    if (!editingBill) {
      setEditBillCatalog(null);
      return;
    }
    const slug = (editingBill.vendor_slug ?? sessionVendorSlug ?? '').toLowerCase().trim();
    if (!slug) {
      setEditBillCatalog(null);
      return;
    }
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
    const headers = token ? ({ Authorization: `Bearer ${token}` } as Record<string, string>) : {};
    const qs = isSuperAdmin ? `?slug=${encodeURIComponent(slug)}` : '';
    fetch(`/api/vendor/bill-catalog${qs}`, { credentials: 'include', headers })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data?.ok || !Array.isArray(data.items)) return null;
        return data.items as CatalogRow[];
      })
      .then((items) => {
        setEditBillCatalog(items && items.length > 0 ? items : null);
      })
      .catch(() => setEditBillCatalog(null));
  }, [editingBill, sessionVendorSlug, isSuperAdmin]);

  const fetchRevenue = (days: number) => {
    setRevenueLoading(true);
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`/api/vendor/revenue?days=${days}`, { credentials: 'include', headers })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data?.ok) return;
        setRevenueData(data as RevenueData);
      })
      .catch(() => {})
      .finally(() => setRevenueLoading(false));
  };

  const fetchDelivered = () => {
    setDeliveredLoading(true);
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/admin/orders/delivered-by-date', { credentials: 'include', headers })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return;
        setDeliveredByDate((data.delivered_by_date as DeliveredByDate[]) ?? []);
      })
      .catch(() => {})
      .finally(() => setDeliveredLoading(false));
  };

  useEffect(() => {
    if (showDelivered && deliveredByDate === null) fetchDelivered();
  }, [showDelivered]);

  useEffect(() => {
    if (showRevenue) fetchRevenue(revenueDays);
  }, [showRevenue, revenueDays]);

  const billDuplicateInfo = useMemo(() => {
    const active = bills.filter((b) => !b.cancelled_at);
    const tokenTotalCounts = new Map<string, number>();

    for (const b of active) {
      const tok = normalizeBillTokenForDup(b.order_token);
      const tk = billTotalKeyForDup(b.total);
      if (tk === '_') continue;
      const pairKey = `${tok}|${tk}`;
      tokenTotalCounts.set(pairKey, (tokenTotalCounts.get(pairKey) ?? 0) + 1);
    }

    const dupTokenTotalPairs: { token: string; total: string; count: number }[] = [];
    for (const [pairKey, count] of tokenTotalCounts) {
      if (count < 2) continue;
      const [token, total] = pairKey.split('|');
      dupTokenTotalPairs.push({ token, total, count });
    }
    dupTokenTotalPairs.sort((a, b) => b.count - a.count || a.token.localeCompare(b.token));

    const rowFlags = new Map<string, { dupTokenTotalCount?: number }>();
    for (const b of bills) {
      if (b.cancelled_at) continue;
      const tok = normalizeBillTokenForDup(b.order_token);
      const tk = billTotalKeyForDup(b.total);
      const pairKey = `${tok}|${tk}`;
      const cnt = tokenTotalCounts.get(pairKey) ?? 1;
      rowFlags.set(b.id, {
        dupTokenTotalCount: cnt >= 2 ? cnt : undefined,
      });
    }

    return { dupTokenTotalPairs, rowFlags };
  }, [bills]);

  const escapeCsv = (v: string | number | null | undefined): string => {
    const s = v == null ? '' : String(v);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const exportBillsToCsv = () => {
    const cols = ['Token', 'Order', 'Customer', 'Phone', 'Date', 'Subtotal', 'Service fee', 'Total', 'Line items'];
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
    const title = `Bill #${b.order_token}`;
    const html = billToHtml(b);
    const plain = billToPlainText(b);

    // Try proper ESC/POS receipt first (native Android bridge or BLE) — same layout as screenshot
    try {
      const paper = getEffectiveEscPosPaperSize();
      const totalItems = Array.isArray(b.line_items)
        ? b.line_items.reduce((s: number, l: { qty: number }) => s + Number(l.qty || 0), 0)
        : 0;
      const originalFee = calculateServiceFee(Number(b.subtotal ?? 0));
      const serviceFeeLine =
        Number(b.convenience_fee ?? 0) === 0 && originalFee > 0
          ? `Service fee: Rs.0 (discounted from Rs.${originalFee.toFixed(2)} for 7 days)`
          : `Service fee: Rs.${Number(b.convenience_fee ?? 0).toFixed(2)}`;
      const bytes = buildVendorReceiptEscPos(paper, {
        vendorName: b.vendor_name ?? 'LaundroSwipe',
        tokenLabel: b.order_token,
        orderLabel: b.order_number ?? '—',
        customerLabel: b.customer_name ?? '—',
        phoneLabel: b.customer_phone ?? '—',
        customerDisplayId: b.user_display_id ?? '—',
        regNo: b.customer_reg_no ?? undefined,
        hostelBlock: b.customer_hostel_block ?? undefined,
        roomNumber: b.customer_room_number ?? undefined,
        dateStr: b.created_at ? new Date(b.created_at).toLocaleString() : new Date().toLocaleString(),
        lineItems: Array.isArray(b.line_items)
          ? b.line_items.map((l: { label: string; qty: number; price: number }) => ({ label: l.label, qty: l.qty, price: l.price }))
          : [],
        totalItems,
        subtotal: Number(b.subtotal ?? 0),
        serviceFeeLine,
        total: Number(b.total ?? 0),
        footer: 'Thank you!',
      });
      const direct = await printEscPosViaBluetooth(bytes);
      if (direct === 'printed') return;
    } catch { /* fall through to system dialog */ }

    // Fallback: system print dialog with thermal receipt layout
    const config = getPrinterConfigForPrint();
    await printThermalReceiptDirect(title, html, plain, {
      printer: config ?? undefined,
      forceDialog: config?.forceDialog ?? true,
    });
  };

  const canDeleteBill = (b: VendorBillRow): boolean => isWithinVendorBillCancelEditWindow(b.created_at);

  const editCatalogSlug = editingBill?.vendor_slug ?? sessionVendorSlug;
  const editBillItems = useMemo(() => {
    if (editBillCatalog && editBillCatalog.length > 0) return editBillCatalog;
    return getVendorBillItems(editCatalogSlug).map((i) => ({ ...i, image_url: null as string | null }));
  }, [editBillCatalog, editCatalogSlug]);

  const addEditItem = (itemId: string) => {
    const item = editBillItems.find((i) => i.id === itemId);
    if (!item) return;
    setEditLineItems((prev) => {
      const i = prev.findIndex((l) => l.id === itemId);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, { id: item.id, label: item.label, price: item.price, qty: 1, image_url: item.image_url ?? null }];
    });
  };

  const removeOneEdit = (itemId: string) => {
    setEditLineItems((prev) => {
      const i = prev.findIndex((l) => l.id === itemId);
      if (i < 0) return prev;
      const next = [...prev];
      if (next[i].qty <= 1) return next.filter((_, j) => j !== i);
      next[i] = { ...next[i], qty: next[i].qty - 1 };
      return next;
    });
  };

  const removeEditLine = (index: number) => {
    setEditLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const setEditLineImageUrl = (index: number, image_url: string | null) => {
    setEditLineItems((prev) => prev.map((l, i) => (i === index ? { ...l, image_url } : l)));
  };

  const handleEditLineImageFile = (index: number, file: File | null) => {
    if (!file) {
      setEditLineImageUrl(index, null);
      return;
    }
    if (file.size > 1024 * 1024) {
      setEditErr('Image is too large. Keep it under 1MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result.startsWith('data:image/')) {
        setEditErr('Invalid image file');
        return;
      }
      setEditLineImageUrl(index, result);
    };
    reader.onerror = () => setEditErr('Image upload failed');
    reader.readAsDataURL(file);
  };

  const openEditBill = (b: VendorBillRow) => {
    setEditErr(null);
    setEditingBill(b);
    setEditLineItems(billLineItemsToState(b));
    setEditCustomDesc('');
    setEditCustomRate('');
    setEditCustomQty('1');
    setEditCustomImage(null);
  };

  const readImageAsDataUrl = (file: File, onOk: (dataUrl: string) => void, onErr: (msg: string) => void) => {
    if (file.size > 1024 * 1024) {
      onErr('Image is too large. Keep it under 1MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result.startsWith('data:image/')) {
        onErr('Invalid image file');
        return;
      }
      onOk(result);
    };
    reader.onerror = () => onErr('Image upload failed');
    reader.readAsDataURL(file);
  };

  const addCustomItemEdit = () => {
    const label = editCustomDesc.trim();
    const price = Number(editCustomRate);
    const qty = Math.floor(Number(editCustomQty));
    if (!label) {
      setEditErr('Enter item description');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setEditErr('Enter a valid rate');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setEditErr('Enter a valid quantity');
      return;
    }
    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setEditLineItems((prev) => [...prev, { id, label, price, qty, image_url: editCustomImage }]);
    setEditCustomDesc('');
    setEditCustomRate('');
    setEditCustomQty('1');
    setEditCustomImage(null);
    setEditErr(null);
  };

  const saveEditedBill = async () => {
    if (!editingBill || editLineItems.length === 0) return;
    setEditSaving(true);
    try {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch('/api/vendor/bills/update', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          bill_id: editingBill.id,
          line_items: editLineItems.map((l) => ({
            id: l.id,
            qty: l.qty,
            label: l.label,
            price: l.price,
            image_url: l.image_url ?? null,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setEditErr(data?.error || 'Update failed');
        return;
      }
      const subtotal = editLineItems.reduce((s, l) => s + l.price * l.qty, 0);
      const feeBreakdown = applyServiceFeeDiscount(subtotal);
      const updated: VendorBillRow = {
        ...editingBill,
        line_items: editLineItems.map((l) => ({
          id: l.id,
          label: l.label,
          price: l.price,
          qty: l.qty,
          image_url: l.image_url ?? null,
        })),
        subtotal,
        convenience_fee: feeBreakdown.finalFee,
        total: subtotal + feeBreakdown.finalFee,
      };
      setBills((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      if (viewingBill?.id === updated.id) setViewingBill(updated);
      setEditingBill(null);
      setCopyMsg('Bill updated');
      setTimeout(() => setCopyMsg(null), 2500);
    } catch {
      setEditErr('Update failed');
    } finally {
      setEditSaving(false);
    }
  };

  const cancelBill = async (billId: string) => {
    if (!billId) return;
    setCancellingId(billId);
    try {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch('/api/vendor/bills/cancel', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ bill_id: billId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setCopyMsg(data?.error || 'Cancel failed');
        setTimeout(() => setCopyMsg(null), 3000);
        return;
      }
      setBills((prev) => prev.filter((b) => b.id !== billId));
      if (viewingBill?.id === billId) setViewingBill(null);
      setCopyMsg('Bill deleted');
      setTimeout(() => setCopyMsg(null), 2500);
    } catch {
      setCopyMsg('Cancel failed');
      setTimeout(() => setCopyMsg(null), 3000);
    } finally {
      setCancellingId(null);
    }
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
          <p style={{ color: 'var(--ts)', fontSize: 14, margin: 0 }}>
            View, edit line items, delete, and re-print. Edit anytime; delete is allowed within 1 hour of bill creation.
          </p>
        </div>
        <button type="button" onClick={exportBillsToCsv} disabled={loading || bills.length === 0} className="vendor-btn-secondary" style={{ marginLeft: 'auto' }}>
          📥 Export to Excel
        </button>
      </div>

      {/* Revenue Section */}
      <div className="vendor-card" style={{ marginBottom: 20 }}>
        <button
          type="button"
          className="vendor-btn-secondary"
          style={{ width: '100%', fontWeight: 600 }}
          onClick={() => setShowRevenue((p) => !p)}
        >
          {showRevenue ? 'Hide Revenue' : 'Show Date-wise Revenue'}
        </button>
        {showRevenue && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Group by</label>
              {[1, 2, 7, 14, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={revenueDays === d ? 'vendor-btn-primary' : 'vendor-btn-secondary'}
                  style={{ minWidth: 48, padding: '6px 12px', fontSize: 13 }}
                  onClick={() => setRevenueDays(d)}
                >
                  {d === 1 ? 'Daily' : d === 7 ? 'Weekly' : d === 30 ? 'Monthly' : `${d} days`}
                </button>
              ))}
            </div>
            {revenueLoading ? (
              <p style={{ color: 'var(--ts)', fontSize: 13 }}>Loading revenue...</p>
            ) : revenueData ? (
              <>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                  <div style={{ padding: '12px 16px', background: '#EFF6FF', borderRadius: 8, flex: '1 1 120px' }}>
                    <div style={{ fontSize: 12, color: '#3B82F6', fontWeight: 600 }}>Total Bills</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#1E40AF' }}>{revenueData.total_bills}</div>
                  </div>
                  <div style={{ padding: '12px 16px', background: '#F0FDF4', borderRadius: 8, flex: '1 1 120px' }}>
                    <div style={{ fontSize: 12, color: '#22C55E', fontWeight: 600 }}>Subtotal Revenue</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#166534' }}>₹{revenueData.grand_subtotal.toLocaleString('en-IN')}</div>
                  </div>
                  <div style={{ padding: '12px 16px', background: '#FFFBEB', borderRadius: 8, flex: '1 1 120px' }}>
                    <div style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600 }}>Service Fees</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#92400E' }}>₹{revenueData.grand_convenience_fee.toLocaleString('en-IN')}</div>
                  </div>
                  <div style={{ padding: '12px 16px', background: '#F5F3FF', borderRadius: 8, flex: '1 1 120px' }}>
                    <div style={{ fontSize: 12, color: '#8B5CF6', fontWeight: 600 }}>Grand Total</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#5B21B6' }}>₹{revenueData.grand_total.toLocaleString('en-IN')}</div>
                  </div>
                </div>
                {revenueData.revenue.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                          <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: 'var(--ts)' }}>Period</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: 'var(--ts)' }}>Bills</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: 'var(--ts)' }}>Subtotal</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: 'var(--ts)' }}>Fees</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: 'var(--ts)' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueData.revenue.map((r, i) => {
                          const label = revenueDays === 1
                            ? new Date(r.date_from + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                            : `${new Date(r.date_from + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${new Date(r.date_to + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 500 }}>{label}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>{r.bill_count}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{r.subtotal.toLocaleString('en-IN')}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{r.convenience_fee.toLocaleString('en-IN')}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>₹{r.total.toLocaleString('en-IN')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--ts)', fontSize: 13 }}>No revenue data for this period.</p>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Delivered Orders Section */}
      <div className="vendor-card" style={{ marginBottom: 20 }}>
        <button
          type="button"
          className="vendor-btn-secondary"
          style={{ width: '100%', fontWeight: 600 }}
          onClick={() => setShowDelivered((p) => !p)}
        >
          {showDelivered ? 'Hide Delivered Orders' : 'Show Bills Delivered Count (by Date)'}
        </button>
        {showDelivered && (
          <div style={{ marginTop: 14 }}>
            {deliveredLoading ? (
              <p style={{ color: 'var(--ts)', fontSize: 13 }}>Loading delivered orders...</p>
            ) : deliveredByDate && deliveredByDate.length > 0 ? (
              <>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                  <div style={{ padding: '12px 16px', background: '#F0FDF4', borderRadius: 8, flex: '1 1 120px' }}>
                    <div style={{ fontSize: 12, color: '#22C55E', fontWeight: 600 }}>Total Delivered</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#166534' }}>
                      {deliveredByDate.reduce((s, d) => s + d.order_count, 0)}
                    </div>
                  </div>
                  <div style={{ padding: '12px 16px', background: '#EFF6FF', borderRadius: 8, flex: '1 1 120px' }}>
                    <div style={{ fontSize: 12, color: '#3B82F6', fontWeight: 600 }}>Total Items</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#1E40AF' }}>
                      {deliveredByDate.reduce((s, d) => s + d.total_items, 0)}
                    </div>
                  </div>
                  <div style={{ padding: '12px 16px', background: '#F5F3FF', borderRadius: 8, flex: '1 1 120px' }}>
                    <div style={{ fontSize: 12, color: '#8B5CF6', fontWeight: 600 }}>Total Amount</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#5B21B6' }}>
                      ₹{deliveredByDate.reduce((s, d) => s + d.total_amount, 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: 'var(--ts)' }}>Date</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: 'var(--ts)' }}>Orders Delivered</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: 'var(--ts)' }}>Total Items</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: 'var(--ts)' }}>Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveredByDate.map((d) => (
                        <tr key={d.date} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 500 }}>
                            {new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{d.order_count}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{d.total_items}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>₹{d.total_amount.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : deliveredByDate !== null ? (
              <p style={{ color: 'var(--ts)', fontSize: 13 }}>No delivered orders found.</p>
            ) : null}
          </div>
        )}
      </div>

      {copyMsg && !viewingBill && !editingBill && (
        <p style={{ marginBottom: 14, fontSize: 14, color: copyMsg.includes('failed') ? 'var(--er)' : 'var(--ok)' }}>{copyMsg}</p>
      )}

      {loading ? (
        <p style={{ color: 'var(--ts)' }}>Loading…</p>
      ) : bills.length === 0 ? (
        <div className="vendor-card" style={{ padding: 32, textAlign: 'center', color: 'var(--ts)' }}>
          <p style={{ marginBottom: 8 }}>No saved bills yet.</p>
          <p style={{ margin: 0 }}><Link href="/admin/vendor" style={{ color: 'var(--b)', fontWeight: 600 }}>Create a bill</Link> and click &quot;Save bill&quot; to see it here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 8 }}>
            Showing {(billsPage - 1) * BILLS_PER_PAGE + 1}–{Math.min(billsPage * BILLS_PER_PAGE, billsTotal)} of {billsTotal} bills
          </p>
          {billDuplicateInfo.dupTokenTotalPairs.length > 0 && (
            <div
              className="vendor-card"
              style={{
                padding: '14px 16px',
                marginBottom: 4,
                background: 'var(--bg)',
                border: '1px solid var(--bd)',
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px', color: 'var(--tx)' }}>Suggestions (this page)</p>
              <p style={{ fontSize: 12, color: 'var(--ts)', margin: '0 0 12px', lineHeight: 1.45 }}>
                Multiple saved rows for the <strong>same token</strong> and <strong>total</strong> are counted as one bill in reports. Delete extras if they are mistakes (within the delete window).
              </p>
              {billDuplicateInfo.dupTokenTotalPairs.map((d) => (
                <p
                  key={`dup-${d.token}-${d.total}`}
                  style={{
                    fontSize: 13,
                    margin: '0 0 10px',
                    padding: '10px 12px',
                    background: '#EEF2FF',
                    borderRadius: 8,
                    borderLeft: '4px solid #6366F1',
                    color: '#312E81',
                    lineHeight: 1.45,
                  }}
                >
                  <strong>Token #{d.token}</strong> · ₹{Number(d.total).toLocaleString('en-IN')}: <strong>{d.count} saved rows</strong> with the same
                  amount — counted as <strong>one</strong> bill in reports. Delete extras if they are mistakes (within the delete window).
                </p>
              ))}
            </div>
          )}
          {bills.map((b) => {
            const flags = billDuplicateInfo.rowFlags.get(b.id);
            const accent =
              flags?.dupTokenTotalCount && flags.dupTokenTotalCount >= 2 ? '4px solid #6366F1' : undefined;
            return (
            <div
              key={b.id}
              className="vendor-card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 14,
                borderLeft: accent,
              }}
            >
              <div style={{ flex: '1 1 200px' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--b)' }}>#{b.order_token} · {b.order_number ?? '—'}</div>
                <div style={{ fontSize: 13, color: 'var(--ts)', marginTop: 4 }}>{b.customer_name ?? '—'} · {b.customer_phone ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--tm)', marginTop: 2 }}>{b.created_at ? new Date(b.created_at).toLocaleString() : ''}</div>
                <div style={{ fontSize: 14, marginTop: 6, fontWeight: 600 }}>₹{b.total}</div>
                {flags?.dupTokenTotalCount != null && flags.dupTokenTotalCount >= 2 && (
                  <div style={{ fontSize: 12, color: '#4338CA', marginTop: 8, fontWeight: 500 }}>
                    {flags.dupTokenTotalCount} rows same token &amp; amount — revenue uses one.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button type="button" onClick={() => setViewingBill(b)} className="vendor-btn-secondary">
                  View bill
                </button>
                <button type="button" onClick={() => printBill(b)} className="vendor-btn-primary">
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => openEditBill(b)}
                  className="vendor-btn-secondary"
                  title="Edit this bill"
                >
                  Edit bill
                </button>
                <button
                  type="button"
                  onClick={() => cancelBill(b.id)}
                  disabled={!canDeleteBill(b) || cancellingId === b.id}
                  className="vendor-btn-secondary"
                  title={canDeleteBill(b) ? 'Delete this bill (within 1 hour of creation)' : 'Bills can only be deleted within 1 hour'}
                >
                  {cancellingId === b.id ? 'Deleting…' : 'Delete bill'}
                </button>
              </div>
            </div>
            );
          })}
          {/* Pagination controls */}
          {billsTotalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16, padding: '12px 0' }}>
              <button
                type="button"
                className="vendor-btn-secondary"
                disabled={billsPage <= 1 || loading}
                onClick={() => fetchBills(billsPage - 1)}
                style={{ minWidth: 80 }}
              >
                Previous
              </button>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ts)' }}>
                Page {billsPage} of {billsTotalPages}
              </span>
              <button
                type="button"
                className="vendor-btn-secondary"
                disabled={billsPage >= billsTotalPages || loading}
                onClick={() => fetchBills(billsPage + 1)}
                style={{ minWidth: 80 }}
              >
                Next
              </button>
            </div>
          )}
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
            {copyMsg && <p style={{ marginTop: 12, fontSize: 13, color: copyMsg.includes('failed') ? 'var(--er)' : 'var(--ok)' }}>{copyMsg}</p>}
            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  openEditBill(viewingBill);
                }}
                className="vendor-btn-secondary"
                style={{ flex: '1 1 140px' }}
                title="Edit this bill"
              >
                Edit bill
              </button>
              <button type="button" onClick={() => printBill(viewingBill)} className="vendor-btn-primary" style={{ flex: '1 1 140px' }}>Print</button>
              <button type="button" onClick={() => copyBill(viewingBill)} className="vendor-btn-secondary" style={{ flex: '1 1 140px' }}>Copy receipt</button>
              <button type="button" onClick={() => setViewingBill(null)} className="vendor-btn-secondary" style={{ flex: '1 1 140px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {editingBill && (
        <div className="bill-popup-overlay" onClick={() => !editSaving && setEditingBill(null)}>
          <div className="bill-popup-card" style={{ maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontFamily: 'var(--fd)', fontSize: 18, margin: 0 }}>Edit bill #{editingBill.order_token}</h3>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setEditingBill(null)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--ts)', lineHeight: 1, padding: 4 }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 14 }}>
              Add or remove items anytime. Totals and service fee update automatically.
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--tx)' }}>Tap to add · −1 to reduce</p>
            <div className="vendor-item-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
              {editBillItems.map((i) => {
                const line = editLineItems.find((l) => l.id === i.id);
                const qty = line?.qty ?? 0;
                return (
                  <div key={i.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => addEditItem(i.id)}
                      className={`vendor-item-btn ${i.image_url ? 'with-thumb' : ''} ${qty > 0 ? 'has-qty' : ''}`}
                    >
                      {i.image_url ? <img src={i.image_url} alt="" className="vendor-item-thumb" /> : null}
                      {i.label}
                      {qty > 0 && (
                        <span style={{ display: 'block', fontSize: 11, marginTop: 2 }}>
                          ×{qty} ₹{i.price * qty}
                        </span>
                      )}
                    </button>
                    {qty > 0 && (
                      <button type="button" onClick={() => removeOneEdit(i.id)} className="vendor-item-btn-minus">
                        −1
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ border: '1px dashed var(--bd)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--tx)' }}>Add custom item (desc, rate, image)</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.6fr', gap: 8, marginBottom: 8 }}>
                <input className="vendor-input" placeholder="Item description" value={editCustomDesc} onChange={(e) => setEditCustomDesc(e.target.value)} />
                <input className="vendor-input" placeholder="Rate" value={editCustomRate} onChange={(e) => setEditCustomRate(e.target.value)} inputMode="decimal" />
                <input className="vendor-input" placeholder="Qty" value={editCustomQty} onChange={(e) => setEditCustomQty(e.target.value)} inputMode="numeric" />
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) {
                      setEditCustomImage(null);
                      return;
                    }
                    readImageAsDataUrl(file, setEditCustomImage, setEditErr);
                  }}
                />
                {editCustomImage && (
                  <>
                    <img src={editCustomImage} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--bd)' }} />
                    <button type="button" className="vendor-item-btn-minus" style={{ minWidth: 44 }} onClick={() => setEditCustomImage(null)}>×</button>
                  </>
                )}
                <button type="button" onClick={addCustomItemEdit} className="vendor-btn-secondary">Add custom item</button>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              {editLineItems.length === 0 ? (
                <p style={{ color: 'var(--ts)', fontSize: 13 }}>Add at least one line to save.</p>
              ) : (
                editLineItems.map((l, idx) => (
                  <div
                    key={`${l.id}-${idx}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 0',
                      borderBottom: '1px solid var(--bd)',
                      fontSize: 13,
                    }}
                  >
                    <span>
                      {l.label} × {l.qty} @ ₹{l.price}
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {l.image_url ? (
                          <img
                            src={l.image_url}
                            alt=""
                            style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--bd)' }}
                          />
                        ) : (
                          <span aria-hidden style={{ width: 44, height: 44, display: 'inline-block', borderRadius: 8, border: '1px dashed var(--bd)' }} />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleEditLineImageFile(idx, e.target.files?.[0] ?? null)}
                        />
                        {l.image_url && (
                          <button type="button" className="vendor-btn-secondary" style={{ padding: '4px 10px' }} onClick={() => setEditLineImageUrl(idx, null)}>
                            Remove
                          </button>
                        )}
                      </div>
                    </span>
                    <span>
                      ₹{l.price * l.qty}
                      <button type="button" onClick={() => removeEditLine(idx)} className="vendor-item-btn-minus" style={{ marginLeft: 8, minWidth: 40 }} aria-label="Remove line">
                        ×
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
            {(() => {
              const sub = editLineItems.reduce((s, l) => s + l.price * l.qty, 0);
              const fee = applyServiceFeeDiscount(sub);
              return (
                <>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>Subtotal: ₹{sub.toFixed(2)}</p>
                  {fee.active && fee.originalFee > 0 ? (
                    <p style={{ fontWeight: 600, fontSize: 14 }}>
                      Service fee: <span style={{ textDecoration: 'line-through', color: 'var(--ts)' }}>₹{fee.originalFee.toFixed(2)}</span> ₹0
                      <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--ok)' }}>(7-day discount)</span>
                    </p>
                  ) : (
                    <p style={{ fontWeight: 600, fontSize: 14 }}>Service fee: ₹{fee.finalFee.toFixed(2)}</p>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--ts)', marginBottom: 8 }}>{SERVICE_FEE_SHORT_EXPLANATION}</p>
                  <p style={{ fontWeight: 700, fontSize: 16 }}>Total: ₹{(sub + fee.finalFee).toFixed(2)}</p>
                </>
              );
            })()}
            {editErr && <p style={{ marginTop: 10, fontSize: 13, color: 'var(--er)' }}>{editErr}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="button" disabled={editSaving || editLineItems.length === 0} onClick={saveEditedBill} className="vendor-btn-primary" style={{ flex: '1 1 160px' }}>
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" disabled={editSaving} onClick={() => setEditingBill(null)} className="vendor-btn-secondary" style={{ flex: '1 1 120px' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
