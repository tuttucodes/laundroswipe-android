'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { getVendorBillItems } from '@/lib/constants';
import type { BillItemOverride } from '@/lib/vendor-bill-catalog';

type RowState = { label: string; price: string; image_url: string | null };

export default function VendorItemsPage() {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState('Vendor');
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [initialOverrides, setInitialOverrides] = useState<Record<string, BillItemOverride>>({});
  const [rows, setRows] = useState<Record<string, RowState>>({});

  const defaults = useMemo(() => (vendorId ? getVendorBillItems(vendorId) : []), [vendorId]);

  const adminAuthHeaders = (): Record<string, string> => {
    const t = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const role = localStorage.getItem('admin_role');
    const slug = localStorage.getItem('admin_vendor_id');
    const displayName = localStorage.getItem('admin_vendor_name');
    if (role !== 'vendor' || !slug) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    setVendorId(slug);
    setVendorName(displayName?.trim() || slug);
  }, []);

  useEffect(() => {
    if (!vendorId) return;
    setLoading(true);
    fetch('/api/vendor/bill-catalog', { credentials: 'include', headers: adminAuthHeaders() })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.status === 401) {
          setForbidden(true);
          return null;
        }
        if (!r.ok || !data?.ok || !Array.isArray(data.items)) {
          setToast({ msg: data?.error || 'Could not load catalog', ok: false });
          return null;
        }
        return data as {
          items: Array<{ id: string; label: string; price: number; image_url?: string | null }>;
          overrides: Record<string, BillItemOverride>;
        };
      })
      .then((data) => {
        if (!data) {
          setLoading(false);
          return;
        }
        setInitialOverrides(data.overrides ?? {});
        const next: Record<string, RowState> = {};
        for (const i of data.items) {
          next[i.id] = {
            label: i.label,
            price: String(i.price),
            image_url: i.image_url ?? null,
          };
        }
        setRows(next);
        setLoading(false);
      })
      .catch(() => {
        setToast({ msg: 'Network error', ok: false });
        setLoading(false);
      });
  }, [vendorId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

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
    reader.onerror = () => onErr('Read failed');
    reader.readAsDataURL(file);
  };

  const setRow = (id: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const resetRow = (id: string) => {
    const d = defaults.find((x) => x.id === id);
    if (!d) return;
    setRow(id, { label: d.label, price: String(d.price), image_url: null });
  };

  const buildOverridesPayload = (): Record<string, BillItemOverride> | null => {
    const out: Record<string, BillItemOverride> = {};
    for (const d of defaults) {
      const r = rows[d.id];
      if (!r) continue;
      const priceNum = Number(r.price);
      if (!Number.isFinite(priceNum) || priceNum <= 0) return null;
      const patch: BillItemOverride = {};
      if (r.label.trim() !== d.label) patch.label = r.label.trim();
      if (priceNum !== d.price) patch.price = priceNum;
      const hadImage = Boolean(initialOverrides[d.id]?.image_url);
      if (r.image_url) patch.image_url = r.image_url;
      else if (hadImage) patch.image_url = null;
      if (Object.keys(patch).length > 0) out[d.id] = patch;
    }
    return out;
  };

  const save = async () => {
    if (!vendorId) return;
    setSaving(true);
    try {
      const overrides = buildOverridesPayload();
      if (!overrides) {
        setToast({ msg: 'Each item needs a valid rate greater than zero.', ok: false });
        setSaving(false);
        return;
      }
      const res = await fetch('/api/vendor/bill-catalog', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ overrides }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setToast({ msg: data?.error || 'Save failed', ok: false });
        return;
      }
      setInitialOverrides(data.overrides ?? overrides);
      setToast({ msg: 'Saved bill items', ok: true });
    } catch {
      setToast({ msg: 'Save failed', ok: false });
    } finally {
      setSaving(false);
    }
  };

  if (forbidden) {
    return (
      <div className="vendor-page" style={{ fontFamily: 'var(--fb)', background: 'var(--bg)', padding: 24 }}>
        <p>
          <Link href="/admin" style={{ color: 'var(--b)', fontWeight: 600 }}>
            ← Dashboard
          </Link>
        </p>
        <h1 style={{ fontFamily: 'var(--fd)', color: 'var(--b)' }}>Bill items</h1>
        <p style={{ color: 'var(--ts)' }}>Vendor login required.</p>
      </div>
    );
  }

  return (
    <div className="vendor-page" style={{ fontFamily: 'var(--fb)', background: 'var(--bg)', padding: '16px 16px 48px' }}>
      <p style={{ marginBottom: 12 }}>
        <Link href="/admin/vendor" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>
          ← Back to bill
        </Link>
      </p>
      <h1 style={{ fontFamily: 'var(--fd)', fontSize: 24, marginBottom: 6, color: 'var(--b)' }}>{vendorName} · Items</h1>
      <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 20, maxWidth: 560 }}>
        Set rates, short labels, and photos for each bill line. Staff can tap the picture when making a bill (shirt, jeans,
        etc.). Changes apply to new bills immediately.
      </p>

      {toast && (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 14,
            background: toast.ok ? 'var(--bl)' : '#FEE2E2',
            color: toast.ok ? 'var(--b)' : '#991B1B',
          }}
        >
          {toast.msg}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--ts)' }}>Loading catalog…</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            <button type="button" className="vendor-btn-primary" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              className="vendor-btn-secondary"
              disabled={saving}
              onClick={() => {
                for (const d of defaults) resetRow(d.id);
                setToast({ msg: 'Reset to defaults (not saved yet)', ok: true });
              }}
            >
              Reset all to defaults
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {defaults.map((d) => {
              const r = rows[d.id];
              if (!r) return null;
              return (
                <div
                  key={d.id}
                  className="vendor-card"
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(72px, 88px) 1fr', gap: 14, alignItems: 'start' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                    {r.image_url ? (
                      <img
                        src={r.image_url}
                        alt=""
                        style={{
                          width: 80,
                          height: 80,
                          objectFit: 'cover',
                          borderRadius: 10,
                          border: '1px solid var(--bd)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 10,
                          border: '2px dashed var(--bd)',
                          background: 'var(--bg-card)',
                        }}
                      />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      aria-label={`Photo for ${d.label}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        readImageAsDataUrl(
                          file,
                          (url) => setRow(d.id, { image_url: url }),
                          (msg) => setToast({ msg, ok: false }),
                        );
                      }}
                    />
                    <button type="button" className="vendor-btn-secondary" style={{ fontSize: 12, padding: '6px 8px' }} onClick={() => setRow(d.id, { image_url: null })}>
                      Clear photo
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--ts)' }}>
                      Default: {d.label} · ₹{d.price}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8 }}>
                      <input
                        className="vendor-input"
                        value={r.label}
                        onChange={(e) => setRow(d.id, { label: e.target.value })}
                        placeholder="Label on bill"
                      />
                      <input
                        className="vendor-input"
                        value={r.price}
                        onChange={(e) => setRow(d.id, { price: e.target.value })}
                        inputMode="decimal"
                        placeholder="₹"
                      />
                    </div>
                    <button type="button" className="vendor-btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => resetRow(d.id)}>
                      Reset this item
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
