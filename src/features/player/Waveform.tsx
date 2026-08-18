import { useMemo, useRef } from 'react';
import type { WordTiming } from '@/types';

interface Props {
  timings: WordTiming[];
  duration: number;
  time: number;
  boundaries: number[];
  loopA: number | null;
  loopB: number | null;
  onSeek(t: number): void;
  disabled?: boolean;
}

const BARS = 96;

/**
 * 不解碼音檔，直接用逐詞時間戳合成的節奏條。
 * 目的是讓使用者看見「句子的形狀」以便定位，而不是真實振幅。
 */
export function Waveform({ timings, duration, time, boundaries, loopA, loopB, onSeek, disabled }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const bars = useMemo(() => {
    if (!duration) return new Array<number>(BARS).fill(0.12);
    const out = new Array<number>(BARS).fill(0.1);
    for (const w of timings) {
      const from = Math.floor((w.start / duration) * BARS);
      const to = Math.min(BARS - 1, Math.ceil((w.end / duration) * BARS));
      const weight = Math.min(1, 0.32 + w.word.replace(/\W/g, '').length / 11);
      for (let i = from; i <= to; i++) {
        if (i >= 0 && i < BARS) out[i] = Math.max(out[i], weight);
      }
    }
    return out;
  }, [timings, duration]);

  const seekFrom = (clientX: number) => {
    if (disabled || !ref.current || !duration) return;
    const r = ref.current.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration)));
  };

  const progress = duration ? Math.min(1, time / duration) : 0;

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="音檔進度"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(time)}
      aria-valuetext={`${fmt(time)} / ${fmt(duration)}`}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={e => {
        if (disabled) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(Math.max(0, time - 3)); }
        if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(Math.min(duration, time + 3)); }
      }}
      onPointerDown={e => { if (!disabled) { e.preventDefault(); seekFrom(e.clientX); } }}
      className={`relative h-16 w-full ${disabled ? 'opacity-30' : 'cursor-pointer'}`}
    >
      {/* AB 循環區間 */}
      {loopA !== null && duration > 0 && (
        <div
          className="absolute inset-y-0 bg-accent/12 border-x border-accent/50 pointer-events-none"
          style={{
            left: `${(loopA / duration) * 100}%`,
            width: `${(((loopB ?? time) - loopA) / duration) * 100}%`
          }}
        />
      )}

      <div className="absolute inset-0 flex items-center gap-[2px]">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-[1px] transition-colors duration-75"
            style={{
              height: `${Math.max(8, h * 100)}%`,
              backgroundColor: i / BARS <= progress
                ? 'rgb(var(--c-accent) / 0.85)'
                : 'rgb(var(--c-line))'
            }}
          />
        ))}
      </div>

      {/* 句界線 */}
      {duration > 0 && boundaries.slice(1).map(b => (
        <div
          key={b}
          className="absolute inset-y-1 w-px bg-muted/50 pointer-events-none"
          style={{ left: `${(b / duration) * 100}%` }}
          aria-hidden
        />
      ))}

      {/* 播放頭 */}
      <div
        className="absolute inset-y-0 w-[2px] bg-ink pointer-events-none"
        style={{ left: `${progress * 100}%` }}
        aria-hidden
      />
    </div>
  );
}

export function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00';
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
