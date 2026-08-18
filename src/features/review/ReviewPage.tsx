import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/core/db/db';
import { reviewOrder } from '@/core/srs/sm2';
import { SEED_DICTATION } from '@/content/seed/dictation';
import { useSession } from '@/store/useSession';
import { unlockAudio } from '@/core/audio/unlock';
import type { SrsCard } from '@/types';

export function ReviewPage() {
  const nav = useNavigate();
  const begin = useSession(s => s.begin);
  const [due, setDue] = useState<SrsCard[]>([]);
  const [all, setAll] = useState<SrsCard[]>([]);

  useEffect(() => {
    void db.srs.toArray().then(cards => { setAll(cards); setDue(reviewOrder(cards)); });
  }, []);

  const start = (limit: number) => {
    const ids = [...new Set(due.slice(0, limit).map(c => c.itemId))];
    const items = SEED_DICTATION.filter(i => ids.includes(i.id));
    if (!items.length) return;
    unlockAudio();
    begin({ mode: 'dictation', reveal: 'hidden', count: items.length, accents: [], difficulty: [1, 5] }, items);
    nav('/session');
  };

  const leeches = all.filter(c => c.status === 'leech').length;
  const forced = due.filter(c => c.forcedTomorrow).length;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <header>
        <button className="btn-quiet text-sm px-2 -ml-2 mb-2" onClick={() => nav('/')}>← 首頁</button>
        <h1 className="text-2xl font-semibold">複習</h1>
      </header>

      {due.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-lg">已清空 ✓</p>
          <p className="text-sm text-muted mt-1.5">
            {all.length
              ? `共 ${all.length} 張卡片，下一張在 ${nextDueLabel(all)} 到期。`
              : '做完第一組練習後，錯題會自動排進來。'}
          </p>
          <button className="btn-primary mt-4" onClick={() => nav('/practice/dictation')}>
            去做新練習
          </button>
        </div>
      ) : (
        <>
          <div className="card p-5">
            <p className="font-mono tabular-nums leading-none" style={{ fontSize: '2.75rem' }}>
              {due.length}
            </p>
            <p className="text-sm text-muted mt-1">張卡片到期</p>
            {forced > 0 && (
              <p className="text-xs text-hint mt-2">
                其中 {forced} 張是因為看過解答被強制排入的。
              </p>
            )}
            {leeches > 0 && (
              <p className="text-xs text-bad mt-1">
                {leeches} 張已標記為頑固卡（錯過 5 次以上），建議換個練法攻克。
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => start(10)}>只練 10 張</button>
            <button className="btn-primary flex-1" onClick={() => start(40)}>
              全部（上限 40）
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function nextDueLabel(cards: SrsCard[]): string {
  const next = Math.min(...cards.map(c => c.dueAt));
  const days = Math.ceil((next - Date.now()) / 86_400_000);
  return days <= 1 ? '明天' : `${days} 天後`;
}
