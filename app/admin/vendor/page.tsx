'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { printThermalReceipt, printThermalReceiptDirect } from '@/lib/thermal-print';
import { getPrinterConfigForPrint } from '@/lib/printer-settings';
import { getVendorBillItems } from '@/lib/constants';
import { applyServiceFeeDiscount, SERVICE_FEE_SHORT_EXPLANATION } from '@/lib/fees';
import type { OrderRow, UserRow } from '@/lib/api';
type LineItem = { id: string; label: string; price: number; qty: number; image_url?: string | null };
type LatestBill = { id: string; created_at: string; can_cancel: boolean; line_items: LineItem[] };
type QuickItem = { id: string; label: string; price: number; image_url?: string | null };

export default function VendorPage() {
  const [vendorName, setVendorName] = useState('Vendor');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [lookupErr, setLookupErr] = useState('');
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [user, setUser] = useState<UserRow | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [quickItems, setQuickItems] = useState<QuickItem[]>([]);
  const [quickItemDesc, setQuickItemDesc] = useState('');
  const [quickItemRate, setQuickItemRate] = useState('');
  const [quickItemImage, setQuickItemImage] = useState<string | null>(null);
  const [customItemDesc, setCustomItemDesc] = useState('');
  const [customItemRate, setCustomItemRate] = useState('');
  const [customItemQty, setCustomItemQty] = useState('1');
  const [customItemImage, setCustomItemImage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [billAlreadyGenerated, setBillAlreadyGenerated] = useState(false);
  const [showAnyway, setShowAnyway] = useState(false);
  const [sampleMode, setSampleMode] = useState(false);
  const [sampleCustomerName, setSampleCustomerName] = useState('');
  const [sampleCustomerPhone, setSampleCustomerPhone] = useState('');
  const [latestBill, setLatestBill] = useState<LatestBill | null>(null);
  const [cancellingLatestBill, setCancellingLatestBill] = useState(false);
  const [editingLatestBill, setEditingLatestBill] = useState(false);
  const [editLineItems, setEditLineItems] = useState<LineItem[]>([]);
  const [editCustomDesc, setEditCustomDesc] = useState('');
  const [editCustomRate, setEditCustomRate] = useState('');
  const [editCustomQty, setEditCustomQty] = useState('1');
  const [editCustomImage, setEditCustomImage] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [catalogFromApi, setCatalogFromApi] = useState<QuickItem[] | null>(null);
  const lastSavedBillFingerprintRef = useRef<string | null>(null);
  const vendorBillItems = getVendorBillItems(vendorId);
  const catalogBase: QuickItem[] =
    catalogFromApi ??
    vendorBillItems.map((i) => ({ id: i.id, label: i.label, price: i.price, image_url: null }));
  const billItemOptions: QuickItem[] = [...catalogBase, ...quickItems];

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

  useEffect(() => {
    if (typeof window === 'undefined' || !vendorId) return;
    try {
      const raw = localStorage.getItem(`vendor_quick_items_${vendorId}`);
      if (!raw) {
        setQuickItems([]);
        return;
      }
      const parsed = JSON.parse(raw) as Array<{ id: string; label: string; price: number; image_url?: string | null }>;
      const safe = Array.isArray(parsed)
        ? parsed
            .map((x) => ({
              id: String(x.id ?? ''),
              label: String(x.label ?? '').trim(),
              price: Number(x.price ?? 0),
              image_url: typeof x.image_url === 'string' ? x.image_url : null,
            }))
            .filter((x) => x.id && x.label && Number.isFinite(x.price) && x.price > 0)
        : [];
      setQuickItems(safe);
    } catch {
      setQuickItems([]);
    }
  }, [vendorId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !vendorId) return;
    localStorage.setItem(`vendor_quick_items_${vendorId}`, JSON.stringify(quickItems));
  }, [vendorId, quickItems]);

  useEffect(() => {
    if (typeof window === 'undefined' || !vendorId) return;
    const t = sessionStorage.getItem('admin_token');
    const headers: Record<string, string> = {};
    if (t) headers.Authorization = `Bearer ${t}`;
    fetch('/api/vendor/bill-catalog', { credentials: 'include', headers })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data?.ok || !Array.isArray(data.items)) return null;
        return data.items as Array<{ id: string; label: string; price: number; image_url?: string | null }>;
      })
      .then((items) => {
        if (!items) {
          setCatalogFromApi(null);
          return;
        }
        setCatalogFromApi(
          items.map((i) => ({
            id: i.id,
            label: i.label,
            price: Number(i.price),
            image_url: i.image_url ?? null,
          })),
        );
      })
      .catch(() => setCatalogFromApi(null));
  }, [vendorId]);

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
    setEditingLatestBill(false);
    setEditLineItems([]);
    setEditErr(null);
    setEditSaving(false);
    setCustomItemDesc('');
    setCustomItemRate('');
    setCustomItemQty('1');
    setCustomItemImage(null);
    setEditCustomDesc('');
    setEditCustomRate('');
    setEditCustomQty('1');
    setEditCustomImage(null);
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
    const item = billItemOptions.find((i) => i.id === itemId);
    if (!item) return;
    setLineItems((prev) => {
      const i = prev.findIndex((l) => l.id === itemId);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, { id: item.id, label: item.label, price: item.price, qty: 1, image_url: item.image_url ?? null }];
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

  const addCustomItemMain = () => {
    const label = customItemDesc.trim();
    const price = Number(customItemRate);
    const qty = Math.floor(Number(customItemQty));
    if (!label) {
      showToast('Enter item description', 'er');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      showToast('Enter a valid rate', 'er');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      showToast('Enter a valid quantity', 'er');
      return;
    }
    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setLineItems((prev) => [...prev, { id, label, price, qty, image_url: customItemImage }]);
    setCustomItemDesc('');
    setCustomItemRate('');
    setCustomItemQty('1');
    setCustomItemImage(null);
  };

  const addQuickItemPreset = () => {
    const label = quickItemDesc.trim();
    const price = Number(quickItemRate);
    if (!label) {
      showToast('Enter item description', 'er');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      showToast('Enter a valid rate', 'er');
      return;
    }
    const id = `preset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setQuickItems((prev) => [...prev, { id, label, price, image_url: quickItemImage }]);
    setQuickItemDesc('');
    setQuickItemRate('');
    setQuickItemImage(null);
    showToast('Quick item saved', 'ok');
  };

  const removeQuickItemPreset = (id: string) => {
    setQuickItems((prev) => prev.filter((x) => x.id !== id));
  };

  const startEditLatestBill = () => {
    if (!latestBill) return;
    setEditErr(null);
    setEditLineItems(
      (latestBill.line_items ?? []).map((x) => ({
        id: String(x.id),
        label: String(x.label),
        price: Number(x.price),
        qty: Math.max(1, Math.floor(Number(x.qty))),
        image_url: x.image_url ?? null,
      })),
    );
    setEditCustomDesc('');
    setEditCustomRate('');
    setEditCustomQty('1');
    setEditCustomImage(null);
    setEditingLatestBill(true);
  };

  const addEditItem = (itemId: string) => {
    const item = billItemOptions.find((i) => i.id === itemId);
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

  const saveEditedLatestBill = async () => {
    if (!latestBill || editLineItems.length === 0) return;
    setEditSaving(true);
    setEditErr(null);
    try {
      const res = await fetch('/api/vendor/bills/update', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({
          bill_id: latestBill.id,
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
      setLatestBill((prev) => (prev ? { ...prev, line_items: editLineItems } : prev));
      setEditingLatestBill(false);
      showToast('Latest bill updated', 'ok');
    } catch {
      setEditErr('Update failed');
    } finally {
      setEditSaving(false);
    }
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
          line_items: lineItems.map((l) => ({
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
          line_items: lineItems.map((l) => ({
            id: l.id,
            qty: l.qty,
            label: l.label,
            price: l.price,
            image_url: l.image_url ?? null,
          })),
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
    setEditingLatestBill(false);
    setEditLineItems([]);
    setEditErr(null);
    setEditSaving(false);
    setCustomItemDesc('');
    setCustomItemRate('');
    setCustomItemQty('1');
    setCustomItemImage(null);
    setEditCustomDesc('');
    setEditCustomRate('');
    setEditCustomQty('1');
    setEditCustomImage(null);
    lastSavedBillFingerprintRef.current = null;
  };

  return (
    <div className="vendor-page" style={{ fontFamily: 'var(--fb)', background: 'var(--bg)' }}>
      <p style={{ marginBottom: 16, fontSize: 14 }}>
        <Link href="/admin" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>← Back to Dashboard</Link>
      </p>
      <h1 style={{ fontFamily: 'var(--fd)', fontSize: 24, marginBottom: 6, color: 'var(--b)' }}>{vendorName} · Vendor Bill</h1>
      <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 8 }}>
        <Link href="/admin/vendor/items" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>
          Items &amp; rates (photos for quick tap)
        </Link>
      </p>
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
          {latestBill && (
            <button
              type="button"
              onClick={() => startEditLatestBill()}
              className="vendor-btn-secondary"
              style={{ width: '100%', marginBottom: 10 }}
              disabled={cancellingLatestBill}
            >
              Edit latest bill items (add images)
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
            <div style={{ border: '1px dashed var(--bd)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--tx)' }}>
                Manage item presets shown in this bill generator (desc, rate, image)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr', gap: 8, marginBottom: 8 }}>
                <input className="vendor-input" placeholder="Item description" value={quickItemDesc} onChange={(e) => setQuickItemDesc(e.target.value)} />
                <input className="vendor-input" placeholder="Rate" value={quickItemRate} onChange={(e) => setQuickItemRate(e.target.value)} inputMode="decimal" />
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) {
                      setQuickItemImage(null);
                      return;
                    }
                    readImageAsDataUrl(file, setQuickItemImage, (m) => showToast(m, 'er'));
                  }}
                />
                {quickItemImage && (
                  <>
                    <img src={quickItemImage} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--bd)' }} />
                    <button type="button" className="vendor-item-btn-minus" style={{ minWidth: 44 }} onClick={() => setQuickItemImage(null)}>×</button>
                  </>
                )}
                <button type="button" onClick={addQuickItemPreset} className="vendor-btn-secondary">Add to presets</button>
              </div>
              {quickItems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {quickItems.map((q) => (
                    <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: '1px dashed var(--bd)', paddingTop: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {q.image_url ? (
                          <img src={q.image_url} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--bd)' }} />
                        ) : (
                          <span aria-hidden style={{ width: 34, height: 34, display: 'inline-block', borderRadius: 6, border: '1px dashed var(--bd)' }} />
                        )}
                        <span style={{ fontSize: 13 }}>{q.label} · ₹{q.price}</span>
                      </div>
                      <button type="button" className="vendor-item-btn-minus" style={{ minWidth: 44 }} onClick={() => removeQuickItemPreset(q.id)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--tx)' }}>Tap an item to add one (tap again to add more)</p>
            <div className="vendor-item-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
              {billItemOptions.map((i) => {
                const line = lineItems.find((l) => l.id === i.id);
                const qty = line?.qty ?? 0;
                return (
                  <div key={i.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => addItem(i.id)}
                      className={`vendor-item-btn ${i.image_url ? 'with-thumb' : ''} ${qty > 0 ? 'has-qty' : ''}`}
                    >
                      {i.image_url ? (
                        <img src={i.image_url} alt="" className="vendor-item-thumb" />
                      ) : null}
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

            <div style={{ border: '1px dashed var(--bd)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--tx)' }}>Add custom item (desc, rate, image)</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.6fr', gap: 8, marginBottom: 8 }}>
                <input className="vendor-input" placeholder="Item description" value={customItemDesc} onChange={(e) => setCustomItemDesc(e.target.value)} />
                <input className="vendor-input" placeholder="Rate" value={customItemRate} onChange={(e) => setCustomItemRate(e.target.value)} inputMode="decimal" />
                <input className="vendor-input" placeholder="Qty" value={customItemQty} onChange={(e) => setCustomItemQty(e.target.value)} inputMode="numeric" />
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) {
                      setCustomItemImage(null);
                      return;
                    }
                    readImageAsDataUrl(file, setCustomItemImage, (m) => showToast(m, 'er'));
                  }}
                />
                {customItemImage && (
                  <>
                    <img src={customItemImage} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--bd)' }} />
                    <button type="button" className="vendor-item-btn-minus" style={{ minWidth: 44 }} onClick={() => setCustomItemImage(null)}>×</button>
                  </>
                )}
                <button type="button" onClick={addCustomItemMain} className="vendor-btn-secondary">Add custom item</button>
              </div>
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

      {editingLatestBill && latestBill && (
        <div className="bill-popup-overlay" onClick={() => !editSaving && setEditingLatestBill(false)}>
          <div className="bill-popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontFamily: 'var(--fd)', fontSize: 18, margin: 0 }}>Edit latest bill</h3>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setEditingLatestBill(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--ts)', lineHeight: 1, padding: 4 }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 14 }}>
              Add/remove items and attach an image for each item line. You can edit this bill anytime.
            </p>

            <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--tx)' }}>Tap an item to add one</p>
              <div className="vendor-item-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
                {billItemOptions.map((i) => {
                  const line = editLineItems.find((l) => l.id === i.id);
                  const qty = line?.qty ?? 0;
                  return (
                    <div key={i.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => addEditItem(i.id)}
                        className={`vendor-item-btn ${i.image_url ? 'with-thumb' : ''} ${qty > 0 ? 'has-qty' : ''}`}
                      >
                        {i.image_url ? <img src={i.image_url} alt="" className="vendor-item-thumb" /> : null}
                        {i.label}
                        {qty > 0 && <span style={{ display: 'block', fontSize: 12, marginTop: 2 }}>×{qty} ₹{i.price * qty}</span>}
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

              <div style={{ border: '1px dashed var(--bd)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
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
                  <p style={{ color: 'var(--ts)', fontSize: 13 }}>No items yet. Add items above.</p>
                ) : (
                  editLineItems.map((l, idx) => (
                    <div key={`${l.id}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--bd)', fontSize: 14, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 220 }}>
                        <div style={{ fontWeight: 600 }}>
                          {l.label} × {l.qty} @ ₹{l.price}
                        </div>
                        <div style={{ color: 'var(--ts)', fontSize: 12, marginTop: 6 }}>{`Line total: ₹${l.price * l.qty}`}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {l.image_url ? (
                          <img src={l.image_url} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--bd)', background: '#fff' }} />
                        ) : (
                          <span aria-hidden style={{ width: 52, height: 52, display: 'inline-block', borderRadius: 8, border: '1px dashed var(--bd)', background: '#fff' }} />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleEditLineImageFile(idx, e.target.files?.[0] ?? null)}
                        />
                        {l.image_url && (
                          <button type="button" className="vendor-item-btn-minus" style={{ minWidth: 50 }} onClick={() => setEditLineImageUrl(idx, null)}>
                            ×
                          </button>
                        )}
                        <button type="button" onClick={() => removeEditLine(idx)} className="vendor-item-btn-minus" style={{ minWidth: 50 }} aria-label="Remove line">
                          −
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {(() => {
                const sub = editLineItems.reduce((s, l) => s + l.price * l.qty, 0);
                const feeBreakdown = applyServiceFeeDiscount(sub);
                const total = sub + feeBreakdown.finalFee;
                return (
                  <>
                    <p style={{ fontSize: 13, color: 'var(--ts)' }}>Total items: {editLineItems.reduce((s, l) => s + l.qty, 0)}</p>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>Subtotal: ₹{sub.toFixed(2)}</p>
                    {feeBreakdown.active && feeBreakdown.originalFee > 0 ? (
                      <p style={{ fontWeight: 600, fontSize: 14 }}>
                        Service fee: <span style={{ textDecoration: 'line-through', color: 'var(--ts)' }}>₹{feeBreakdown.originalFee.toFixed(2)}</span> ₹0
                        <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--ok)' }}>(7-day discount)</span>
                      </p>
                    ) : (
                      <p style={{ fontWeight: 600, fontSize: 14 }}>Service fee: ₹{feeBreakdown.finalFee.toFixed(2)}</p>
                    )}
                    <p style={{ fontSize: 12, color: 'var(--ts)', lineHeight: 1.5 }}>{SERVICE_FEE_SHORT_EXPLANATION}</p>
                    <p style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>Total: ₹{total.toFixed(2)}</p>
                  </>
                );
              })()}
            </div>

            {editErr && <p style={{ marginTop: 10, fontSize: 13, color: 'var(--er)' }}>{editErr}</p>}

            <div className="vendor-action-row" style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" onClick={saveEditedLatestBill} disabled={editSaving || editLineItems.length === 0} className="vendor-btn-primary" style={{ flex: '1 1 200px' }}>
                {editSaving ? 'Saving…' : 'Save edited bill'}
              </button>
              <button type="button" onClick={() => setEditingLatestBill(false)} disabled={editSaving} className="vendor-btn-secondary" style={{ flex: '1 1 140px' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={toast.type} style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '12px 20px', borderRadius: 12, background: toast.type === 'ok' ? 'var(--ok)' : 'var(--er)', color: '#fff', fontSize: 14, fontWeight: 500, zIndex: 9999 }}>{toast.msg}</div>}
    </div>
  );
}
