'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { escPosPlainReceiptHtmlForPaper, printThermalReceiptDirect, thermalPrinterConfigForEscPosPlain } from '@/lib/thermal-print';
import { openThermalReceiptReactPrintWindow } from '@/lib/receipt/openThermalReceiptReactPrint';
import { ThermalReceipt } from '@/components/receipt/ThermalReceipt';
import { vendorBillRowToThermalReceiptData } from '@/lib/receipt/thermalReceiptTypes';
import { getPrinterConfigForPrint } from '@/lib/printer-settings';
import {
  buildVendorReceiptEscPos,
  formatVendorReceiptEscPosPlain,
  printEscPosViaBluetooth,
  savedVendorBillToReceiptInput,
} from '@/lib/printing';
import { getEffectiveEscPosPaperSize } from '@/lib/ble-printer-settings';
import type { VendorBillRow } from '@/lib/api';
import { applyServiceFeeDiscount, SERVICE_FEE_SHORT_EXPLANATION } from '@/lib/fees';
import { getVendorBillItems } from '@/lib/constants';
import { isWithinVendorBillCancelEditWindow } from '@/lib/vendor-bill-policy';
import { billCatalogThumbUrl } from '@/lib/bill-catalog-thumb';
import { compactLineItemsForSavePayload } from '@/lib/vendor-bill-network';
import {
  type BillListFilterFields,
  getLastSyncForFilter,
  patchCachedBillRow,
  readCachedBillsPage,
  removeCachedBillRow,
  writeCachedBillsPage,
} from '@/lib/offline/bills-cache';

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

