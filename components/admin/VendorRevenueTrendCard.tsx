'use client';

import { useMemo } from 'react';

type ByDateTotal = { date: string; total: number };

function mergeDailyTotals(billed: ByDateTotal[], collected: ByDateTotal[]) {
  const map = new Map<string, { billed: number; collected: number }>();
  for (const r of billed) {
    const cur = map.get(r.date) ?? { billed: 0, collected: 0 };
    cur.billed = r.total;
    map.set(r.date, cur);
  }
  for (const r of collected) {
    const cur = map.get(r.date) ?? { billed: 0, collected: 0 };
    cur.collected = r.total;
    map.set(r.date, cur);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, billed: v.billed, collected: v.collected }));
}

function RevenueStrip({
  billedByDate,
  collectedByDate,
  formatDayLabel,
  formatMoney,
  stripLabel,
  scrollable,
}: {
  billedByDate: ByDateTotal[];
  collectedByDate: ByDateTotal[];
  formatDayLabel: (iso: string) => string;
  formatMoney: (n: number) => string;
  stripLabel: string;
  scrollable: boolean;
}) {
  const days = useMemo(
    () => mergeDailyTotals(billedByDate, collectedByDate),
    [billedByDate, collectedByDate],
  );

  const maxVal = useMemo(() => {
    let m = 1;
    for (const d of days) {
      m = Math.max(m, d.billed, d.collected);
    }
    return m;
  }, [days]);

  const minW = scrollable ? Math.max(days.length * 26, 320) : undefined;

  return (
    <div className="vd-rev-strip">
      <h3 className="vd-rev-strip-title">{stripLabel}</h3>
      <div className={scrollable ? 'vd-rev-chart-scroll' : undefined}>
        <div
          className={`vd-rev-chart-cols${scrollable ? ' vd-rev-chart-cols--scroll' : ''}`}
          style={minW ? { minWidth: minW } : undefined}
          role="presentation"
        >
          {days.map((d) => {
            const pctB = maxVal > 0 ? (d.billed / maxVal) * 100 : 0;
            const pctC = maxVal > 0 ? (d.collected / maxVal) * 100 : 0;
            return (
              <div key={d.date} className="vd-rev-chart-col">
                <div className="vd-rev-chart-bars">
                  <div className="vd-rev-bar-slot">
                    <div
                      className="vd-rev-bar vd-rev-bar-billed"
                      style={{ height: `${pctB}%` }}
                      title={`Bills generated ${formatDayLabel(d.date)}: ${formatMoney(d.billed)}`}
                    />
                  </div>
                  <div className="vd-rev-bar-slot">
                    <div
                      className="vd-rev-bar vd-rev-bar-delivered"
                      style={{ height: `${pctC}%` }}
                      title={`Delivery day ${formatDayLabel(d.date)}: ${formatMoney(d.collected)}`}
                    />
                  </div>
                </div>
                <span className="vd-rev-chart-xlab">{formatDayLabel(d.date)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function VendorRevenueTrendCard({
  billed7,
  collected7,
  billed30,
  collected30,
  formatDayLabel,
  formatMoney,
}: {
  billed7: ByDateTotal[];
  collected7: ByDateTotal[];
  billed30: ByDateTotal[];
  collected30: ByDateTotal[];
  formatDayLabel: (iso: string) => string;
  formatMoney: (n: number) => string;
}) {
  return (
    <div className="vendor-card vd-panel vd-panel-highlight vd-rev-trend-card">
      <h2 className="vd-panel-title">Daily revenue trend</h2>
      <p className="vd-panel-desc">
        Each pair of bars is one calendar day (India): <strong>bills generated</strong> (when the bill was saved) vs{' '}
        <strong>delivery day</strong> (when the order was marked delivered). Hover a bar for exact amounts.
      </p>
      <div className="vd-rev-chart-legend" aria-hidden="true">
        <span className="vd-rev-chart-legend-i">
          <span className="vd-rev-legend-swatch vd-rev-legend-billed" />
          Bills generated
        </span>
        <span className="vd-rev-chart-legend-i">
          <span className="vd-rev-legend-swatch vd-rev-legend-delivered" />
          Delivery day
        </span>
      </div>
      <RevenueStrip
        billedByDate={billed7}
        collectedByDate={collected7}
        formatDayLabel={formatDayLabel}
        formatMoney={formatMoney}
        stripLabel="Last 7 days"
        scrollable={false}
      />
      <RevenueStrip
        billedByDate={billed30}
        collectedByDate={collected30}
        formatDayLabel={formatDayLabel}
        formatMoney={formatMoney}
        stripLabel="Last 30 days"
        scrollable
      />
      <p className="vd-muted small" style={{ marginTop: 10, marginBottom: 0 }}>
        On narrow screens, swipe the 30-day chart horizontally to see every day.
      </p>
    </div>
  );
}
