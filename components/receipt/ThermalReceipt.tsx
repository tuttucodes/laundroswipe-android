'use client';

import type { ThermalReceiptData } from '@/lib/receipt/thermalReceiptTypes';

const money = (n: number) => `Rs.${(Number.isFinite(n) ? n : 0).toFixed(2)}`;

const THERMAL_STYLES = `
.trc-root{width:280px;max-width:48ch;margin:0 auto;padding:10px 8px 12px;box-sizing:border-box;
  font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
  font-size:12px;line-height:1.35;color:#000;background:#fff}
.trc-root *{box-sizing:border-box}
.trc-printBtn{margin:0 0 10px;padding:8px 14px;font:inherit;cursor:pointer;border:1px solid #333;border-radius:6px;background:#f3f4f6}
.trc-brand{text-align:center;font-weight:700;font-size:13px;letter-spacing:0.06em;margin:0 0 2px}
.trc-sub{text-align:center;margin:0 0 8px;font-weight:500;color:#374151}
.trc-dash{border:none;border-top:1px dashed #9ca3af;margin:8px 0;height:0}
.trc-meta{margin:3px 0;text-align:left;word-break:break-word}
.trc-metaLabel{font-weight:600}
.trc-section{margin:10px 0 6px;font-weight:700;font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#4b5563}
/* Item ~56%, Qty ~10%, Rate ~15%, Amt ~19% (2.5+0.4+0.7+0.85) */
.trc-grid{display:grid;grid-template-columns:2.5fr 0.4fr 0.7fr 0.85fr;gap:6px;align-items:start;width:100%;min-width:0}
.trc-thead{margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid #d1d5db}
.trc-th{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;color:#6b7280;min-width:0}
.trc-thRight{text-align:right}
.trc-row{margin:4px 0;padding:4px 0;border-bottom:1px solid #e5e7eb;min-width:0}
.trc-itemName{
  font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:13.5px;line-height:1.2;min-width:0;
  word-break:break-word;overflow-wrap:break-word;
  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden}
.trc-qty{
  font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:13.5px;line-height:1.2;text-align:right;white-space:nowrap;
  font-variant-numeric:tabular-nums;min-width:0;align-self:start}
.trc-mono{
  font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
  font-variant-numeric:tabular-nums;font-weight:500;font-size:12px;line-height:1.2;text-align:right;white-space:nowrap;
  min-width:0;align-self:start}
.trc-summary{margin-top:10px}
.trc-sumRow{display:flex;justify-content:space-between;gap:8px;margin:3px 0;flex-wrap:nowrap}
.trc-total{margin-top:8px;padding-top:8px;border-top:2px solid #000;font-weight:700;font-size:13px}
.trc-foot{text-align:center;margin-top:12px;font-size:11px;color:#4b5563}
@media print{
  .trc-noPrint{display:none!important}
  .trc-root{width:80mm!important;max-width:80mm!important;margin:0!important;padding:4mm 3mm!important}
  @page{margin:0;size:80mm auto}
}
`;

export type ThermalReceiptProps = {
  data: ThermalReceiptData;
  /** When true, shows a Print button (hidden when printing). */
  showPrintButton?: boolean;
};

export function ThermalReceipt({ data, showPrintButton = false }: ThermalReceiptProps) {
  const brand = (data.brandTitle ?? 'LAUNDROSWIPE').trim();
  const subtitle = (data.subtitle ?? '').trim();
  const amounts = data.items.map((i) => i.qty * i.rate);
  const subtotal = amounts.reduce((s, a) => s + a, 0);
  const discount = Math.max(0, data.discount);
  const serviceFee = Number.isFinite(data.serviceFee) ? data.serviceFee : 0;
  const computedTotal = subtotal - discount + serviceFee;
  const total = data.total != null && Number.isFinite(data.total) ? data.total : computedTotal;
  const totalItems = data.items.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="trc-root">
      <style dangerouslySetInnerHTML={{ __html: THERMAL_STYLES }} />
      {showPrintButton ? (
        <button type="button" className="trc-printBtn trc-noPrint" onClick={() => window.print()}>
          Print
        </button>
      ) : null}
      <header>
        <p className="trc-brand">{brand}</p>
        {subtitle ? <p className="trc-sub">{subtitle}</p> : null}
      </header>
      <hr className="trc-dash" />
      <section>
        <p className="trc-meta">
          <span className="trc-metaLabel">Token:</span> #{data.token}
        </p>
        <p className="trc-meta">
          <span className="trc-metaLabel">Order:</span> {data.orderId}
        </p>
        <p className="trc-meta">
          <span className="trc-metaLabel">Customer ID:</span> {data.customerId}
        </p>
        {data.userEmail ? (
          <p className="trc-meta">
            <span className="trc-metaLabel">Email:</span> {data.userEmail}
          </p>
        ) : null}
      </section>
      <hr className="trc-dash" />
      <section>
        <p className="trc-meta">
          <span className="trc-metaLabel">Customer:</span> {data.customer.name}
        </p>
        <p className="trc-meta">
          <span className="trc-metaLabel">Phone:</span> {data.customer.phone}
        </p>
        {data.customer.regNo ? (
          <p className="trc-meta">
            <span className="trc-metaLabel">Reg no:</span> {data.customer.regNo}
          </p>
        ) : null}
        {data.customer.location ? (
          <p className="trc-meta">
            <span className="trc-metaLabel">Location:</span> {data.customer.location}
          </p>
        ) : null}
        <p className="trc-meta">
          <span className="trc-metaLabel">Date:</span> {data.dateTime}
        </p>
      </section>
      <hr className="trc-dash" />
      <p className="trc-section">Items</p>
      <div aria-label="Line items">
        <div className="trc-grid trc-thead">
          <div className="trc-th">Item</div>
          <div className="trc-th trc-thRight">Qty</div>
          <div className="trc-th trc-thRight">Rate</div>
          <div className="trc-th trc-thRight">Amt</div>
        </div>
        {data.items.map((item, idx) => {
          const amt = item.qty * item.rate;
          return (
            <div className="trc-grid trc-row" key={idx}>
              <div className="trc-itemName" title={item.name}>
                {item.name}
              </div>
              <div className="trc-qty">{item.qty}</div>
              <div className="trc-mono">{money(item.rate)}</div>
              <div className="trc-mono">{money(amt)}</div>
            </div>
          );
        })}
      </div>
      <hr className="trc-dash" />
      <section className="trc-summary">
        <div className="trc-sumRow">
          <span>Total items</span>
          <span>{totalItems}</span>
        </div>
        <div className="trc-sumRow">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        {discount > 0 ? (
          <div className="trc-sumRow">
            <span>Discount</span>
            <span>−{money(discount)}</span>
          </div>
        ) : null}
        <div className="trc-sumRow">
          <span>Service fee</span>
          <span>{money(serviceFee)}</span>
        </div>
        <div className="trc-sumRow trc-total">
          <span>TOTAL</span>
          <span>{money(total)}</span>
        </div>
      </section>
      <p className="trc-foot">{data.footer ?? 'Thank you!'}</p>
    </div>
  );
}
