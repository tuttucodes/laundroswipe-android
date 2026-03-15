'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronRight, Check } from 'lucide-react';

const THRESHOLD = 80;

export type SwipeToConfirmProps = {
  onConfirm: () => void;
  disabled?: boolean;
  placing?: boolean;
  labelSwipe?: string;
  labelAlmost?: string;
  labelRelease?: string;
  labelConfirmed?: string;
  labelPlacing?: string;
  className?: string;
};

const defaultLabels = {
  labelSwipe: 'Swipe to confirm',
  labelAlmost: 'Almost there…',
  labelRelease: 'Release to confirm',
  labelConfirmed: 'Confirmed!',
  labelPlacing: 'Placing…',
};

export function SwipeToConfirm({
  onConfirm,
  disabled = false,
  placing = false,
  labelSwipe = defaultLabels.labelSwipe,
  labelAlmost = defaultLabels.labelAlmost,
  labelRelease = defaultLabels.labelRelease,
  labelConfirmed = defaultLabels.labelConfirmed,
  labelPlacing = defaultLabels.labelPlacing,
  className = '',
}: SwipeToConfirmProps) {
  const [progress, setProgress] = useState(0);
  const [atThreshold, setAtThreshold] = useState(false);
  const [success, setSuccess] = useState(false);
  const [animating, setAnimating] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ left: number; width: number } | null>(null);
  const progressRef = useRef(0);
  const reached80Ref = useRef(false);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  const vibrate = useCallback((ms: number) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
  }, []);

  const handleEnd = useCallback(() => {
    const p = progressRef.current;
    startRef.current = null;
    if (p >= THRESHOLD) {
      setSuccess(true);
      setProgress(100);
      progressRef.current = 100;
      vibrate(15);
      window.setTimeout(() => {
        onConfirmRef.current();
        setProgress(0);
        progressRef.current = 0;
        setSuccess(false);
      }, 320);
      return;
    }
    setAnimating(true);
    setProgress(0);
    progressRef.current = 0;
    window.setTimeout(() => setAnimating(false), 280);
  }, [vibrate]);

  const handleStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (disabled || placing) return;
      if ('touches' in e) e.preventDefault();
      e.stopPropagation();
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      startRef.current = { left: rect.left, width: rect.width };
      reached80Ref.current = false;
      setSuccess(false);
      setAtThreshold(false);
      setAnimating(false);
      setProgress(0);
      progressRef.current = 0;
    },
    [disabled, placing]
  );

  const handleMove = useCallback(
    (clientX: number) => {
      const start = startRef.current;
      if (!start) return;
      const raw = Math.max(0, Math.min(100, ((clientX - start.left) / start.width) * 100));
      if (raw >= THRESHOLD && !reached80Ref.current) {
        reached80Ref.current = true;
        setAtThreshold(true);
        vibrate(10);
      }
      progressRef.current = raw;
      setProgress(raw);
    },
    [vibrate]
  );

  // Mouse: window listeners so drag works when cursor leaves track
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (startRef.current) handleMove(e.clientX);
    };
    const onMouseUp = () => {
      if (startRef.current) handleEnd();
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [handleMove, handleEnd]);

  // Touch: on track only, non-passive so we can preventDefault
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onTouchMove = (e: TouchEvent) => {
      if (startRef.current) {
        e.preventDefault();
        handleMove(e.touches[0].clientX);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (startRef.current) {
        e.preventDefault();
        handleEnd();
      }
    };
    track.addEventListener('touchmove', onTouchMove, { passive: false });
    track.addEventListener('touchend', onTouchEnd, { passive: false });
    track.addEventListener('touchcancel', onTouchEnd, { passive: false });
    return () => {
      track.removeEventListener('touchmove', onTouchMove);
      track.removeEventListener('touchend', onTouchEnd);
      track.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [handleMove, handleEnd]);

  const isDisabled = disabled || placing;
  const label =
    placing
      ? labelPlacing
      : success
        ? labelConfirmed
        : progress >= THRESHOLD
          ? labelRelease
          : progress >= 40
            ? labelAlmost
            : labelSwipe;

  return (
    <div
      className={`swipe-wrap ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div
        ref={trackRef}
        role="slider"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        aria-disabled={isDisabled}
        className={`swipe-track${animating ? ' animating' : ''}${success ? ' success' : ''}${isDisabled ? ' disabled' : ''}`}
        onTouchStart={handleStart}
        onMouseDown={handleStart}
      >
        <div className="swipe-target-zone" aria-hidden />
        <div className="swipe-fill" style={{ width: `${progress}%` }} />
        <div
          className={`swipe-thumb${atThreshold && !success ? ' at-threshold' : ''}`}
          style={{
            left: `calc(24px + (100% - 48px) * ${progress / 100})`,
            transform: `translateX(-50%) translateZ(12px) scale(${progress >= THRESHOLD ? 1.08 : 1})`,
            boxShadow:
              progress >= THRESHOLD
                ? '0 8px 24px rgba(23,70,162,.35), 0 2px 8px rgba(0,0,0,.15)'
                : `0 ${4 + (progress / 100) * 8}px ${12 + (progress / 100) * 16}px rgba(0,0,0,${0.15 + (progress / 100) * 0.1})`,
          }}
        >
          {success || progress >= THRESHOLD ? (
            <Check className="swipe-icon" size={24} strokeWidth={2.5} />
          ) : (
            <ChevronRight className="swipe-icon" size={26} strokeWidth={2.5} />
          )}
        </div>
        <span className="swipe-label">{label}</span>
      </div>
    </div>
  );
}