function buildVendorBillsQuery(page: number, limit: number, f: BillListFilterFields): URLSearchParams {
  const p = new URLSearchParams();
  p.set('page', String(page));
  p.set('limit', String(limit));
  const t = f.token.replace(/^#/, '').trim();
  if (t) p.set('token', t);
  if (f.dateFrom.trim()) p.set('date_from', f.dateFrom.trim());
  if (f.dateTo.trim()) p.set('date_to', f.dateTo.trim());
  if (f.subtotalMin.trim()) p.set('subtotal_min', f.subtotalMin.trim());
  if (f.subtotalMax.trim()) p.set('subtotal_max', f.subtotalMax.trim());
  if (f.totalMin.trim()) p.set('total_min', f.totalMin.trim());
  if (f.totalMax.trim()) p.set('total_max', f.totalMax.trim());
  return p;
}

export default function BillsPage() {
  const lastLoadAtRef = useRef<number>(0);
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
  const [billsPage, setBillsPage] = useState(1);
  const [billsTotalPages, setBillsTotalPages] = useState(1);
  const [billsTotal, setBillsTotal] = useState(0);
  const BILLS_PER_PAGE = 20;

  const [filterToken, setFilterToken] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterSubtotalMin, setFilterSubtotalMin] = useState('');
  const [filterSubtotalMax, setFilterSubtotalMax] = useState('');
  const [filterTotalMin, setFilterTotalMin] = useState('');
  const [filterTotalMax, setFilterTotalMax] = useState('');

  const [appliedToken, setAppliedToken] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [appliedSubtotalMin, setAppliedSubtotalMin] = useState('');
  const [appliedSubtotalMax, setAppliedSubtotalMax] = useState('');
  const [appliedTotalMin, setAppliedTotalMin] = useState('');
  const [appliedTotalMax, setAppliedTotalMax] = useState('');

  const appliedFilterFields: BillListFilterFields = {
    token: appliedToken,
    dateFrom: appliedDateFrom,
    dateTo: appliedDateTo,
    subtotalMin: appliedSubtotalMin,
    subtotalMax: appliedSubtotalMax,
    totalMin: appliedTotalMin,
    totalMax: appliedTotalMax,
  };

  const hasActiveBillFilters = useMemo(() => {
    return (
      appliedToken.replace(/^#/, '').trim() !== '' ||
      appliedDateFrom.trim() !== '' ||
      appliedDateTo.trim() !== '' ||
      appliedSubtotalMin.trim() !== '' ||
      appliedSubtotalMax.trim() !== '' ||
      appliedTotalMin.trim() !== '' ||
      appliedTotalMax.trim() !== ''
    );
  }, [
    appliedToken,
    appliedDateFrom,
    appliedDateTo,
    appliedSubtotalMin,
    appliedSubtotalMax,
    appliedTotalMin,
    appliedTotalMax,
  ]);

  const authHeaders = () => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
    return token ? ({ Authorization: `Bearer ${token}` } as Record<string, string>) : ({} as Record<string, string>);
  };

  const applyBillsResponse = (rows: VendorBillRow[], page: number, totalPages: number, total: number) => {
    setBills(rows);
    setBillsPage(page);
    setBillsTotalPages(totalPages);
    setBillsTotal(total);
  };

  const maybeHydrateFromCache = async (page: number, filterFields: BillListFilterFields) => {
    const cached = await readCachedBillsPage(filterFields, page, BILLS_PER_PAGE);
    if (!cached) return null;
    applyBillsResponse(cached.bills, page, cached.totalPages, cached.total);
    setLoading(false);
    return cached;
  };

  const loadBills = async (page: number, filterFields: BillListFilterFields, useCacheHydration = true) => {
    const now = Date.now();
    if (now - lastLoadAtRef.current < 350) return;
    lastLoadAtRef.current = now;
    setLoading(true);
    const cached = useCacheHydration ? await maybeHydrateFromCache(page, filterFields) : null;
    const headers = authHeaders();
    const q = buildVendorBillsQuery(page, BILLS_PER_PAGE, filterFields);
    const lastSync = page === 1 ? await getLastSyncForFilter(filterFields) : null;
    if (lastSync) q.set('updated_after', lastSync);

    try {
      const r = await fetch(`/api/vendor/bills?${q.toString()}`, { credentials: 'include', headers });
      if (r.status === 401) {
        sessionStorage.removeItem('admin_token');
        localStorage.removeItem('admin_logged');
        setLoading(false);
        return;
      }
      const data = await r.json().catch(() => ({} as any));
      if (!r.ok || !data) {
        setLoading(false);
        return;
      }

      let rows = (data.bills ?? []) as VendorBillRow[];
      let nextTotal = Number(data.total ?? 0);
      let nextPages = Number(data.total_pages ?? 1);
      if (lastSync && cached) {
        // Incremental merge path: keep cache shape stable and patch changed rows only.
        const merged = new Map<string, VendorBillRow>(cached.bills.map((b) => [b.id, b]));
        for (const row of rows) {
          if (row.cancelled_at) merged.delete(row.id);
          else merged.set(row.id, row);
        }
        rows = Array.from(merged.values())
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
          .slice(0, BILLS_PER_PAGE);
        nextTotal = cached.total;
        nextPages = cached.totalPages;
      }

      applyBillsResponse(rows, Number(data.page ?? page), nextPages, nextTotal);
      await writeCachedBillsPage({
        filter: filterFields,
        page: Number(data.page ?? page),
        limit: BILLS_PER_PAGE,
        total: nextTotal,
        totalPages: nextPages,
        bills: rows,
        syncedAt: typeof data.synced_at === 'string' ? data.synced_at : new Date().toISOString(),
      });
    } catch {
      // If network fails after hydration we still keep the fast cached render.
      if (!cached) setLoading(false);
      return;
    }
    setLoading(false);
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

    void loadBills(1, appliedFilterFields, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only; refetch uses Apply / pagination
  }, []);

  const applyBillFilters = () => {
    const draft: BillListFilterFields = {
      token: filterToken,
      dateFrom: filterDateFrom,
      dateTo: filterDateTo,
      subtotalMin: filterSubtotalMin,
      subtotalMax: filterSubtotalMax,
      totalMin: filterTotalMin,
      totalMax: filterTotalMax,
    };
    setAppliedToken(draft.token);
    setAppliedDateFrom(draft.dateFrom);
    setAppliedDateTo(draft.dateTo);
    setAppliedSubtotalMin(draft.subtotalMin);
    setAppliedSubtotalMax(draft.subtotalMax);
    setAppliedTotalMin(draft.totalMin);
    setAppliedTotalMax(draft.totalMax);
    setBillsPage(1);
    void loadBills(1, draft, true);
  };

  const clearBillFilters = () => {
    setFilterToken('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterSubtotalMin('');
    setFilterSubtotalMax('');
    setFilterTotalMin('');
    setFilterTotalMax('');
    setAppliedToken('');
    setAppliedDateFrom('');
    setAppliedDateTo('');
    setAppliedSubtotalMin('');
    setAppliedSubtotalMax('');
    setAppliedTotalMin('');
    setAppliedTotalMax('');
    setBillsPage(1);
    const cleared: BillListFilterFields = {
      token: '',
      dateFrom: '',
      dateTo: '',
      subtotalMin: '',
      subtotalMax: '',
      totalMin: '',
      totalMax: '',
    };
    void loadBills(1, cleared, true);
  };

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
    const paper = getEffectiveEscPosPaperSize();
    const input = savedVendorBillToReceiptInput(b);
    const escPosPayload = buildVendorReceiptEscPos(paper, input);
    const plain = formatVendorReceiptEscPosPlain(paper, input);
    const adminCfg = getPrinterConfigForPrint();
    const bodyHtml = escPosPlainReceiptHtmlForPaper(plain, paper);

    try {
      const direct = await printEscPosViaBluetooth(escPosPayload);
      if (direct === 'printed') return;
    } catch {
      /* fall through to system dialog */
    }

    const thermalData = vendorBillRowToThermalReceiptData(b);
    await printThermalReceiptDirect(title, bodyHtml, plain, {
      printer: thermalPrinterConfigForEscPosPlain(paper, adminCfg),
      escPosPayload,
      dialogFallbackRenderer: () => openThermalReceiptReactPrintWindow(title, thermalData),
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
          line_items: compactLineItemsForSavePayload(
            editLineItems.map((l) => ({
              id: l.id,
              qty: l.qty,
              label: l.label,
              price: l.price,
              image_url: l.image_url ?? null,
            })),
          ),
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
      void patchCachedBillRow(updated);
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
      void removeCachedBillRow(billId);
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
      const paper = getEffectiveEscPosPaperSize();
      await navigator.clipboard.writeText(formatVendorReceiptEscPosPlain(paper, savedVendorBillToReceiptInput(b)));
      setCopyMsg('Copied. Paste in your printer app to print.');
      setTimeout(() => setCopyMsg(null), 3000);
    } catch {
      setCopyMsg('Copy failed');
      setTimeout(() => setCopyMsg(null), 2000);
    }
  };

  return (
    <div className="vendor-page stitch-billing-shell" style={{ fontFamily: 'var(--fb)', background: 'var(--bg)' }}>
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
            View, edit line items, delete, and re-print. Edit anytime; delete is allowed within 1 hour of bill creation.{' '}
            <span style={{ color: 'var(--tm)' }}>
              Date-wise revenue and delivery-day totals are on <Link href="/admin" style={{ fontWeight: 600 }}>Dashboard</Link> (Revenue &amp; Delivered).
            </span>
          </p>
        </div>
        <button type="button" onClick={exportBillsToCsv} disabled={loading || bills.length === 0} className="vendor-btn-secondary" style={{ marginLeft: 'auto' }}>
          📥 Export to Excel
        </button>
      </div>

      <div className="vendor-card stitch-billing-filters" style={{ padding: 16, marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 6px', color: 'var(--tx)' }}>Search &amp; filters</p>
        <p style={{ fontSize: 12, color: 'var(--ts)', margin: '0 0 14px', lineHeight: 1.45 }}>
          Filter saved bills by token (partial match), bill date in India (IST), item subtotal, or grand total. Click <strong>Apply</strong> to run the search; pagination keeps these filters.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyBillFilters();
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--tx)' }}>Token</label>
              <input
                className="vendor-input"
                placeholder="e.g. A1B2"
                value={filterToken}
                onChange={(e) => setFilterToken(e.target.value.toUpperCase())}
                autoComplete="off"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--tx)' }}>From date (IST)</label>
              <input className="vendor-input" type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--tx)' }}>To date (IST)</label>
              <input className="vendor-input" type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--tx)' }}>Subtotal min (₹)</label>
              <input
                className="vendor-input"
                inputMode="decimal"
                placeholder="0"
                value={filterSubtotalMin}
                onChange={(e) => setFilterSubtotalMin(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--tx)' }}>Subtotal max (₹)</label>
              <input
                className="vendor-input"
                inputMode="decimal"
                placeholder="Any"
                value={filterSubtotalMax}
                onChange={(e) => setFilterSubtotalMax(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--tx)' }}>Total min (₹)</label>
              <input
                className="vendor-input"
                inputMode="decimal"
                placeholder="0"
                value={filterTotalMin}
                onChange={(e) => setFilterTotalMin(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--tx)' }}>Total max (₹)</label>
              <input
                className="vendor-input"
                inputMode="decimal"
                placeholder="Any"
                value={filterTotalMax}
                onChange={(e) => setFilterTotalMax(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="submit" className="vendor-btn-primary" disabled={loading}>
              Apply filters
            </button>
            <button type="button" className="vendor-btn-secondary" disabled={loading} onClick={() => clearBillFilters()}>
              Clear all
            </button>
            {hasActiveBillFilters && (
              <span style={{ fontSize: 12, color: 'var(--tm)' }}>Filters active · {billsTotal} matching bill{billsTotal === 1 ? '' : 's'}</span>
            )}
          </div>
        </form>
      </div>

      {copyMsg && !viewingBill && !editingBill && (
        <p style={{ marginBottom: 14, fontSize: 14, color: copyMsg.includes('failed') ? 'var(--er)' : 'var(--ok)' }}>{copyMsg}</p>
      )}

      {loading ? (
        <p style={{ color: 'var(--ts)' }}>Loading…</p>
      ) : bills.length === 0 ? (
        <div className="vendor-card" style={{ padding: 32, textAlign: 'center', color: 'var(--ts)' }}>
          {hasActiveBillFilters ? (
            <>
              <p style={{ marginBottom: 8 }}>No bills match your filters.</p>
              <p style={{ margin: 0 }}>
                <button type="button" className="vendor-btn-secondary" onClick={() => clearBillFilters()}>
                  Clear filters
                </button>
              </p>
            </>
          ) : (
            <>
              <p style={{ marginBottom: 8 }}>No saved bills yet.</p>
              <p style={{ margin: 0 }}>
                <Link href="/admin/vendor" style={{ color: 'var(--b)', fontWeight: 600 }}>
                  Create a bill
                </Link>{' '}
                and click &quot;Save bill&quot; to see it here.
              </p>
            </>
          )}
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
              className="vendor-card stitch-billing-row"
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
                onClick={() => void loadBills(billsPage - 1, appliedFilterFields, true)}
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
                onClick={() => void loadBills(billsPage + 1, appliedFilterFields, true)}
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
            <div className="bill-view-content" style={{ maxHeight: 'min(70vh, 620px)', overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
              <ThermalReceipt data={vendorBillRowToThermalReceiptData(viewingBill)} showPrintButton />
            </div>
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
                      {i.image_url ? (
                        <img
                          src={billCatalogThumbUrl(i.image_url, 128) ?? i.image_url}
                          alt=""
                          width={112}
                          height={56}
                          decoding="async"
                          loading="lazy"
                          className="vendor-item-thumb"
                        />
                      ) : null}
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
                      Service fee (7-day discount):{' '}
                      <span style={{ textDecoration: 'line-through', color: 'var(--ts)' }}>₹{fee.originalFee.toFixed(2)}</span> ₹0
                    </p>
                  ) : (
                    <p style={{ fontWeight: 600, fontSize: 14 }}>
                      Service fee (7-day discount): ₹{fee.finalFee.toFixed(2)}
                    </p>
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
