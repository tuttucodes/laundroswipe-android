'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { escPosPlainReceiptHtmlForPaper, printThermalReceiptDirect, thermalPrinterConfigForEscPosPlain } from '@/lib/thermal-print';
import { openThermalReceiptReactPrintWindow } from '@/lib/receipt/openThermalReceiptReactPrint';
import { vendorReceiptInputToThermalReceiptData } from '@/lib/receipt/thermalReceiptTypes';
import {
  buildVendorReceiptEscPos,
  formatVendorReceiptEscPosPlain,
  printEscPosViaBluetooth,
  type VendorReceiptInput,
} from '@/lib/printing';
import { getBlePrinterPreferences, getEffectiveEscPosPaperSize } from '@/lib/ble-printer-settings';
import { getPrinterConfigForPrint } from '@/lib/printer-settings';
import { getVendorBillItems } from '@/lib/constants';
import {
  applyServiceFeeDiscount,
  formatServiceFeeReceiptLine,
  SERVICE_FEE_DISCOUNT_LABEL,
  SERVICE_FEE_SHORT_EXPLANATION,
} from '@/lib/fees';
import { billCatalogThumbUrl } from '@/lib/bill-catalog-thumb';
import { compactLineItemsForSavePayload } from '@/lib/vendor-bill-network';
import { clearBillsSyncMeta } from '@/lib/offline/bills-cache';
import type { OrderRow, UserRow } from '@/lib/api';
type LineItem = { id: string; label: string; price: number; qty: number; image_url?: string | null };
type LatestBill = { id: string; created_at: string; can_cancel: boolean; line_items: LineItem[] };
type QuickItem = { id: string; label: string; price: number; image_url?: string | null };

