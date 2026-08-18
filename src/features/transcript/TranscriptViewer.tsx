import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { ExerciseItem, WordTiming } from '@/types';
import type { DiffCell } from '@/core/grading/diff';

interface Props {
  item: ExerciseItem;
  timings: WordTiming[];
  activeWord: number;
  onSeek(t: number): void;
  onAddVocab(word: string): void;
  diff?: DiffCell[] | null;
  savedWords: Set<string>;
}

/** 規格 §7.6：卡拉 OK 高亮、點詞查生字、跳播 */
export function TranscriptViewer({
  item, timings, activeWord, onSeek, onAddVocab, diff, savedWords
}: Props) {
  const [picked, setPicked] = useState<{ word: string; index: number } | null>(null);

  const answerWords = useMemo(() => {
    const set = new Set<string>();
    for (const b of item.blanks) {
      if (b.id === 'full') continue;
      for (const a of b.answers) a.toLowerCase().split(/\s+/).forEach(w => set.add(w));
    }
    return set;
  }, [item.blanks]);

  const clean = (w: string) => w.replace(/[^A-Za-z'-]/g, '');

  return (
    <div className="card p-4">
      <p className="eyebrow mb-2">逐字稿</p>

      <p className="font-mono leading-[2] text-[15px]">
        {timings.map((w, i) => {
          const c = clean(w.word).toLowerCase();
          const isAnswer = answerWords.has(c);
          return (
            <button
              key={i}
              onClick={() => { setPicked({ word: clean(w.word), index: i }); onSeek(Math.max(0, w.start - 0.15)); }}
              className={clsx(
                'rounded-xs px-[2px] transition-colors',
                i === activeWord && 'bg-accent text-base',
                i < activeWord && i !== activeWord && 'text-ink',
                i > activeWord && 'text-muted',
                isAnswer && i !== activeWord && 'underline decoration-accent/60 decoration-2 underline-offset-4',
                picked?.index === i && 'ring-1 ring-accent'
              )}
            >
              {w.word}
            </button>
          );
        })}
      </p>

      {diff && diff.some(c => c.op !== 'same') && (
        <div className="mt-4 p-3 rounded-md bg-raised">
          <p className="eyebrow mb-2">你錯在哪裡</p>
          <div className="font-mono text-lg leading-tight flex flex-wrap gap-y-1">
            {diff.map((c, i) => (
              <span
                key={i}
                className={clsx(
                  'px-[1px]',
                  c.op === 'same' && 'text-muted',
                  c.op === 'wrong' && 'text-bad underline decoration-wavy decoration-bad',
                  c.op === 'extra' && 'text-bad line-through',
                  c.op === 'missing' && 'text-ok bg-ok/15 rounded-xs'
                )}
                title={
                  c.op === 'wrong' ? `你打 ${c.user}，正確是 ${c.correct}`
                  : c.op === 'extra' ? `多了 ${c.user}`
                  : c.op === 'missing' ? `漏了 ${c.correct}` : ''
                }
              >
                {c.op === 'missing' ? c.correct : c.user}
                {c.correct && c.correct.length > 1 ? ' ' : ''}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-faint">
            <span className="text-bad">紅色</span> 是你打錯或多打的，
            <span className="text-ok">綠色</span> 是你漏掉的。
          </p>
        </div>
      )}

      {picked && (
        <div className="mt-4 p-3 rounded-md border border-line bg-raised reveal">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-lg">{picked.word}</span>
            <div className="flex gap-2">
              <button
                className="btn-quiet text-sm"
                onClick={() => onSeek(Math.max(0, timings[picked.index].start - 0.3))}
              >
                ▶ 聽這個字
              </button>
              <button
                className="btn-ghost text-sm"
                onClick={() => onAddVocab(picked.word)}
                disabled={savedWords.has(picked.word.toLowerCase())}
              >
                {savedWords.has(picked.word.toLowerCase()) ? '已在生字本' : '+ 生字本'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
