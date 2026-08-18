import { useState } from 'react';
import clsx from 'clsx';
import type { Blank, HintLevel } from '@/types';

interface Props {
  blank: Blank;
  level: HintLevel;
  onUse(level: HintLevel): void;
  disabled?: boolean;
  /** 多空格模式下標示目前提示的是哪一格 */
  label?: string;
}

function structureHint(answer: string): string {
  const words = answer.trim().split(/\s+/);
  return `${words.length} 個字，字母數 ${words.map(w => w.replace(/\W/g, '').length).join(' + ')}`;
}

function firstLetterHint(answer: string): string {
  return answer.trim().split(/\s+/)
    .map(w => w[0] + '_'.repeat(Math.max(0, w.replace(/\W/g, '').length - 1)))
    .join('  ');
}

export function HintPanel({ blank, level, onUse, disabled, label }: Props) {
  const [confirming, setConfirming] = useState(false);
  const answer = blank.answers[0] ?? '';

  return (
    <div className="card p-3">
      <p className="eyebrow mb-2">
        提示（會扣分）{label && <span className="text-accent normal-case tracking-normal">・{label}</span>}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          className={clsx('btn-ghost text-sm', level >= 1 && 'border-hint text-hint')}
          onClick={() => onUse(1)}
          disabled={disabled || level >= 1}
        >
          縮小範圍 −25%
        </button>
        <button
          className={clsx('btn-ghost text-sm', level >= 2 && 'border-hint text-hint')}
          onClick={() => onUse(2)}
          disabled={disabled || level >= 2}
        >
          首字母 −50%
        </button>
        <button
          className={clsx('btn-ghost text-sm', level >= 3 ? 'border-bad text-bad' : 'text-bad border-bad/40')}
          onClick={() => setConfirming(true)}
          disabled={disabled || level >= 3}
        >
          公布解答 −100%
        </button>
      </div>

      {level >= 1 && (
        <p className="mt-3 font-mono text-sm text-hint reveal">{structureHint(answer)}</p>
      )}
      {level >= 2 && (
        <p className="mt-1.5 font-mono text-lg tracking-[0.2em] text-hint reveal">
          {firstLetterHint(answer)}
        </p>
      )}
      {level >= 3 && (
        <div className="mt-3 p-2.5 rounded-md bg-bad/10 border border-bad/40 reveal">
          <p className="font-mono text-lg text-ink">{answer}</p>
          <p className="mt-1 text-xs text-muted">
            本題計 0 分，已排入明天的複習。仍建議親手打一次，拼字靠肌肉記憶。
          </p>
        </div>
      )}

      {confirming && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="確認公布解答"
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setConfirming(false)}
        >
          <div className="card p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">公布解答？</h3>
            <p className="text-sm text-muted leading-relaxed">
              本題會計 0 分，並強制排入明天的複習佇列。先試試首字母提示通常更有效。
            </p>
            <div className="flex gap-2 mt-4">
              <button
                className="btn-ghost flex-1"
                onClick={() => { setConfirming(false); onUse(2); }}
              >
                先試首字母
              </button>
              <button
                className="btn-danger flex-1"
                onClick={() => { setConfirming(false); onUse(3); }}
              >
                仍要公布
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