const VENDOR_CATALOG_CACHE_PREFIX = 'laundroswipe_vendor_catalog_v1_';
const CATALOG_TTL_MS = 10 * 60 * 1000;

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
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerBusy, setScannerBusy] = useState(false);
  const [scannerErr, setScannerErr] = useState('');
  const lastSavedBillFingerprintRef = useRef<string | null>(null);
  const billPersistInFlightRef = useRef(false);
  const lastLookupAtRef = useRef(0);
  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scannerFrameRef = useRef<number | null>(null);
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
    const cacheKey = VENDOR_CATALOG_CACHE_PREFIX + vendorId;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { at: number; items: QuickItem[] };
        if (Array.isArray(parsed.items) && Date.now() - (parsed.at ?? 0) < CATALOG_TTL_MS) {
          setCatalogFromApi(
            parsed.items.map((i) => ({
              id: String(i.id),
              label: String(i.label),
              price: Number(i.price),
              image_url: typeof i.image_url === 'string' ? i.image_url : null,
            })),
          );
        }
      }
    } catch {
      /* */
    }
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
        const mapped = items.map((i) => ({
          id: i.id,
          label: i.label,
          price: Number(i.price),
          image_url: i.image_url ?? null,
        }));
        setCatalogFromApi(mapped);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), items: mapped }));
        } catch {
          /* */
        }
      })
      .catch(() => setCatalogFromApi(null));
  }, [vendorId]);

  const stopScanner = () => {
    if (scannerFrameRef.current != null) {
      cancelAnimationFrame(scannerFrameRef.current);
      scannerFrameRef.current = null;
    }
    const stream = scannerStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      scannerStreamRef.current = null;
    }
    if (scannerVideoRef.current) scannerVideoRef.current.srcObject = null;
    setScannerBusy(false);
  };

  useEffect(() => {
    return () => stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lookupByToken = async (raw: string) => {
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
    const t = raw.replace(/^#/, '').trim().toUpperCase();
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

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastLookupAtRef.current < 400) return;
    lastLookupAtRef.current = now;
    await lookupByToken(token);
  };

  const openScannerModal = () => {
    setScannerErr('');
    setScannerOpen(true);
    setScannerBusy(false);
  };

  const startScanner = async () => {
    setScannerErr('');
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    const BarcodeDetectorCtor = (window as unknown as {
      BarcodeDetector?: new (opts?: { formats?: string[] }) => { detect: (input: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>> };
    }).BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      setScannerErr('QR scanning is not supported on this browser. Enter token manually.');
      setScannerOpen(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      scannerStreamRef.current = stream;
      setScannerBusy(true);
      const video = scannerVideoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setScannerErr('Could not initialize scanner.');
        setScannerBusy(false);
        return;
      }

      const scanTick = async () => {
        const currentVideo = scannerVideoRef.current;
        if (!currentVideo || !scannerStreamRef.current) return;
        if (currentVideo.readyState >= 2 && currentVideo.videoWidth > 0 && currentVideo.videoHeight > 0) {
          canvas.width = currentVideo.videoWidth;
          canvas.height = currentVideo.videoHeight;
          ctx.drawImage(currentVideo, 0, 0, canvas.width, canvas.height);
          try {
            const codes = await detector.detect(canvas);
            const first = codes[0]?.rawValue?.trim();
            if (first) {
              const normalized = first.replace(/^#/, '').toUpperCase();
              setToken(normalized);
              stopScanner();
              setScannerOpen(false);
              await lookupByToken(normalized);
              return;
            }
          } catch {
            // Keep scanning if one frame decode fails.
          }
        }
        scannerFrameRef.current = requestAnimationFrame(() => {
          void scanTick();
        });
      };

      scannerFrameRef.current = requestAnimationFrame(() => {
        void scanTick();
      });
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setScannerErr('Camera permission denied. Allow camera access and retry.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
        setScannerErr('No usable camera found on this device.');
      } else {
        setScannerErr('Camera access denied or unavailable.');
      }
      setScannerBusy(false);
      setScannerOpen(true);
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
      void clearBillsSyncMeta();
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
  const originalServiceFee = feeBreakdown.originalFee;
  const serviceFeeDiscount = feeBreakdown.discount;
  const total = subtotal + serviceFee;

  const billFingerprint = (): string => {
    const orderToken = sampleMode ? 'sample' : (order?.token ?? token.replace(/^#/, '').trim()) || 'draft';
    const itemsKey = [...lineItems]
      .sort((a, b) => a.id.localeCompare(b.id) || a.qty - b.qty)
      .map((l) => `${l.id}:${l.qty}:${l.price}`)
      .join('|');
    return `${orderToken}|${itemsKey}|${subtotal}|${total}`;
  };

  const buildReceiptPlainText = () => {
    const paper = getEffectiveEscPosPaperSize();
    return formatVendorReceiptEscPosPlain(paper, buildVendorReceiptInput());
  };

  const buildVendorReceiptInput = (): VendorReceiptInput => {
    const o = order as OrderRow | null;
    const u = (user ?? {}) as Partial<UserRow & { display_id?: string | null }>;
    const tokenLabel = sampleMode ? 'SAMPLE' : o?.token ?? '';
    const orderLabel = sampleMode ? 'Sample Bill' : o?.order_number ?? '';
    const customerLabel = sampleMode
      ? sampleCustomerName.trim() || 'Walk-in Customer'
      : (u.full_name ?? u.email ?? '—').toString().slice(0, 24);
    const phoneLabel = sampleMode ? sampleCustomerPhone.trim() || '—' : (u.phone ?? '—').toString().slice(0, 14);
    const regPlain = sampleMode ? '' : String(u.reg_no ?? '').trim();
    const blockPlain = sampleMode ? '' : String(u.hostel_block ?? '').trim();
    const roomPlain = sampleMode ? '' : String(u.room_number ?? '').trim();
    const totalItems = lineItems.reduce((sum, item) => sum + item.qty, 0);
    const serviceFeeLine = formatServiceFeeReceiptLine(subtotal, serviceFee, 'rs');
    const p = getBlePrinterPreferences();
    return {
      vendorName,
      tokenLabel,
      orderLabel,
      customerLabel,
      phoneLabel,
      customerDisplayId: sampleMode ? '—' : (u.display_id ?? '—').toString().slice(0, 24),
      regNo: regPlain || undefined,
      hostelBlock: blockPlain || undefined,
      roomNumber: roomPlain || undefined,
      dateStr: new Date().toLocaleString(),
      lineItems: lineItems.map((l) => ({ label: l.label, qty: l.qty, price: l.price })),
      totalItems,
      subtotal,
      serviceFeeLine,
      total,
      footer: 'Thank you!',
      showQr: p.showPaymentQr && !!p.paymentQrPayload.trim(),
      paymentQrPayload: p.paymentQrPayload.trim() || undefined,
    };
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
    if (billPersistInFlightRef.current) return;
    billPersistInFlightRef.current = true;
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
          line_items: compactLineItemsForSavePayload(
            lineItems.map((l) => ({
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
        showToast(data?.error || 'Save failed', 'er');
        return;
      }
      lastSavedBillFingerprintRef.current = billFingerprint();
      setBillAlreadyGenerated(true);
      if (data.reused) {
        showToast('Bill is already up to date', 'ok');
      } else if (data.updated) {
        showToast('Bill updated', 'ok');
      } else {
        showToast('Bill saved', 'ok');
      }
      void clearBillsSyncMeta();
    } catch {
      showToast('Save failed', 'er');
    } finally {
      setSaving(false);
      billPersistInFlightRef.current = false;
    }
  };

  const doPrint = async () => {
    const title = sampleMode ? 'Sample Bill' : `Bill #${order?.token ?? ''}`;
    const paper = getEffectiveEscPosPaperSize();
    const input = buildVendorReceiptInput();
    const escPosPayload = buildVendorReceiptEscPos(paper, input);
    const plain = formatVendorReceiptEscPosPlain(paper, input);
    const adminCfg = getPrinterConfigForPrint();
    const bodyHtml = escPosPlainReceiptHtmlForPaper(plain, paper);
    const prefs = getBlePrinterPreferences();

    try {
      const direct = await printEscPosViaBluetooth(escPosPayload);
      if (direct === 'printed') {
        showToast('Sent to printer', 'ok');
        return;
      }
      if (prefs.preferBluetoothEscPos) {
        if (direct === 'not-connected') {
          showToast('No Bluetooth printer connected — opening print dialog…', 'ok');
        } else if (direct === 'unavailable') {
          showToast('Web Bluetooth not available — opening print dialog…', 'ok');
        } else if (direct === 'error') {
          showToast('Direct print failed — opening print dialog…', 'er');
        }
      }
    } catch {
      showToast('Direct print error — opening print dialog…', 'er');
    }

    const thermalData = vendorReceiptInputToThermalReceiptData(input);
    const result = await printThermalReceiptDirect(title, bodyHtml, plain, {
      printer: thermalPrinterConfigForEscPosPlain(paper, adminCfg),
      escPosPayload,
      dialogFallbackRenderer: () => openThermalReceiptReactPrintWindow(title, thermalData),
    });
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
      void clearBillsSyncMeta();
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
    if (billPersistInFlightRef.current) return;
    billPersistInFlightRef.current = true;
    setSaving(true);
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
          line_items: compactLineItemsForSavePayload(
            lineItems.map((l) => ({
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
        showToast(data?.error || 'Could not save bill before print', 'er');
        return;
      }
      lastSavedBillFingerprintRef.current = fingerprint;
      setBillAlreadyGenerated(true);
      if (data.reused) {
        showToast('Printing…', 'ok');
      } else if (data.updated) {
        showToast('Bill updated — printing…', 'ok');
      } else {
        showToast('Bill saved. Printing…', 'ok');
      }
      void clearBillsSyncMeta();
      await doPrint();
    } catch {
      showToast('Save failed — not printing', 'er');
    } finally {
      setSaving(false);
      billPersistInFlightRef.current = false;
    }
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
    <div className="vendor-page stitch-pos-shell" style={{ fontFamily: 'var(--fb)', background: 'var(--bg)' }}>
      <p style={{ marginBottom: 16, fontSize: 14 }}>
        <Link href="/admin" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>← Back to Dashboard</Link>
      </p>
      <h1 className="stitch-pos-title" style={{ fontFamily: 'var(--fd)', fontSize: 24, marginBottom: 6, color: 'var(--b)' }}>{vendorName} · Vendor Bill</h1>
      <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 8 }}>
        <Link href="/admin/vendor/items" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>
          Items &amp; rates (photos for quick tap)
        </Link>
      </p>
      <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>Enter token to load order, or create a sample bill for walk-ins/emergency print.</p>

      <div className="vendor-card stitch-pos-lookup-card">
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
          <button
            type="button"
            className="vendor-btn-secondary"
            style={{ width: '100%', marginTop: 10 }}
            onClick={() => {
              openScannerModal();
            }}
          >
            Scan Digital Handshake
          </button>
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

      {scannerOpen && (
        <div className="bill-popup-overlay" onClick={() => { stopScanner(); setScannerOpen(false); }} role="dialog" aria-modal="true" aria-label="Scan token">
          <div className="bill-popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--fd)', fontSize: 18 }}>Scan Digital Handshake</h3>
              <button type="button" className="vendor-btn-secondary" style={{ minHeight: 40, padding: '8px 10px' }} onClick={() => { stopScanner(); setScannerOpen(false); }}>
                Close
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 12 }}>
              Point your camera at the customer QR. We will auto-fill the token and lookup the order.
            </p>
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--bd)', background: '#000', minHeight: 220 }}>
              <video ref={scannerVideoRef} muted playsInline style={{ width: '100%', height: 280, objectFit: 'cover', display: scannerBusy ? 'block' : 'none' }} />
              {!scannerBusy && (
                <div style={{ color: '#fff', fontSize: 13, padding: 16, display: 'grid', gap: 10 }}>
                  <div>Camera is not active. Grant permission to start scanning.</div>
                  <button
                    type="button"
                    className="vendor-btn-primary"
                    style={{ width: '100%' }}
                    onClick={() => {
                      void startScanner();
                    }}
                  >
                    Allow camera & start scan
                  </button>
                </div>
              )}
            </div>
            {(scannerErr || lookupErr) && (
              <p style={{ marginTop: 10, color: 'var(--er)', fontSize: 13 }}>{scannerErr || lookupErr}</p>
            )}
          </div>
        </div>
      )}

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
        <div className="vendor-card stitch-pos-workspace">
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

            <div className="stitch-pos-items-section" style={{ borderTop: '1px solid var(--bd)', paddingTop: 16, marginTop: 16 }}>
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
                          <img
                            src={billCatalogThumbUrl(q.image_url, 72) ?? q.image_url}
                            alt=""
                            width={34}
                            height={34}
                            decoding="async"
                            loading="lazy"
                            style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--bd)' }}
                          />
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
            {originalServiceFee > 0 ? (
              <p style={{ fontWeight: 600, fontSize: 14 }}>
                Service fee:{' '}
                <span style={{ textDecoration: 'line-through', color: 'var(--ts)' }}>₹{originalServiceFee}</span> ₹0
              </p>
            ) : (
              <p style={{ fontWeight: 600, fontSize: 14 }}>
                Service fee: ₹{serviceFee}
              </p>
            )}
            {serviceFeeDiscount > 0 ? (
              <p style={{ fontSize: 12, color: 'var(--ok)', lineHeight: 1.4 }}>
                {SERVICE_FEE_DISCOUNT_LABEL}: -₹{serviceFeeDiscount}
              </p>
            ) : null}
            <p style={{ fontSize: 12, color: 'var(--ts)', lineHeight: 1.5 }}>{SERVICE_FEE_SHORT_EXPLANATION}</p>
            <p style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>Total: ₹{total}</p>

            <div className="vendor-action-row stitch-pos-actions" style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void handlePrint()}
                disabled={lineItems.length === 0 || (!sampleMode && !order?.token) || saving}
                className="vendor-btn-primary"
                style={{ flex: '1 1 200px' }}
              >
                {saving ? 'Saving…' : 'Print bill'}
              </button>
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
            <p style={{ marginTop: 10, fontSize: 12, color: 'var(--ts)' }}>
              Use the <strong>Bluetooth thermal</strong> section above for direct ESC/POS over Web Bluetooth, or set paper width in{' '}
              <Link href="/admin/printers" style={{ color: 'var(--b)', fontWeight: 600 }}>Admin → Printers</Link>. For the system dialog on Android, install{' '}
              <strong>ESCPOS Bluetooth Print Service</strong> if needed.
            </p>
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
                          <img
                            src={billCatalogThumbUrl(l.image_url, 104) ?? l.image_url}
                            alt=""
                            width={52}
                            height={52}
                            decoding="async"
                            loading="lazy"
                            style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--bd)', background: '#fff' }}
                          />
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
                const editFeeBreakdown = applyServiceFeeDiscount(sub);
                const editSvc = editFeeBreakdown.finalFee;
                const editOrig = editFeeBreakdown.originalFee;
                const editDiscount = editFeeBreakdown.discount;
                const editTotal = sub + editSvc;
                return (
                  <>
                    <p style={{ fontSize: 13, color: 'var(--ts)' }}>Total items: {editLineItems.reduce((s, l) => s + l.qty, 0)}</p>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>Subtotal: ₹{sub.toFixed(2)}</p>
                    {editOrig > 0 ? (
                      <p style={{ fontWeight: 600, fontSize: 14 }}>
                        Service fee:{' '}
                        <span style={{ textDecoration: 'line-through', color: 'var(--ts)' }}>₹{editOrig.toFixed(2)}</span> ₹0
                      </p>
                    ) : (
                      <p style={{ fontWeight: 600, fontSize: 14 }}>
                        Service fee: ₹{editSvc.toFixed(2)}
                      </p>
                    )}
                    {editDiscount > 0 ? (
                      <p style={{ fontSize: 12, color: 'var(--ok)', lineHeight: 1.4 }}>
                        {SERVICE_FEE_DISCOUNT_LABEL}: -₹{editDiscount.toFixed(2)}
                      </p>
                    ) : null}
                    <p style={{ fontSize: 12, color: 'var(--ts)', lineHeight: 1.5 }}>{SERVICE_FEE_SHORT_EXPLANATION}</p>
                    <p style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>Total: ₹{editTotal.toFixed(2)}</p>
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
