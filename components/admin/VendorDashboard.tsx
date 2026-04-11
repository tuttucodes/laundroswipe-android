'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardList, Plus, RefreshCw, Tags, Truck } from 'lucide-react';
import { displayRollupBlockKey } from '@/lib/hostel-block';
import { normalizeVendorDashboardPayload } from '@/lib/vendor-dashboard-normalize';
import type { VendorDashboardMetrics } from '@/lib/vendor-dashboard-types';
import { VendorRevenueTrendCard } from './VendorRevenueTrendCard';

export type { VendorDashboardMetrics };

type Section = 'overview' | 'delivered' | 'revenue' | 'blocks';

type BlockDrillState =
  | { kind: 'delivery'; delivery_date: string; block_key: string; expected_bill_count: number }
  | { kind: 'billed'; bill_date: string; block_key: string; expected_bill_count: number };

function compareBlockKeys(a: string, b: string): number {
  const da = displayRollupBlockKey(a);
  const db = displayRollupBlockKey(b);
  const na = da === 'No block';
  const nb = db === 'No block';
  if (na && !nb) return 1;
  if (!na && nb) return -1;
  return da.localeCompare(db);
}

function adminAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const STATUS_ORDER = ['scheduled', 'agent_assigned', 'picked_up', 'processing', 'ready', 'out_for_delivery'] as const;
const STATUS_LABELS_MAP: Record<string, string> = {
  scheduled: 'Scheduled',
  agent_assigned: 'Agent Assigned',
  picked_up: 'Picked Up',
  processing: 'Processing',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
};

type DeliveredDetailRow = {
  order_id: string;
  token: string;
  order_number: string | null;
  customer_name: string;
  customer_phone: string;
  customer_hostel_block: string;
  customer_room_number: string;
  item_qty: number;
  total: number;
  has_bill: boolean;
};

type BlockDetailRow = {
  order_id: string;
  token: string;
  order_number: string | null;
  customer_name: string;
  customer_phone: string;
  customer_reg_no: string;
  customer_hostel_block: string;
  customer_room_number: string;
  item_qty: number;
  total: number;
};

type Props = {
  onUnauthorized: () => void;
};

/**
 * Vendor-facing metrics hub (admin session). Loads normalized payloads from `GET /api/admin/dashboard`;
 * drill-downs: delivered day, block day, bill day × block — see `lib/vendor-dashboard-types.ts`.
 */
