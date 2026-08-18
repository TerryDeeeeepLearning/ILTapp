import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useSession } from '@/store/useSession';
import { pickItems } from '@/content/seed/dictation';
import { unlockAudio } from '@/core/audio/unlock';
import { ACCENT_FLAG, ACCENT_LABEL, type Accent, type RevealMode } from '@/types';

const ACCENTS: Accent[] = ['en-GB', 'en-AU', 'en-US', 'en-CA', 'en-NZ'];

const REVEALS: { key: RevealMode; label: string; desc: string }[] = [
  { key: 'hidden', label: '完全隱藏', desc: '只有音檔，打出整句。最接近真實聽力負荷。' },
  { key: 'gapped', label: '顯示挖空', desc: '看得到句子，只填關鍵詞。標準填空題型。' },
  { key: 'shown',  label: '完整顯示', desc: '對照原文聽讀，不判分。給耳朵先熟悉口音。' }
];

export function SetupPage() {
  const nav = useNavigate();
  const begin = useSession(s => s.begin);
  const [reveal, setReveal] = useState<RevealMode>('hidden');
  const [count, setCount] = useState(10);
  const [accents, setAccents] = useState<Accent[]>([]);
  const [range, setRange] = useState<[number, number]>([1, 5]);

  const start = () => {
    unlockAudio();
    const items = pickItems({ count, accents, difficulty: range });
    if (!items.length) return;
    begin({ mode: 'dictation', reveal, count, accents, difficulty: range }, items);
    nav('/session');
  };

  const toggleAccent = (a: Accent) =>
    setAccents(cur => cur.includes(a) ? cur.filter(x => x !== a) : [...cur, a]);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      <header>
        <button className="btn-quiet text-sm px-2 -ml-2 mb-2" onClick={() => nav('/')}>← 首頁</button>
        <h1 className="text-2xl font-semibold">句級聽寫</h1>
        <p className="text-muted text-sm mt-1">聽一句，打出你聽到的內容。</p>
      </header>

      <section className="card p-4">
        <p className="eyebrow mb-3">原文顯示方式</p>
        <div className="space-y-2">
          {REVEALS.map(r => (
            <button
              key={r.key}
              onClick={() => setReveal(r.key)}
              aria-pressed={reveal === r.key}
              className={clsx(
                'w-full text-left p-3 rounded-md border transition-colors',
                reveal === r.key ? 'border-accent bg-accent/10' : 'border-line hover:bg-raised'
              )}
            >
              <span className="font-medium">{r.label}</span>
              <span className="block text-xs text-muted mt-0.5">{r.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <p className="eyebrow mb-3">題數</p>
        <div className="flex gap-2">
          {[5, 10, 20, 30].map(n => (
            <button
              key={n}
              onClick={() => setCount(n)}
              aria-pressed={count === n}
              className={clsx('btn flex-1 border', count === n ? 'border-accent text-accent' : 'border-line text-muted')}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <p className="eyebrow mb-1">口音</p>
        <p className="text-xs text-muted mb-3">不選 = 全部混合，最接近真實考試。</p>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map(a => (
            <button
              key={a}
              onClick={() => toggleAccent(a)}
              aria-pressed={accents.includes(a)}
              className={clsx(
                'btn border text-sm',
                accents.includes(a) ? 'border-accent text-accent' : 'border-line text-muted'
              )}
            >
              {ACCENT_FLAG[a]} {ACCENT_LABEL[a]}
            </button>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <p className="eyebrow mb-3">難度 {range[0]} – {range[1]}</p>
        <div className="flex gap-2">
          {[[1, 2], [2, 4], [4, 5], [1, 5]].map(([lo, hi]) => (
            <button
              key={`${lo}-${hi}`}
              onClick={() => setRange([lo, hi])}
              aria-pressed={range[0] === lo && range[1] === hi}
              className={clsx(
                'btn flex-1 border text-sm',
                range[0] === lo && range[1] === hi ? 'border-accent text-accent' : 'border-line text-muted'
              )}
            >
              {lo === 1 && hi === 5 ? '全部' : lo <= 2 && hi <= 2 ? '入門' : lo >= 4 ? '進階' : '中階'}
            </button>
          ))}
        </div>
      </section>

      <button className="btn-primary w-full text-lg py-4" onClick={start}>開始練習</button>
    </div>
  );
}
