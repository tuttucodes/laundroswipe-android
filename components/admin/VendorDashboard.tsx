'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type VendorDashboardMetrics = {
  revenue_7d: { total: number; bill_count: number; by_date: { date: string; bill_count: number; total: number }[] };
  revenue_30d: { total: number; bill_count: number; by_date: { date: string; bill_count: number; total: number }[] };
  collected_7d: {
    total: number;
    bill_count: number;
    item_qty_sum: number;
    subtotal: number;
    convenience_fee: number;
    by_date: Array<{
      date: string;
      bill_count: number;
      item_qty_sum: number;
      subtotal: number;
      convenience_fee: number;
      total: number;
    }>;
  };
  collected_30d: {
    total: number;
    bill_count: number;
    item_qty_sum: number;
    subtotal: number;
    convenience_fee: number;
    by_date: Array<{
      date: string;
      bill_count: number;
      item_qty_sum: number;
      subtotal: number;
      convenience_fee: number;
      total: number;
    }>;
  };
  collected_by_block: Array<{
    delivery_date: string;
    block_key: string;
    bill_count: number;
    item_qty_sum: number;
    subtotal: number;
    convenience_fee: number;
    total: number;
  }>;
  open_tokens: { count: number; by_status: Record<string, number> };
  delivered_7d: { count: number; by_date: { date: string; count: number }[] };
  delivered_30d: { count: number; by_date: { date: string; count: number }[] };
};

type Section = 'overview' | 'delivered' | 'revenue' | 'blocks';

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

type Props = {
  onGoOrders: (filter: string) => void;
  onUnauthorized: () => void;
};

