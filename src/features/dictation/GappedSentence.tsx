import clsx from 'clsx';
import type { Blank } from '@/types';
import type { GradeResult } from '@/core/grading/grade';

interface Props {
  transcript: string;
  blanks: Blank[];
  answers: Record<string, string>;
  results: Record<string, GradeResult>;
  activeBlankId: string;
  hintLevels: Record<string, 0 | 1 | 2 | 3>;
  onChange(blankId: string, v: string): void;
  onFocus(blankId: string): void;
  onSubmit(): void;
  submitted: boolean;
}

/**
 * 依 Blank.charStart / charEnd 把句子切成「文字段 + 輸入框」交錯序列。
 * 定位靠建題時算好的區間，不靠執行期字串搜尋 —— 後者在答案形式與原文
 * 說法不同時（250 vs two hundred and fifty）會定位失敗，整句挖不出空格。
 */
export function GappedSentence(p: Props) {
  const gaps = [...p.blanks]
    .filter(b => b.id !== 'full')
    .sort((a, b) => a.charStart - b.charStart);

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  gaps.forEach((b, i) => {
    if (b.charStart > cursor) {
      parts.push(<span key={`t${i}`}>{p.transcript.slice(cursor, b.charStart)}</span>);
    }

    const res = p.results[b.id];
    const value = p.answers[b.id] ?? '';
    const hint = p.hintLevels[b.id] ?? 0;
    const words = value.trim() ? value.trim().split(/\s+/).length : 0;
    const over = words > b.maxWords;

    parts.push(
      <span key={b.id} className="inline-flex flex-col align-baseline mx-0.5">
        <span className="inline-flex items-baseline gap-1">
          <span className="text-[10px] text-faint font-mono select-none" aria-hidden>
            {i + 1}
          </span>
          <input
            type="text"
            value={value}
            disabled={p.submitted}
            onChange={e => p.onChange(b.id, e.target.value)}
            onFocus={() => p.onFocus(b.id)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); p.onSubmit(); }
            }}
            aria-label={`第 ${i + 1} 個空格，最多 ${b.maxWords} 個字`}
            aria-invalid={over || (!!res && !res.isCorrect)}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            style={{ width: `${Math.max(7, b.surface.length * 0.85)}ch` }}
            className={clsx(
              'bg-transparent border-b-2 font-mono text-center outline-none px-1 py-0.5',
              'text-[15px] transition-colors',
              res
                ? res.isCorrect ? 'border-ok text-ok' : 'border-bad text-bad'
                : over ? 'border-bad'
                : p.activeBlankId === b.id ? 'border-accent' : 'border-line focus:border-accent',
              hint > 0 && !res && 'bg-hint/10'
            )}
          />
        </span>

        {res && !res.isCorrect && (
          <span className="text-[11px] font-mono text-ok text-center mt-0.5 reveal">
            {b.answers[0]}
          </span>
        )}
        {!p.submitted && b.maxWords > 1 && (
          <span className={clsx('text-[10px] text-center', over ? 'text-bad' : 'text-faint')}>
            ≤{b.maxWords} 字
          </span>
        )}
      </span>
    );

    cursor = b.charEnd;
  });

  if (cursor < p.transcript.length) {
    parts.push(<span key="tail">{p.transcript.slice(cursor)}</span>);
  }

  return <p className="font-mono text-[15px] leading-[2.6]">{parts}</p>;
}