export function VendorDashboard({ onUnauthorized }: Props) {
  const router = useRouter();
  const [section, setSection] = useState<Section>('overview');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<VendorDashboardMetrics | null>(null);
  const [blockFrom, setBlockFrom] = useState('');
  const [blockTo, setBlockTo] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);
  const [revenueScrollId, setRevenueScrollId] = useState<string | null>(null);
  const [deliveredDay, setDeliveredDay] = useState<string | null>(null);
  const [deliveredDetailLoading, setDeliveredDetailLoading] = useState(false);
  const [deliveredDetailRows, setDeliveredDetailRows] = useState<DeliveredDetailRow[] | null>(null);
  const [deliveredDetailErr, setDeliveredDetailErr] = useState<string | null>(null);
  const [blockDrill, setBlockDrill] = useState<BlockDrillState | null>(null);
  const [blockDetailLoading, setBlockDetailLoading] = useState(false);
  const [blockDetailRows, setBlockDetailRows] = useState<BlockDetailRow[] | null>(null);
  const [blockDetailErr, setBlockDetailErr] = useState<string | null>(null);
  const [blockDetailMeta, setBlockDetailMeta] = useState<{
    orders_on_day: number;
    rows_matched: number;
    expected_bill_count: number;
    context: 'delivery' | 'billed';
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const openOrdersShortcut = useCallback(
    (filter: string) => {
      if (filter === 'delivered') {
        setDeliveredDay(null);
        setSection('delivered');
        return;
      }
      router.push('/admin/pickup');
    },
    [router],
  );

  const loadDashboard = useCallback(
    async (opts?: { block_from?: string; block_to?: string }) => {
      const params = new URLSearchParams();
      if (opts?.block_from) params.set('block_from', opts.block_from);
      if (opts?.block_to) params.set('block_to', opts.block_to);
      const q = params.toString();
      const url = q ? `/api/admin/dashboard?${q}` : '/api/admin/dashboard';
      const r = await fetch(url, { credentials: 'include', headers: adminAuthHeaders() });
      if (r.status === 401) {
        onUnauthorized();
        return { ok: false as const, unauthorized: true };
      }
      const d = await r.json().catch(() => null);
      if (!d || typeof d !== 'object') {
        return { ok: false as const, error: 'Invalid response' };
      }
      if (!(d as { ok?: boolean }).ok) {
        const msg = typeof (d as { error?: string }).error === 'string' ? (d as { error: string }).error : 'Request failed';
        return { ok: false as const, error: msg };
      }
      const { ok: _ok, ...rest } = d as { ok: boolean } & Record<string, unknown>;
      const metricsNorm = normalizeVendorDashboardPayload(rest);
      if (!metricsNorm) {
        return { ok: false as const, error: 'Dashboard data shape mismatch — deploy the latest API.' };
      }
      return { ok: true as const, metrics: metricsNorm };
    },
    [onUnauthorized],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    loadDashboard()
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setMetrics(res.metrics);
          setLoadError(null);
        } else if (!('unauthorized' in res && res.unauthorized)) {
          setLoadError(res.error ?? 'Could not load');
          setMetrics(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadDashboard]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setLoadError(null);
    const opts =
      blockFrom && blockTo && /^\d{4}-\d{2}-\d{2}$/.test(blockFrom) && /^\d{4}-\d{2}-\d{2}$/.test(blockTo)
        ? { block_from: blockFrom, block_to: blockTo }
        : undefined;
    const res = await loadDashboard(opts);
    if (res.ok) {
      setMetrics(res.metrics);
    } else if (!('unauthorized' in res && res.unauthorized)) {
      setLoadError(res.error ?? 'Refresh failed');
    }
    setRefreshing(false);
  }, [blockFrom, blockTo, loadDashboard]);

  useEffect(() => {
    if (section !== 'revenue' || !revenueScrollId) return;
    const t = window.setTimeout(() => {
      document.getElementById(revenueScrollId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setRevenueScrollId(null);
    }, 120);
    return () => clearTimeout(t);
  }, [section, revenueScrollId]);

  const loadDeliveredDay = useCallback(
    async (date: string) => {
      setDeliveredDetailLoading(true);
      setDeliveredDetailErr(null);
      try {
        const r = await fetch(
          `/api/admin/orders/delivered-day-detail?date=${encodeURIComponent(date)}`,
          { credentials: 'include', headers: adminAuthHeaders() },
        );
        if (r.status === 401) {
          onUnauthorized();
          return;
        }
        const d = await r.json().catch(() => null);
        if (!d?.ok) {
          setDeliveredDetailErr(typeof d?.error === 'string' ? d.error : 'Failed to load');
          setDeliveredDetailRows([]);
          return;
        }
        setDeliveredDetailRows((d.rows ?? []) as DeliveredDetailRow[]);
      } finally {
        setDeliveredDetailLoading(false);
      }
    },
    [onUnauthorized],
  );

  useEffect(() => {
    if (!deliveredDay) {
      setDeliveredDetailRows(null);
      setDeliveredDetailErr(null);
      return;
    }
    void loadDeliveredDay(deliveredDay);
  }, [deliveredDay, loadDeliveredDay]);

  useEffect(() => {
    if (section !== 'delivered') setDeliveredDay(null);
  }, [section]);

  const loadBlockDrill = useCallback(
    async (payload: BlockDrillState) => {
      setBlockDetailLoading(true);
      setBlockDetailErr(null);
      setBlockDetailMeta(null);
      try {
        let r: Response;
        if (payload.kind === 'delivery') {
          const q = new URLSearchParams({
            date: payload.delivery_date,
            block_key: payload.block_key,
          });
          r = await fetch(`/api/admin/orders/block-day-detail?${q}`, {
            credentials: 'include',
            headers: adminAuthHeaders(),
          });
        } else {
          const q = new URLSearchParams({
            date: payload.bill_date,
            block_key: payload.block_key,
          });
          if (blockFrom) q.set('block_from', blockFrom);
          if (blockTo) q.set('block_to', blockTo);
          r = await fetch(`/api/admin/orders/bill-day-block-detail?${q}`, {
            credentials: 'include',
            headers: adminAuthHeaders(),
          });
        }
        if (r.status === 401) {
          onUnauthorized();
          return;
        }
        const d = await r.json().catch(() => null);
        if (!d?.ok) {
          setBlockDetailErr(typeof d?.error === 'string' ? d.error : 'Failed to load');
          setBlockDetailRows([]);
          return;
        }
        const list = (d.rows ?? []) as BlockDetailRow[];
        setBlockDetailRows(list);
        if (payload.kind === 'delivery') {
          setBlockDetailMeta({
            orders_on_day: Number(d.orders_on_day) || 0,
            rows_matched: Number(d.rows_matched) || list.length,
            expected_bill_count: payload.expected_bill_count,
            context: 'delivery',
          });
        } else {
          setBlockDetailMeta({
            orders_on_day: Number(d.bills_in_range_on_day) || 0,
            rows_matched: Number(d.rows_matched) || list.length,
            expected_bill_count: payload.expected_bill_count,
            context: 'billed',
          });
        }
      } finally {
        setBlockDetailLoading(false);
      }
    },
    [blockFrom, blockTo, onUnauthorized],
  );

  useEffect(() => {
    if (!blockDrill) {
      setBlockDetailRows(null);
      setBlockDetailErr(null);
      setBlockDetailMeta(null);
      return;
    }
    void loadBlockDrill(blockDrill);
  }, [blockDrill, loadBlockDrill]);

  useEffect(() => {
    if (section !== 'blocks') setBlockDrill(null);
  }, [section]);

  const deliveredDailyRows = useMemo(() => {
    if (!metrics) return [];
    const delMap = new Map(metrics.delivered_30d.by_date.map((d) => [d.date, d.count]));
    const colMap = new Map(metrics.collected_30d.by_date.map((d) => [d.date, d]));
    const dates = new Set([...delMap.keys(), ...colMap.keys()]);
    return [...dates]
      .sort((a, b) => b.localeCompare(a))
      .map((date) => {
        const ordersN = delMap.get(date) ?? 0;
        const col = colMap.get(date);
        return {
          date,
          orders_delivered: ordersN,
          item_qty: col?.item_qty_sum ?? 0,
          bill_amount: col?.total ?? 0,
          bill_count: col?.bill_count ?? 0,
        };
      });
  }, [metrics]);

  const applyBlockRange = async () => {
    if (!blockFrom || !blockTo) return;
    setBlockLoading(true);
    const res = await loadDashboard({ block_from: blockFrom, block_to: blockTo });
    if (res.ok) setMetrics(res.metrics);
    setBlockLoading(false);
  };

  const resetBlockRange = async () => {
    setBlockFrom('');
    setBlockTo('');
    setBlockLoading(true);
    const res = await loadDashboard();
    if (res.ok) setMetrics(res.metrics);
    setBlockLoading(false);
  };

  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const fmtMoney = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const blocksGrouped = useMemo(() => {
    const rows = metrics?.collected_by_block ?? [];
    const byDate = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = r.delivery_date;
      const arr = byDate.get(k) ?? [];
      arr.push(r);
      byDate.set(k, arr);
    }
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [metrics?.collected_by_block]);

  const billedBlocksGrouped = useMemo(() => {
    const rows = metrics?.billed_by_block ?? [];
    const byDate = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = r.bill_date;
      const arr = byDate.get(k) ?? [];
      arr.push(r);
      byDate.set(k, arr);
    }
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [metrics?.billed_by_block]);

  const navBtn = (id: Section, label: string) => (
    <button
      key={id}
      type="button"
      role="tab"
      id={`vd-tab-${id}`}
      aria-selected={section === id}
      aria-controls="vd-dashboard-panel"
      className={`vd-nav-btn ${section === id ? 'vd-nav-btn-active' : ''}`}
      onClick={() => setSection(id)}
    >
      {label}
    </button>
  );

  if (loading && !metrics) {
    return (
      <div className="vd-root vd-root-interactive">
        <div className="vd-skeleton vd-skeleton-title" />
        <div className="vd-skeleton-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="vd-skeleton vd-skeleton-card" />
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="vd-root vd-root-interactive">
        <div className="vendor-card vd-panel vd-panel-highlight">
          <h2 className="vd-panel-title">Could not load dashboard</h2>
          <p className="vd-panel-desc">{loadError ?? 'Check your connection and try again.'}</p>
          <button type="button" className="vendor-btn-primary" onClick={() => void handleRefresh()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vd-root vd-root-interactive">
      <header className="vd-sticky-head">
        <div className="vd-sticky-inner">
          <div className="vd-toolbar">
            <div className="vd-toolbar-text">
              <h1 className="vd-title">Dashboard</h1>
              <p className="vd-toolbar-tagline">Live metrics from your vendor APIs · India (IST) dates</p>
            </div>
            <button
              type="button"
              className="vd-refresh-btn"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              aria-busy={refreshing}
              aria-label="Refresh dashboard data"
            >
              <RefreshCw size={20} strokeWidth={2} className={refreshing ? 'vd-icon-spin' : undefined} aria-hidden />
              <span className="vd-refresh-label">Refresh</span>
            </button>
          </div>
          <div className="vd-nav vd-nav-scroll" role="tablist" aria-label="Dashboard sections">
            {navBtn('overview', 'Overview')}
            {navBtn('delivered', 'Delivered')}
            {navBtn('revenue', 'Revenue')}
            {navBtn('blocks', 'By block')}
          </div>
        </div>
      </header>

      <details className="vd-about-dash">
        <summary>How normal vs delivery revenue works</summary>
        <p className="vd-sub">
          <strong>Normal revenue</strong> = total on bills you generated (grouped by the day you saved the bill in India time).{' '}
          <strong>Delivery revenue</strong> = the same bill totals counted on the day the order was marked <em>delivered</em> (batch delivery days).{' '}
          Period totals usually match; only the per-day split differs.
        </p>
      </details>

      <AnimatePresence mode="wait">
        <motion.div
          key={section}
          id="vd-dashboard-panel"
          role="tabpanel"
          aria-labelledby={`vd-tab-${section}`}
          className="vd-section-motion"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {section === 'overview' && (
        <motion.div
          className="vd-grid-cards"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.055, delayChildren: 0.03 } },
          }}
          initial="hidden"
          animate="show"
        >
          <motion.button
            type="button"
            className="vd-card vd-card-green"
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => {
              setSection('revenue');
              setRevenueScrollId('vd-anchor-billed-7');
            }}
          >
            <span className="vd-card-icon">📈</span>
            <span className="vd-card-label">Normal revenue · 7 days</span>
            <span className="vd-card-value">{fmtMoney(metrics.billed_7d.total)}</span>
            <span className="vd-card-meta">
              {metrics.billed_7d.bill_count} bills generated · {metrics.billed_7d.item_qty_sum} items
            </span>
            <span className="vd-card-hint">Open 7-day bill table →</span>
          </motion.button>
          <motion.button
            type="button"
            className="vd-card vd-card-blue"
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => {
              setSection('revenue');
              setRevenueScrollId('vd-anchor-billed-30');
            }}
          >
            <span className="vd-card-icon">💰</span>
            <span className="vd-card-label">Normal revenue · 30 days</span>
            <span className="vd-card-value">{fmtMoney(metrics.billed_30d.total)}</span>
            <span className="vd-card-meta">
              {metrics.billed_30d.bill_count} bills generated · {metrics.billed_30d.item_qty_sum} items
            </span>
            <span className="vd-card-hint">Open 30-day bill table →</span>
          </motion.button>
          <motion.button
            type="button"
            className="vd-card vd-card-violet"
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => {
              setSection('revenue');
              setRevenueScrollId('vd-anchor-collected-7');
            }}
          >
            <span className="vd-card-icon">🚚</span>
            <span className="vd-card-label">Delivery revenue · 7 days</span>
            <span className="vd-card-value">{fmtMoney(metrics.collected_7d.total)}</span>
            <span className="vd-card-meta">
              {metrics.collected_7d.bill_count} bills on delivery days · {metrics.delivered_7d.count} orders delivered
            </span>
            <span className="vd-card-hint">Open 7-day delivery table →</span>
          </motion.button>
          <motion.button
            type="button"
            className="vd-card vd-card-teal"
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => {
              setSection('revenue');
              setRevenueScrollId('vd-anchor-collected-30');
            }}
          >
            <span className="vd-card-icon">📦</span>
            <span className="vd-card-label">Delivery revenue · 30 days</span>
            <span className="vd-card-value">{fmtMoney(metrics.collected_30d.total)}</span>
            <span className="vd-card-meta">
              {metrics.collected_30d.bill_count} bills on delivery days · {metrics.delivered_30d.count} orders delivered
            </span>
            <span className="vd-card-hint">Open 30-day delivery table →</span>
          </motion.button>
          <motion.button
            type="button"
            className="vd-card vd-card-amber"
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => {
              openOrdersShortcut('open');
            }}
          >
            <span className="vd-card-icon">🎫</span>
            <span className="vd-card-label">Open tokens</span>
            <span className="vd-card-value">{metrics.open_tokens.count}</span>
            <span className="vd-card-meta">Not yet delivered — pending pickup / delivery</span>
            <span className="vd-card-hint">Pickup / delivery →</span>
          </motion.button>
          <motion.button
            type="button"
            className="vd-card vd-card-slate"
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => {
              setDeliveredDay(null);
              setSection('delivered');
            }}
          >
            <span className="vd-card-icon">✅</span>
            <span className="vd-card-label">Delivered orders · 7 days</span>
            <span className="vd-card-value">{metrics.delivered_7d.count}</span>
            <span className="vd-card-meta">Count of completed deliveries</span>
            <span className="vd-card-hint">Daily items &amp; drill-down →</span>
          </motion.button>
        </motion.div>
      )}

      {section === 'delivered' && (
        <div className="vendor-card vd-panel">
          {!deliveredDay ? (
            <>
              <h2 className="vd-panel-title">Delivered — last 30 days (India date)</h2>
              <p className="vd-panel-desc">
                <strong>Orders</strong> = deliveries completed that day. <strong>Items</strong> / <strong>Bill amount</strong> come from saved bills linked to those orders. Tap a row to see token, contact, block, room, item qty and amount per bill.
              </p>
              <div className="vd-table-wrap">
                <table className="vd-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="vd-num">Orders delivered</th>
                      <th className="vd-num">Bills</th>
                      <th className="vd-num">Items (qty)</th>
                      <th className="vd-num">Bill total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveredDailyRows.map((row) => (
                      <tr
                        key={row.date}
                        className="vd-row-clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => setDeliveredDay(row.date)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setDeliveredDay(row.date);
                          }
                        }}
                      >
                        <td>{fmtDate(row.date)}</td>
                        <td className="vd-num">{row.orders_delivered}</td>
                        <td className="vd-num">{row.bill_count}</td>
                        <td className="vd-num">{row.item_qty}</td>
                        <td className="vd-num vd-strong">{fmtMoney(row.bill_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="vd-actions">
                <button type="button" className="vendor-btn-primary" onClick={() => openOrdersShortcut('all')}>
                  Pickup / delivery
                </button>
                <button type="button" className="vendor-btn-secondary" onClick={() => openOrdersShortcut('open')}>
                  Open / pending (routes)
                </button>
                <button type="button" className="vendor-btn-secondary" onClick={() => openOrdersShortcut('delivered')}>
                  Delivered only
                </button>
              </div>
              <details className="vd-details">
                <summary>Open tokens by status</summary>
                <div className="vd-chips">
                  {STATUS_ORDER.map((s) => {
                    const count = metrics.open_tokens.by_status[s] ?? 0;
                    if (count === 0) return null;
                    return (
                      <button key={s} type="button" className="vd-chip" onClick={() => openOrdersShortcut(s)}>
                        <span className="vd-chip-n">{count}</span>
                        <span>{STATUS_LABELS_MAP[s] ?? s}</span>
                      </button>
                    );
                  })}
                </div>
              </details>
            </>
          ) : (
            <>
              <div className="vd-back-row">
                <button type="button" className="vendor-btn-secondary" onClick={() => setDeliveredDay(null)}>
                  ← Back to daily summary
                </button>
                <h2 className="vd-panel-title" style={{ margin: 0 }}>
                  Delivered on {fmtDate(deliveredDay)}
                </h2>
              </div>
              <p className="vd-panel-desc">One row per order delivered that day. Amounts from the saved bill when present.</p>
              {deliveredDetailLoading && <p className="vd-muted">Loading…</p>}
              {deliveredDetailErr && <p style={{ color: 'var(--er)' }}>{deliveredDetailErr}</p>}
              {!deliveredDetailLoading && deliveredDetailRows && (
                <div className="vd-table-wrap">
                  <table className="vd-table" style={{ minWidth: 720 }}>
                    <thead>
                      <tr>
                        <th>Token</th>
                        <th>Name</th>
                        <th>Mobile</th>
                        <th>Block</th>
                        <th>Room</th>
                        <th className="vd-num">Items</th>
                        <th className="vd-num">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveredDetailRows.map((r) => (
                        <tr key={r.order_id}>
                          <td style={{ fontWeight: 800, color: 'var(--o)' }}>#{r.token}</td>
                          <td>{r.customer_name}</td>
                          <td>{r.customer_phone}</td>
                          <td>{r.customer_hostel_block}</td>
                          <td>{r.customer_room_number}</td>
                          <td className="vd-num">{r.item_qty}</td>
                          <td className="vd-num vd-strong">{r.has_bill ? fmtMoney(r.total) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {deliveredDetailRows.length === 0 && !deliveredDetailErr && (
                    <p className="vd-muted" style={{ marginTop: 12 }}>
                      No delivered orders found for this day in the recent window. For older dates, use <strong>Pickup / delivery</strong> from the menu.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {section === 'revenue' && (
        <div className="vd-stack">
          <div className="vd-revenue-summary vendor-card vd-panel" style={{ padding: 0, border: 'none', boxShadow: 'none', background: 'transparent' }}>
            <table>
              <thead>
                <tr>
                  <th scope="col">View</th>
                  <th scope="col" className="vd-num">
                    Last 7 days
                  </th>
                  <th scope="col" className="vd-num">
                    Last 30 days
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="vd-rw-label">
                    Normal revenue
                    <span className="vd-rw-sub">Total on bills generated · by bill-save date (India)</span>
                  </td>
                  <td className="vd-num vd-strong">{fmtMoney(metrics.billed_7d.total)}</td>
                  <td className="vd-num vd-strong">{fmtMoney(metrics.billed_30d.total)}</td>
                </tr>
                <tr>
                  <td className="vd-rw-label">
                    Delivery revenue
                    <span className="vd-rw-sub">Same bills · counted on order delivered date (India)</span>
                  </td>
                  <td className="vd-num vd-strong">{fmtMoney(metrics.collected_7d.total)}</td>
                  <td className="vd-num vd-strong">{fmtMoney(metrics.collected_30d.total)}</td>
                </tr>
                <tr>
                  <td className="vd-rw-label">
                    Bills in scope
                    <span className="vd-rw-sub">Same bills as the revenue rows above — generated vs delivery-day calendar</span>
                  </td>
                  <td className="vd-num">
                    {metrics.billed_7d.bill_count} gen. / {metrics.collected_7d.bill_count} del.
                  </td>
                  <td className="vd-num">
                    {metrics.billed_30d.bill_count} gen. / {metrics.collected_30d.bill_count} del.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <VendorRevenueTrendCard
            billed7={metrics.billed_7d.by_date}
            collected7={metrics.collected_7d.by_date}
            billed30={metrics.billed_30d.by_date}
            collected30={metrics.collected_30d.by_date}
            formatDayLabel={fmtDate}
            formatMoney={fmtMoney}
          />

          <div id="vd-anchor-billed-7" className="vendor-card vd-panel vd-panel-highlight">
            <h2 className="vd-panel-title">Normal revenue — daily (bills generated)</h2>
            <p className="vd-panel-desc">
              Each row is the total <strong>bill amount</strong> for bills <strong>saved that calendar day</strong> (Asia/Kolkata). This is the usual &quot;how much did we sell today&quot; view.
            </p>
            <div className="vd-table-wrap">
              <table className="vd-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="vd-num">Bills</th>
                    <th className="vd-num">Items</th>
                    <th className="vd-num">Subtotal</th>
                    <th className="vd-num">Fees</th>
                    <th className="vd-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...metrics.billed_7d.by_date].reverse().map((r) => (
                    <tr key={r.date}>
                      <td>{fmtDate(r.date)}</td>
                      <td className="vd-num">{r.bill_count}</td>
                      <td className="vd-num">{r.item_qty_sum}</td>
                      <td className="vd-num">{fmtMoney(r.subtotal)}</td>
                      <td className="vd-num">{fmtMoney(r.convenience_fee)}</td>
                      <td className="vd-num vd-strong">{fmtMoney(r.total)}</td>
                    </tr>
                  ))}
                  <tr className="vd-total-row">
                    <td>Total</td>
                    <td className="vd-num">{metrics.billed_7d.bill_count}</td>
                    <td className="vd-num">{metrics.billed_7d.item_qty_sum}</td>
                    <td className="vd-num">{fmtMoney(metrics.billed_7d.subtotal)}</td>
                    <td className="vd-num">{fmtMoney(metrics.billed_7d.convenience_fee)}</td>
                    <td className="vd-num vd-strong">{fmtMoney(metrics.billed_7d.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div id="vd-anchor-billed-30" className="vendor-card vd-panel vd-panel-highlight">
            <h2 className="vd-panel-title">Normal revenue — last 30 days (bills generated)</h2>
            <div className="vd-table-wrap">
              <table className="vd-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="vd-num">Bills</th>
                    <th className="vd-num">Items</th>
                    <th className="vd-num">Subtotal</th>
                    <th className="vd-num">Fees</th>
                    <th className="vd-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...metrics.billed_30d.by_date].reverse().map((r) => (
                    <tr key={r.date}>
                      <td>{fmtDate(r.date)}</td>
                      <td className="vd-num">{r.bill_count}</td>
                      <td className="vd-num">{r.item_qty_sum}</td>
                      <td className="vd-num">{fmtMoney(r.subtotal)}</td>
                      <td className="vd-num">{fmtMoney(r.convenience_fee)}</td>
                      <td className="vd-num vd-strong">{fmtMoney(r.total)}</td>
                    </tr>
                  ))}
                  <tr className="vd-total-row">
                    <td>Total</td>
                    <td className="vd-num">{metrics.billed_30d.bill_count}</td>
                    <td className="vd-num">{metrics.billed_30d.item_qty_sum}</td>
                    <td className="vd-num">{fmtMoney(metrics.billed_30d.subtotal)}</td>
                    <td className="vd-num">{fmtMoney(metrics.billed_30d.convenience_fee)}</td>
                    <td className="vd-num vd-strong">{fmtMoney(metrics.billed_30d.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div id="vd-anchor-collected-7" className="vendor-card vd-panel">
            <h2 className="vd-panel-title">Delivery revenue — daily (when orders were delivered)</h2>
            <p className="vd-panel-desc">
              Bill totals are grouped by the day the linked order was marked <strong>delivered</strong> (not the day you created the bill). Batch delivery days look busy; other days can be ₹0 even when you billed every day — that is expected. The <strong>sum</strong> over a period should align with normal revenue once everything is delivered.
            </p>
            <div className="vd-table-wrap">
              <table className="vd-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="vd-num">Bills</th>
                    <th className="vd-num">Items</th>
                    <th className="vd-num">Subtotal</th>
                    <th className="vd-num">Fees</th>
                    <th className="vd-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...metrics.collected_7d.by_date].reverse().map((r) => (
                    <tr key={r.date}>
                      <td>{fmtDate(r.date)}</td>
                      <td className="vd-num">{r.bill_count}</td>
                      <td className="vd-num">{r.item_qty_sum}</td>
                      <td className="vd-num">{fmtMoney(r.subtotal)}</td>
                      <td className="vd-num">{fmtMoney(r.convenience_fee)}</td>
                      <td className="vd-num vd-strong">{fmtMoney(r.total)}</td>
                    </tr>
                  ))}
                  <tr className="vd-total-row">
                    <td>Total</td>
                    <td className="vd-num">{metrics.collected_7d.bill_count}</td>
                    <td className="vd-num">{metrics.collected_7d.item_qty_sum}</td>
                    <td className="vd-num">{fmtMoney(metrics.collected_7d.subtotal)}</td>
                    <td className="vd-num">{fmtMoney(metrics.collected_7d.convenience_fee)}</td>
                    <td className="vd-num vd-strong">{fmtMoney(metrics.collected_7d.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div id="vd-anchor-collected-30" className="vendor-card vd-panel">
            <h2 className="vd-panel-title">Delivery revenue — last 30 days</h2>
            <p className="vd-panel-desc">Same rules as the 7-day table above.</p>
            <div className="vd-table-wrap">
              <table className="vd-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="vd-num">Bills</th>
                    <th className="vd-num">Items</th>
                    <th className="vd-num">Subtotal</th>
                    <th className="vd-num">Fees</th>
                    <th className="vd-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...metrics.collected_30d.by_date].reverse().map((r) => (
                    <tr key={r.date}>
                      <td>{fmtDate(r.date)}</td>
                      <td className="vd-num">{r.bill_count}</td>
                      <td className="vd-num">{r.item_qty_sum}</td>
                      <td className="vd-num">{fmtMoney(r.subtotal)}</td>
                      <td className="vd-num">{fmtMoney(r.convenience_fee)}</td>
                      <td className="vd-num vd-strong">{fmtMoney(r.total)}</td>
                    </tr>
                  ))}
                  <tr className="vd-total-row">
                    <td>Total</td>
                    <td className="vd-num">{metrics.collected_30d.bill_count}</td>
                    <td className="vd-num">{metrics.collected_30d.item_qty_sum}</td>
                    <td className="vd-num">{fmtMoney(metrics.collected_30d.subtotal)}</td>
                    <td className="vd-num">{fmtMoney(metrics.collected_30d.convenience_fee)}</td>
                    <td className="vd-num vd-strong">{fmtMoney(metrics.collected_30d.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <details className="vd-details">
            <summary>Legacy UTC bucket totals (debug)</summary>
            <p className="vd-muted small">
              Old RPC day buckets (UTC, not India date) — 7d {fmtMoney(metrics.revenue_7d.total)} ({metrics.revenue_7d.bill_count} bills) · 30d{' '}
              {fmtMoney(metrics.revenue_30d.total)} ({metrics.revenue_30d.bill_count} bills)
            </p>
          </details>
        </div>
      )}

      {section === 'blocks' && (
        <div className="vendor-card vd-panel">
          {!blockDrill ? (
            <>
              <h2 className="vd-panel-title">Hostel block breakdown</h2>
              <p className="vd-panel-desc">
                Two views use the same block rules: the saved bill&apos;s <code>customer_hostel_block</code> first; if empty, the linked customer&apos;s profile <code>hostel_block</code>. If both are empty →{' '}
                <strong className="vd-block-unknown-inline">No block</strong> (shown explicitly whenever those bills exist).{' '}
                <strong>A</strong>, <strong>D1</strong>, and <strong>D2</strong> roll up common variants. Dates are India time. The range below applies to <em>both</em> tables. Tap a row to list matching bills.
              </p>
              <div className="vd-filter-row">
                <label className="vd-field">
                  <span>From</span>
                  <input type="date" className="fi" value={blockFrom} onChange={(e) => setBlockFrom(e.target.value)} />
                </label>
                <label className="vd-field">
                  <span>To</span>
                  <input type="date" className="fi" value={blockTo} onChange={(e) => setBlockTo(e.target.value)} />
                </label>
                <button
                  type="button"
                  className="vendor-btn-primary"
                  disabled={blockLoading || !blockFrom || !blockTo}
                  onClick={() => void applyBlockRange()}
                >
                  {blockLoading ? 'Loading…' : 'Apply'}
                </button>
                <button type="button" className="vendor-btn-secondary" disabled={blockLoading} onClick={() => void resetBlockRange()}>
                  Reset (30d)
                </button>
              </div>

              <h3 className="vd-blocks-subtitle">Bills generated × block × date</h3>
              <p className="vd-panel-desc" style={{ marginTop: -4 }}>
                Totals for the <strong>newest bill per token</strong> saved in the selected range, grouped by the calendar day you saved the bill and by rollup block. Includes bills with no linked order (still counted under <strong>No block</strong> when block text is missing).
              </p>
              <div className="vd-table-wrap">
                <table className="vd-table">
                  <thead>
                    <tr>
                      <th>Bill date</th>
                      <th>Block</th>
                      <th className="vd-num">Bills</th>
                      <th className="vd-num">Items</th>
                      <th className="vd-num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billedBlocksGrouped.flatMap(([date, rows]) =>
                      rows
                        .sort((a, b) => compareBlockKeys(a.block_key, b.block_key))
                        .map((r) => (
                          <tr
                            key={`b-${date}-${r.block_key}`}
                            className="vd-row-clickable"
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              setBlockDrill({
                                kind: 'billed',
                                bill_date: r.bill_date,
                                block_key: displayRollupBlockKey(r.block_key),
                                expected_bill_count: r.bill_count,
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setBlockDrill({
                                  kind: 'billed',
                                  bill_date: r.bill_date,
                                  block_key: displayRollupBlockKey(r.block_key),
                                  expected_bill_count: r.bill_count,
                                });
                              }
                            }}
                          >
                            <td>{fmtDate(r.bill_date)}</td>
                            <td className={displayRollupBlockKey(r.block_key) === 'No block' ? 'vd-block-unknown' : undefined}>
                              {displayRollupBlockKey(r.block_key)}
                            </td>
                            <td className="vd-num">{r.bill_count}</td>
                            <td className="vd-num">{r.item_qty_sum}</td>
                            <td className="vd-num vd-strong">{fmtMoney(r.total)}</td>
                          </tr>
                        )),
                    )}
                  </tbody>
                </table>
              </div>
              {billedBlocksGrouped.length === 0 && <p className="vd-muted">No bill-generated rows in this range.</p>}

              <h3 className="vd-blocks-subtitle">Delivery × block × date</h3>
              <p className="vd-panel-desc" style={{ marginTop: -4 }}>
                Same bill per token, grouped by the day the order was marked <strong>delivered</strong> (and rollup block). Only delivered orders appear here.
              </p>
              <div className="vd-table-wrap">
                <table className="vd-table">
                  <thead>
                    <tr>
                      <th>Delivery date</th>
                      <th>Block</th>
                      <th className="vd-num">Bills</th>
                      <th className="vd-num">Items</th>
                      <th className="vd-num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocksGrouped.flatMap(([date, rows]) =>
                      rows
                        .sort((a, b) => compareBlockKeys(a.block_key, b.block_key))
                        .map((r) => (
                          <tr
                            key={`d-${date}-${r.block_key}`}
                            className="vd-row-clickable"
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              setBlockDrill({
                                kind: 'delivery',
                                delivery_date: r.delivery_date,
                                block_key: displayRollupBlockKey(r.block_key),
                                expected_bill_count: r.bill_count,
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setBlockDrill({
                                  kind: 'delivery',
                                  delivery_date: r.delivery_date,
                                  block_key: displayRollupBlockKey(r.block_key),
                                  expected_bill_count: r.bill_count,
                                });
                              }
                            }}
                          >
                            <td>{fmtDate(r.delivery_date)}</td>
                            <td className={displayRollupBlockKey(r.block_key) === 'No block' ? 'vd-block-unknown' : undefined}>
                              {displayRollupBlockKey(r.block_key)}
                            </td>
                            <td className="vd-num">{r.bill_count}</td>
                            <td className="vd-num">{r.item_qty_sum}</td>
                            <td className="vd-num vd-strong">{fmtMoney(r.total)}</td>
                          </tr>
                        )),
                    )}
                  </tbody>
                </table>
              </div>
              {blocksGrouped.length === 0 && <p className="vd-muted">No delivery rows in this range.</p>}
            </>
          ) : (
            <>
              <div className="vd-back-row">
                <button type="button" className="vendor-btn-secondary" onClick={() => setBlockDrill(null)}>
                  ← Back to block summary
                </button>
                <h2 className="vd-panel-title" style={{ margin: 0 }}>
                  {blockDrill.kind === 'billed'
                    ? `${fmtDate(blockDrill.bill_date)} · bill day`
                    : `${fmtDate(blockDrill.delivery_date)} · delivery day`}{' '}
                  ·{' '}
                  <span className={displayRollupBlockKey(blockDrill.block_key) === 'No block' ? 'vd-block-unknown-inline' : undefined}>
                    {displayRollupBlockKey(blockDrill.block_key)}
                  </span>
                </h2>
              </div>
              <p className="vd-panel-desc">
                {blockDrill.kind === 'delivery'
                  ? 'One row per delivered order with a saved bill whose block rolls up to this bucket (newest bill per token in the summary range). Reg no, block, and room show bill values when present; otherwise the linked customer profile.'
                  : 'One row per bill saved on this calendar day (IST) whose block rolls up to this bucket — newest bill per token across the same date range as the summary tables. Reg no, block, and room show bill values when present; otherwise the linked customer profile when an order exists.'}{' '}
                Messy combined fields are split automatically for display.
              </p>
              {blockDetailMeta && !blockDetailLoading && (
                <p className="vd-muted" style={{ marginTop: 8, fontSize: 13 }}>
                  Showing <strong>{blockDetailMeta.rows_matched}</strong> bill{blockDetailMeta.rows_matched === 1 ? '' : 's'}
                  {blockDetailMeta.context === 'delivery' ? (
                    <>
                      {' '}
                      · <strong>{blockDetailMeta.orders_on_day}</strong> delivered order{blockDetailMeta.orders_on_day === 1 ? '' : 's'} that day (IST)
                    </>
                  ) : (
                    <>
                      {' '}
                      · <strong>{blockDetailMeta.orders_on_day}</strong> bill{blockDetailMeta.orders_on_day === 1 ? '' : 's'} on this day in range (latest per token)
                    </>
                  )}
                  {blockDetailMeta.rows_matched !== blockDetailMeta.expected_bill_count ? (
                    <span style={{ color: 'var(--o)', marginLeft: 8 }}>
                      (summary had {blockDetailMeta.expected_bill_count}; refresh the range if this differs after a deploy)
                    </span>
                  ) : null}
                </p>
              )}
              {blockDetailLoading && <p className="vd-muted">Loading…</p>}
              {blockDetailErr && <p style={{ color: 'var(--er)' }}>{blockDetailErr}</p>}
              {!blockDetailLoading && blockDetailRows && (
                <div className="vd-table-wrap">
                  <table className="vd-table" style={{ minWidth: 880 }}>
                    <thead>
                      <tr>
                        <th>Token</th>
                        <th>Order #</th>
                        <th>Name</th>
                        <th>Mobile</th>
                        <th>Reg no</th>
                        <th>Block</th>
                        <th>Room</th>
                        <th className="vd-num">Items</th>
                        <th className="vd-num">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blockDetailRows.map((r) => (
                        <tr key={`${r.token}-${r.order_id || 'x'}`}>
                          <td style={{ fontWeight: 800, color: 'var(--o)' }}>#{r.token}</td>
                          <td>{r.order_number ?? '—'}</td>
                          <td>{r.customer_name}</td>
                          <td>{r.customer_phone}</td>
                          <td>{r.customer_reg_no}</td>
                          <td>{r.customer_hostel_block}</td>
                          <td>{r.customer_room_number}</td>
                          <td className="vd-num">{r.item_qty}</td>
                          <td className="vd-num vd-strong">{fmtMoney(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {blockDetailRows.length === 0 && !blockDetailErr && (
                    <p className="vd-muted" style={{ marginTop: 12 }}>
                      No matching bills for this day and block (e.g. no saved bill, or block text on the bill maps to a different rollup).
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
        </motion.div>
      </AnimatePresence>

      <div className="vd-quicklinks vd-quicklinks-desktop">
        <a href="/admin/vendor" className="vendor-btn-secondary vd-link">
          Create bill
        </a>
        <a href="/admin/bills" className="vendor-btn-secondary vd-link">
          Saved bills
        </a>
        <a href="/admin/pickup" className="vendor-btn-secondary vd-link">
          Pickup / delivery
        </a>
        <a href="/admin/vendor/items" className="vendor-btn-secondary vd-link">
          Items &amp; rates
        </a>
      </div>

      <nav className="vd-dock" aria-label="Quick navigation">
        <a href="/admin/vendor" className="vd-dock-item">
          <Plus size={22} strokeWidth={2.25} className="vd-dock-svg" aria-hidden />
          <span>New bill</span>
        </a>
        <a href="/admin/bills" className="vd-dock-item">
          <ClipboardList size={22} strokeWidth={2.25} className="vd-dock-svg" aria-hidden />
          <span>Bills</span>
        </a>
        <a href="/admin/pickup" className="vd-dock-item">
          <Truck size={22} strokeWidth={2.25} className="vd-dock-svg" aria-hidden />
          <span>Pickup</span>
        </a>
        <a href="/admin/vendor/items" className="vd-dock-item">
          <Tags size={22} strokeWidth={2.25} className="vd-dock-svg" aria-hidden />
          <span>Items</span>
        </a>
      </nav>
    </div>
  );
}
