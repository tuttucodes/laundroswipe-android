'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2, Check } from 'lucide-react';

const HOLD_DURATION_MS = 1600;
const RING_SIZE = 72;
const RING_STROKE = 4;
const R = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

export type HoldToConfirmProps = {
  onConfirm: () => void;
  disabled?: boolean;
  placing?: boolean;
  labelHold?: string;
  labelKeep?: string;
  labelPlacing?: string;
  labelConfirmed?: string;
  durationMs?: number;
  className?: string;
};

const defaults = {
  labelHold: 'Hold to confirm order',
  labelKeep: 'Keep holding…',
  labelPlacing: 'Placing…',
  labelConfirmed: 'Confirmed!',
};

export function HoldToConfirm({
  onConfirm,
  disabled = false,
  placing = false,
  labelHold = defaults.labelHold,
  labelKeep = defaults.labelKeep,
  labelPlacing = defaults.labelPlacing,
  labelConfirmed = defaults.labelConfirmed,
  durationMs = HOLD_DURATION_MS,
  className = '',
}: HoldToConfirmProps) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [success, setSuccess] = useState(false);

  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  const vibrate = useCallback((ms: number) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
  }, []);

  const cancelHold = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsHolding(false);
    setProgress(0);
  }, []);

  const tick = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    const p = Math.min(100, (elapsed / durationMs) * 100);
    setProgress(p);
    if (p >= 100) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setIsHolding(false);
      setSuccess(true);
      vibrate(15);
      window.setTimeout(() => {
        onConfirmRef.current();
        setProgress(0);
        setSuccess(false);
      }, 320);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [durationMs, vibrate]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || placing || success) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      startTimeRef.current = Date.now();
      setIsHolding(true);
      setProgress(0);
      vibrate(8);
      rafRef.current = requestAnimationFrame(tick);
    },
    [disabled, placing, success, vibrate, tick]
  );

  const handlePointerUp = useCallback(() => {
    cancelHold();
  }, [cancelHold]);

  const handlePointerLeave = useCallback(() => {
    cancelHold();
  }, [cancelHold]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const isDisabled = disabled || placing;
  const label = placing
    ? labelPlacing
    : success
      ? labelConfirmed
      : isHolding
        ? labelKeep
        : labelHold;

  const dashOffset = CIRCUMFERENCE * (1 - progress / 100);

  return (
    <div className={`hold-wrap ${className}`.trim()}>
      <button
        type="button"
        className={`hold-btn${isHolding ? ' holding' : ''}${success ? ' success' : ''}${isDisabled ? ' disabled' : ''}`}
        disabled={isDisabled}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        aria-label={label}
        aria-busy={placing}
      >
        <span className="hold-ring" aria-hidden>
          <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
            <circle
              className="hold-ring-bg"
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={R}
              fill="none"
              strokeWidth={RING_STROKE}
            />
            <circle
              className="hold-ring-fill"
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={R}
              fill="none"
              strokeWidth={RING_STROKE}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </svg>
        </span>
        <span className="hold-content">
          {placing ? (
            <Loader2 className="hold-spinner" size={22} strokeWidth={2.5} aria-hidden />
          ) : success ? (
            <Check className="hold-check" size={26} strokeWidth={2.5} aria-hidden />
          ) : (
            label
          )}
        </span>
      </button>
    </div>
  );
}
