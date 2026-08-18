import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useSession } from '@/store/useSession';
import { ACCENT_LABEL, type Accent, type FailureReason, type SkillTag } from '@/types';

const REASON_LABEL: Record<FailureReason, string> = {
  'not-heard': '沒聽到', 'heard-misspelled': '拼錯', 'unknown-word': '生字',
  'too-slow': '來不及', 'misunderstood': '誤解', 'trap': '中陷阱', 'correct': '正確'
};

const TAG_LABEL: Partial<Record<SkillTag, string>> = {
  'spelling-name': '姓名拼字', 'number-phone': '電話號碼', 'number-date': '日期',
  'number-money': '金額', 'number-general': '一般數字', 'address': '地址',
  'paraphrase': '同義轉換', 'self-correction': '自我更正', 'distractor': '干擾選項',
  'connected-speech': '連音弱讀', 'academic-vocab': '學術字彙', 'signposting': '訊號詞'
};

export function ResultPage() {
  const nav = useNavigate();
  const { queue, attempts, reset } = useSession();

  const stats = useMemo(() => {
    const done = queue.filter(q => q.submittedAt);
    const cells = done.flatMap(q =>
      q.blankIds
        .map(id => ({ q, id, blank: q.item.blanks.find(b => b.id === id)!, res: q.results[id] }))
        .filter(c => c.res)
    );

    const correct = cells.filter(c => c.res.isCorrect).length;
    const scored = cells.reduce((s, c) => s + c.res.score, 0);

    const byReason = new Map<FailureReason, number>();
    const byAccent = new Map<Accent, { c: number; n: number }>();
    const byTag = new Map<SkillTag, { c: number; n: number }>();

    for (const c of cells) {
      if (!c.res.isCorrect) {
        const r = c.q.reasons[c.id] ?? c.res.autoReason;
        byReason.set(r, (byReason.get(r) ?? 0) + 1);
      }
      const a = byAccent.get(c.q.item.primaryAccent) ?? { c: 0, n: 0 };
      a.n++; if (c.res.isCorrect) a.c++;
      byAccent.set(c.q.item.primaryAccent, a);

      for (const tag of c.blank.skillTags) {
        const t = byTag.get(tag) ?? { c: 0, n: 0 };
        t.n++; if (c.res.isCorrect) t.c++;
        byTag.set(tag, t);
      }
    }

    const hinted = cells.filter(c => (c.q.hintLevels[c.id] ?? 0) > 0).length;
    const avgTime = attempts.length
      ? attempts.reduce((s, a) => s + a.timeSpentMs, 0) / attempts.length / 1000 : 0;

    return { items: done, cells, total: cells.length, correct, scored, byReason, byAccent, byTag, hinted, avgTime };
  }, [queue, attempts]);

  if (!stats.total) { nav('/'); return null; }

  const pct = Math.round((stats.correct / stats.total) * 100);
  const topReason = [...stats.byReason.entries()].sort((a, b) => b[1] - a[1])[0];
  const weakTags = [...stats.byTag.entries()]
    .filter(([, v]) => v.n >= 2 && v.c / v.n < 0.7)
    .sort((a, b) => a[1].c / a[1].n - b[1].c / b[1].n)
    .slice(0, 3);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <header className="pt-4 text-center">
        <p className="eyebrow">本次練習</p>
        <p className="font-mono tabular-nums leading-none mt-2" style={{ fontSize: '3.5rem' }}>
          {pct}<span className="text-2xl text-muted">%</span>
        </p>
        <p className="text-muted text-sm mt-1">
          答對 {stats.correct} / {stats.total} 個空格　·　計分後 {stats.scored.toFixed(1)} 分
        </p>
      </header>

      {topReason && (
        <div className="card p-4 border-l-4 border-l-accent">
          <p className="eyebrow mb-1">主要失分來源</p>
          <p className="text-lg">
            {REASON_LABEL[topReason[0]]}　
            <span className="text-muted text-sm">{topReason[1]} 個空格</span>
          </p>
          <p className="text-sm text-muted mt-1.5 leading-relaxed">{advice(topReason[0])}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Stat label="平均作答" value={`${stats.avgTime.toFixed(1)}s`} />
        <Stat label="用過提示" value={`${stats.hinted} 格`} />
        <Stat label="題數" value={`${stats.items.length}`} />
      </div>

      {weakTags.length > 0 && (
        <section className="card p-4">
          <p className="eyebrow mb-3">最弱的考點</p>
          <div className="space-y-2">
            {weakTags.map(([tag, v]) => (
              <div key={tag} className="flex items-center gap-3">
                <span className="text-sm w-20 text-muted shrink-0">{TAG_LABEL[tag] ?? tag}</span>
                <div className="flex-1 h-2 bg-line rounded-full overflow-hidden">
                  <div className="h-full bg-bad" style={{ width: `${(v.c / v.n) * 100}%` }} />
                </div>
                <span className="font-mono text-xs text-muted w-12 text-right">{v.c}/{v.n}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {stats.byAccent.size > 1 && (
        <section className="card p-4">
          <p className="eyebrow mb-3">各口音正確率</p>
          <div className="space-y-2">
            {[...stats.byAccent.entries()].map(([a, v]) => (
              <div key={a} className="flex items-center gap-3">
                <span className="text-sm w-14 text-muted shrink-0">{ACCENT_LABEL[a]}</span>
                <div className="flex-1 h-2 bg-line rounded-full overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${(v.c / v.n) * 100}%` }} />
                </div>
                <span className="font-mono text-xs text-muted w-12 text-right">{v.c}/{v.n}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card p-4">
        <p className="eyebrow mb-3">逐題</p>
        <ul className="space-y-3">
          {stats.items.map((q, i) => {
            const cells = q.blankIds.map(id => ({
              id, blank: q.item.blanks.find(b => b.id === id)!, res: q.results[id]
            })).filter(c => c.res);
            const allOk = cells.every(c => c.res.isCorrect);
            return (
              <li key={q.item.id} className="flex items-start gap-3 text-sm">
                <span className={clsx(
                  'mt-0.5 w-5 h-5 shrink-0 rounded-xs grid place-items-center text-xs font-mono',
                  allOk ? 'bg-ok/20 text-ok' : 'bg-bad/20 text-bad'
                )}>
                  {allOk ? '✓' : '✗'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">{i + 1}. {q.item.topic}</p>
                  {cells.filter(c => !c.res.isCorrect).map(c => (
                    <p key={c.id} className="font-mono text-xs mt-0.5 truncate">
                      <span className="text-bad">{q.answers[c.id] || '（未作答）'}</span>
                      <span className="text-faint"> → </span>
                      <span className="text-ok">{c.blank.answers[0]}</span>
                    </p>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex gap-2 pb-8">
        <button className="btn-ghost flex-1" onClick={() => { reset(); nav('/practice/dictation'); }}>
          再練一組
        </button>
        <button className="btn-primary flex-1" onClick={() => { reset(); nav('/'); }}>
          回首頁
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3 text-center">
      <p className="font-mono text-xl">{value}</p>
      <p className="text-[11px] text-faint mt-0.5">{label}</p>
    </div>
  );
}

function advice(r: FailureReason): string {
  switch (r) {
    case 'heard-misspelled':
      return '你的耳朵沒問題，問題在拼字。這類錯誤在真實考試一樣扣分，建議把錯字加入拼字專練。';
    case 'not-heard':
      return '整段沒抓到，先降到 0.75× 練同一批句子，抓到之後再回到 1.0×。';
    case 'too-slow':
      return '聽得懂但打不完。練 Section 1 快打提升反應速度，並改用盲打不要看鍵盤。';
    case 'trap':
      return '被說話者的自我更正或誘答騙到。這是雅思最穩定的送分陷阱，值得專門練。';
    case 'unknown-word':
      return '字彙缺口。把生字本清完，比多做題有效。';
    case 'misunderstood':
      return '聽到了但對應錯意思，通常是同義轉換沒接上。建議做同義轉換辨識。';
    default:
      return '';
  }
}
