import { useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { Waveform, fmt } from './Waveform';
import { RateSlider } from './RateSlider';
import type { PlaybackApi } from '@/core/audio/usePlayback';
import { ACCENT_FLAG, ACCENT_LABEL, type Accent } from '@/types';

interface Props {
  pb: PlaybackApi;
  accent: Accent;
  /** 模考模式：隱藏波形、鎖語速、禁止 seek 與 AB 循環（規格 §7.1 / §7.2） */
  exam?: boolean;
  compact?: boolean;
}

export function AudioPlayer({ pb, accent, exam = false, compact = false }: Props) {
  const canSeek = pb.supportsSeek && !exam;

  const boundaries = useMemo(() => {
    const b = [0];
    pb.timings.forEach((w, i) => {
      if (/[.!?]$/.test(w.word) && i < pb.timings.length - 1) b.push(pb.timings[i + 1].start);
    });
    return b;
  }, [pb.timings]);

  // 鍵盤快捷鍵（規格 §7.1）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;

      // 焦點在輸入框時，Space 要能打空格 → 改用 Cmd/Ctrl+Space
      if (e.code === 'Space' && (!typing || mod)) { e.preventDefault(); pb.toggle(); return; }
      if (e.key.toLowerCase() === 'r' && (mod || !typing)) { e.preventDefault(); pb.replaySentence(); return; }
      if (!canSeek) return;
      if (e.key === 'ArrowLeft' && (mod || !typing)) {
        e.preventDefault();
        e.shiftKey ? pb.nudge(-3) : pb.prevSentence();
      }
      if (e.key === 'ArrowRight' && (mod || !typing)) {
        e.preventDefault();
        e.shiftKey ? pb.nudge(3) : pb.nextSentence();
      }
      if (e.key.toLowerCase() === 'l' && (mod || !typing)) { e.preventDefault(); pb.cycleLoop(); }
      if (e.key === '[' && !typing) { e.preventDefault(); pb.setRate(Math.max(0.5, pb.rate - 0.25)); }
      if (e.key === ']' && !typing) { e.preventDefault(); pb.setRate(Math.min(3, pb.rate + 0.25)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pb, canSeek]);

  const loopState = pb.loopA === null ? 'off' : pb.loopB === null ? 'half' : 'on';

  return (
    <div className={clsx('card p-4', compact && 'p-3')}>
      <div className="flex items-center justify-between mb-2">
        <span className="eyebrow flex items-center gap-1.5">
          {ACCENT_FLAG[accent]} {ACCENT_LABEL[accent]}
          {pb.degraded && (
            <span className="ml-1 px-1.5 py-0.5 rounded-xs bg-hint/20 text-hint normal-case tracking-normal">
              即時語音・品質較低
            </span>
          )}
        </span>
        <span className="font-mono text-xs text-muted tabular-nums">
          {exam ? `剩餘 ${fmt(Math.max(0, pb.duration - pb.time))}` : `${fmt(pb.time)} / ${fmt(pb.duration)}`}
        </span>
      </div>

      {!exam && !pb.degraded && (
        <Waveform
          timings={pb.timings}
          duration={pb.duration}
          time={pb.time}
          boundaries={boundaries}
          loopA={pb.loopA}
          loopB={pb.loopB}
          onSeek={pb.seek}
          disabled={!canSeek}
        />
      )}

      {pb.error && (
        <div className="my-2 p-2.5 rounded-md border border-bad/50 bg-bad/10 text-sm">
          <p className="text-bad">{pb.error}</p>
          <p className="text-muted text-xs mt-1">
            檢查 public/audio 下是否已生成 MP3，或執行 npm run audio。
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <button
          className="btn-primary flex-1 text-base"
          onClick={pb.toggle}
          disabled={!pb.ready && !pb.error}
          aria-label={pb.playing ? '暫停' : '播放'}
        >
          {pb.playing ? '❚❚ 暫停' : '▶ 播放'}
        </button>

        <button className="btn-ghost" onClick={pb.replaySentence} aria-label="重播本句" title="重播本句 (R)">
          ↻
        </button>

        {canSeek && (
          <>
            <button className="btn-ghost" onClick={pb.prevSentence} aria-label="上一句" title="上一句 (←)">↤</button>
            <button className="btn-ghost" onClick={pb.nextSentence} aria-label="下一句" title="下一句 (→)">↦</button>
            <button
              className={clsx('btn-ghost', loopState !== 'off' && 'border-accent text-accent')}
              onClick={pb.cycleLoop}
              aria-label="AB 循環"
              aria-pressed={loopState === 'on'}
              title="AB 循環 (L)"
            >
              {loopState === 'half' ? 'A·' : 'A-B'}
            </button>
          </>
        )}
      </div>

      {pb.replayCount > 0 && (
        <p className="mt-2 text-xs text-muted" role="status">
          已重播 {pb.replayCount} 次
          {pb.replayCount <= 2
            ? '（前 2 次不扣分）'
            : `　扣分 ${Math.round((1 - Math.max(0.5, 1 - 0.1 * (pb.replayCount - 2))) * 100)}%`}
        </p>
      )}

      <div className="mt-4">
        <RateSlider
          value={exam ? 1 : pb.rate}
          onChange={pb.setRate}
          locked={exam || pb.degraded}
          lockedReason={exam ? '模考模式維持真實語速' : '即時語音不支援連續調速，請先生成音檔'}
        />
      </div>
    </div>
  );
}