export function VendorDashboard({ onGoOrders, onUnauthorized }: Props) {
  const [section, setSection] = useState<Section>('overview');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<VendorDashboardMetrics | null>(null);
  const [blockFrom, setBlockFrom] = useState('');
  const [blockTo, setBlockTo] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);

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
        return null;
      }
      const d = await r.json().catch(() => null);
      if (!d?.ok) return null;
      const { ok: _ok, ...rest } = d as { ok: boolean } & VendorDashboardMetrics;
      return rest;
    },
    [onUnauthorized],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadDashboard()
      .then((d) => {
        if (!cancelled && d) setMetrics(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadDashboard]);

  const applyBlockRange = async () => {
    if (!blockFrom || !blockTo) return;
    setBlockLoading(true);
    const d = await loadDashboard({ block_from: blockFrom, block_to: blockTo });
    if (d) setMetrics(d);
    setBlockLoading(false);
  };

  const resetBlockRange = async () => {
    setBlockFrom('');
    setBlockTo('');
    setBlockLoading(true);
    const d = await loadDashboard();
    if (d) setMetrics(d);
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

  const navBtn = (id: Section, label: string) => (
    <button
      key={id}
      type="button"
      className={`vd-nav-btn ${section === id ? 'vd-nav-btn-active' : ''}`}
      onClick={() => setSection(id)}
    >
      {label}
    </button>
  );

  if (loading && !metrics) {
    return (
      <div className="vd-root">
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
    return <p style={{ color: 'var(--ts)' }}>Could not load dashboard.</p>;
  }

  return (
    <div className="vd-root">
      <header className="vd-header">
        <h1 className="vd-title">Dashboard</h1>
        <p className="vd-sub">Revenue is counted on <strong>delivery day</strong> (when payment is collected). Bill date is separate.</p>
      </header>

      <div className="vd-nav" role="tablist" aria-label="Dashboard sections">
        {navBtn('overview', 'Overview')}
        {navBtn('delivered', 'Delivered')}
        {navBtn('revenue', 'Revenue')}
        {navBtn('blocks', 'By block')}
      </div>

      {section === 'overview' && (
        <div className="vd-grid-cards">
          <button type="button" className="vd-card vd-card-green" onClick={() => setSection('revenue')}>
            <span className="vd-card-icon">📈</span>
            <span className="vd-card-label">Collected (7 days)</span>
            <span className="vd-card-value">{fmtMoney(metrics.collected_7d.total)}</span>
            <span className="vd-card-meta">
              {metrics.collected_7d.bill_count} bills · {metrics.collected_7d.item_qty_sum} items
            </span>
            <span className="vd-card-hint">View daily breakdown →</span>
          </button>
          <button type="button" className="vd-card vd-card-blue" onClick={() => setSection('revenue')}>
            <span className="vd-card-icon">💰</span>
            <span className="vd-card-label">Collected (30 days)</span>
            <span className="vd-card-value">{fmtMoney(metrics.collected_30d.total)}</span>
            <span className="vd-card-meta">
              {metrics.collected_30d.bill_count} bills · {metrics.collected_30d.item_qty_sum} items
            </span>
            <span className="vd-card-hint">View daily breakdown →</span>
          </button>
          <button type="button" className="vd-card vd-card-amber" onClick={() => setSection('delivered')}>
            <span className="vd-card-icon">🎫</span>
            <span className="vd-card-label">Open tokens</span>
            <span className="vd-card-value">{metrics.open_tokens.count}</span>
            <span className="vd-card-meta">Not yet delivered</span>
            <span className="vd-card-hint">Orders pipeline →</span>
          </button>
          <button type="button" className="vd-card vd-card-violet" onClick={() => setSection('delivered')}>
            <span className="vd-card-icon">✅</span>
            <span className="vd-card-label">Delivered orders (7d)</span>
            <span className="vd-card-value">{metrics.delivered_7d.count}</span>
            <span className="vd-card-meta">All statuses cleared · last week</span>
            <span className="vd-card-hint">Daily orders →</span>
          </button>
        </div>
      )}

      {section === 'delivered' && (
        <div className="vendor-card vd-panel">
          <h2 className="vd-panel-title">Delivered orders vs collected bills</h2>
          <p className="vd-panel-desc">
            <strong>Orders delivered</strong> counts every completed delivery. <strong>Collected</strong> rows only include days where a saved bill was linked to that delivery.
          </p>
          <div className="vd-table-wrap">
            <table className="vd-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="vd-num">Orders delivered</th>
                  <th className="vd-num">Bills (collected)</th>
                  <th className="vd-num">Items (qty)</th>
                  <th className="vd-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...metrics.collected_30d.by_date].reverse().map((row) => {
                  const od = metrics.delivered_30d.by_date.find((x) => x.date === row.date)?.count ?? 0;
                  return (
                    <tr key={row.date}>
                      <td>{fmtDate(row.date)}</td>
                      <td className="vd-num">{od}</td>
                      <td className="vd-num">{row.bill_count}</td>
                      <td className="vd-num">{row.item_qty_sum}</td>
                      <td className="vd-num vd-strong">{fmtMoney(row.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="vd-actions">
            <button type="button" className="vendor-btn-primary" onClick={() => onGoOrders('all')}>
              All orders
            </button>
            <button type="button" className="vendor-btn-secondary" onClick={() => onGoOrders('delivered')}>
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
                  <button key={s} type="button" className="vd-chip" onClick={() => onGoOrders(s)}>
                    <span className="vd-chip-n">{count}</span>
                    <span>{STATUS_LABELS_MAP[s] ?? s}</span>
                  </button>
                );
              })}
            </div>
          </details>
        </div>
      )}

      {section === 'revenue' && (
        <div className="vd-stack">
          <div className="vendor-card vd-panel">
            <h2 className="vd-panel-title">Last 7 days (by delivery date)</h2>
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
          <div className="vendor-card vd-panel">
            <h2 className="vd-panel-title">Last 30 days (by delivery date)</h2>
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
            <summary>Bill created date (legacy, not delivery)</summary>
            <p className="vd-muted small">
              For reference: totals when bills were <em>saved</em> — 7d {fmtMoney(metrics.revenue_7d.total)} ({metrics.revenue_7d.bill_count} bills) · 30d{' '}
              {fmtMoney(metrics.revenue_30d.total)} ({metrics.revenue_30d.bill_count} bills)
            </p>
          </details>
        </div>
      )}

      {section === 'blocks' && (
        <div className="vendor-card vd-panel">
          <h2 className="vd-panel-title">Hostel block × delivery date</h2>
          <p className="vd-panel-desc">Uses <code>customer_hostel_block</code> from the bill. Empty values appear as <strong>No block</strong>. Blocks are normalized (e.g. A and a → A).</p>
          <div className="vd-filter-row">
            <label className="vd-field">
              <span>From</span>
              <input type="date" className="fi" value={blockFrom} onChange={(e) => setBlockFrom(e.target.value)} />
            </label>
            <label className="vd-field">
              <span>To</span>
              <input type="date" className="fi" value={blockTo} onChange={(e) => setBlockTo(e.target.value)} />
            </label>
            <button type="button" className="vendor-btn-primary" disabled={blockLoading || !blockFrom || !blockTo} onClick={() => void applyBlockRange()}>
              {blockLoading ? 'Loading…' : 'Apply'}
            </button>
            <button type="button" className="vendor-btn-secondary" disabled={blockLoading} onClick={() => void resetBlockRange()}>
              Reset (30d)
            </button>
          </div>
          <div className="vd-table-wrap">
            <table className="vd-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Block</th>
                  <th className="vd-num">Bills</th>
                  <th className="vd-num">Items</th>
                  <th className="vd-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {blocksGrouped.flatMap(([date, rows]) =>
                  rows
                    .sort((a, b) => a.block_key.localeCompare(b.block_key))
                    .map((r) => (
                      <tr key={`${date}-${r.block_key}`}>
                        <td>{fmtDate(r.delivery_date)}</td>
                        <td>{r.block_key}</td>
                        <td className="vd-num">{r.bill_count}</td>
                        <td className="vd-num">{r.item_qty_sum}</td>
                        <td className="vd-num vd-strong">{fmtMoney(r.total)}</td>
                      </tr>
                    )),
                )}
              </tbody>
            </table>
          </div>
          {blocksGrouped.length === 0 && <p className="vd-muted">No rows in this range.</p>}
        </div>
      )}

      <div className="vd-quicklinks">
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
    </div>
  );
}
