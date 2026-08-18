import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { hapticTick } from '@/core/haptics/haptics';
import { snapRate, DETENTS, prevDetent, nextDetent, RATE_MIN as MIN, RATE_MAX as MAX } from './snap';

export { DETENTS };

interface Props {
  value: number;
  onChange(v: number): void;
  locked?: boolean;
  lockedReason?: string;
}

export function RateSlider({ value, onChange, locked, lockedReason }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hitDetent, setHitDetent] = useState<number | null>(null);
  const snappedTo = useRef<number | null>(null);
  const [toast, setToast] = useState(false);

  const pct = (v: number) => ((v - MIN) / (MAX - MIN)) * 100;

  const fireDetent = useCallback((d: number) => {
    // 1.0× 是考試真實語速，給加強回饋
    hapticTick(d === 1 ? 'strong' : 'tick');
    setHitDetent(d);
    window.setTimeout(() => setHitDetent(cur => (cur === d ? null : cur)), 240);
  }, []);

  const applyRaw = useCallback((raw: number) => {
    const r = snapRate(raw, snappedTo.current);
    snappedTo.current = r.snappedTo;
    if (r.entered && r.snappedTo !== null) fireDetent(r.snappedTo);
    onChange(r.value);
  }, [onChange, fireDetent]);

  const fromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ratio = (clientX - r.left) / r.width;
    applyRaw(MIN + ratio * (MAX - MIN));
  }, [applyRaw]);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => { e.preventDefault(); fromClientX(e.clientX); };
    const up = () => { setDragging(false); snappedTo.current = null; };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [dragging, fromClientX]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (locked) return;
    const step = e.shiftKey ? 0.01 : null;
    if (e.key === 'ArrowLeft' || e.key === '[') {
      e.preventDefault();
      snappedTo.current = null;
      applyRaw(step ? value - step : prevDetent(value));
    } else if (e.key === 'ArrowRight' || e.key === ']') {
      e.preventDefault();
      snappedTo.current = null;
      applyRaw(step ? value + step : nextDetent(value));
    } else if (e.key === 'Home') { snappedTo.current = null; applyRaw(1); }
  };

  const showToast = () => {
    setToast(true);
    window.setTimeout(() => setToast(false), 2000);
  };

  const isDetent = DETENTS.some(d => Math.abs(d - value) < 0.001);

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="eyebrow">語速</span>
        <span className={clsx(
          'font-mono tabular-nums leading-none',
          isDetent ? 'text-accent' : 'text-muted'
        )} style={{ fontSize: '1.35rem' }}>
          {value.toFixed(2).replace(/0$/, '')}×
        </span>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={locked ? -1 : 0}
        aria-label="播放語速"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={value}
        aria-valuetext={`${value.toFixed(2)} 倍速`}
        aria-disabled={locked}
        onKeyDown={onKeyDown}
        onPointerDown={e => {
          if (locked) { showToast(); return; }
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          setDragging(true);
          snappedTo.current = null;
          fromClientX(e.clientX);
        }}
        className={clsx(
          'relative h-11 touch-none select-none',
          locked ? 'cursor-not-allowed opacity-45' : 'cursor-grab active:cursor-grabbing'
        )}
      >
        {/* 軌道 */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[3px] bg-line rounded-full" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] bg-accent/70 rounded-full"
          style={{ width: `${pct(value)}%` }}
        />

        {/* 刻度：實體感的關鍵視覺 */}
        {DETENTS.map(d => (
          <div
            key={d}
            className={clsx(
              'absolute top-1/2 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full origin-center',
              d === 1 ? 'h-5 bg-accent' : 'h-3 bg-faint',
              hitDetent === d && 'detent-hit'
            )}
            style={{ left: `${pct(d)}%` }}
            aria-hidden
          />
        ))}

        {/* 把手 */}
        <div
          className={clsx(
            'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-raised',
            'transition-[width,height] duration-100',
            isDetent ? 'border-accent' : 'border-muted',
            dragging ? 'w-6 h-6' : 'w-5 h-5'
          )}
          style={{ left: `${pct(value)}%` }}
          aria-hidden
        />

        {locked && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <span className="text-xs text-muted">🔒 1.00×</span>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-0.5 px-0.5" aria-hidden>
        <span className="text-[10px] text-faint font-mono">0.5</span>
        <span className="text-[10px] text-faint font-mono">1.0</span>
        <span className="text-[10px] text-faint font-mono">3.0</span>
      </div>

      {toast && (
        <p className="mt-2 text-xs text-accent reveal" role="status">
          {lockedReason ?? '模考模式維持真實語速'}
        </p>
      )}
    </div>
  );
}
