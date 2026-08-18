import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/core/db/db';
import { reviewOrder } from '@/core/srs/sm2';
import { useSettings } from '@/store/useSettings';
import type { AttemptRecord } from '@/types';

const DAY = 86_400_000;

export function Dashboard() {
  const goal = useSettings(s => s.dailyGoalMinutes);
  const [due, setDue] = useState(0);
  const [today, setToday] = useState<AttemptRecord[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    void (async () => {
      const cards = await db.srs.toArray();
      setDue(reviewOrder(cards).length);

      const all = await db.attempts.orderBy('timestamp').reverse().limit(600).toArray();
      const start = new Date(); start.setHours(0, 0, 0, 0);
      setToday(all.filter(a => a.timestamp >= start.getTime()));

      const days = new Set(all.map(a => Math.floor(a.timestamp / DAY)));
      let s = 0;
      for (let d = Math.floor(Date.now() / DAY); days.has(d); d--) s++;
      setStreak(s);
    })();
  }, []);

  const minutes = today.reduce((s, a) => s + a.timeSpentMs, 0) / 60_000;
  const progress = Math.min(1, minutes / goal);
  const accuracy = today.length
    ? Math.round((today.filter(a => a.isCorrect).length / today.length) * 100) : null;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <header className="pt-6 pb-2">
        <p className="eyebrow">離線可用・資料不離開這台裝置</p>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">聽力訓練器</h1>
      </header>

      <section className="card p-5 flex items-center gap-5">
        <Ring progress={progress} label={`${streak}`} sublabel="連續天" />
        <div className="min-w-0">
          <p className="text-2xl font-mono tabular-nums leading-none">
            {minutes.toFixed(0)}<span className="text-base text-muted"> / {goal} 分鐘</span>
          </p>
          <p className="text-sm text-muted mt-1.5">
            {today.length
              ? `今天做了 ${today.length} 題，正確率 ${accuracy}%`
              : '今天還沒開始。10 分鐘也算數。'}
          </p>
        </div>
      </section>

      <Link
        to="/review"
        className="card p-4 flex items-center justify-between hover:bg-raised transition-colors"
      >
        <div>
          <p className="eyebrow">複習佇列</p>
          <p className="text-lg mt-0.5">
            {due ? `${due} 張卡片到期` : '已清空 ✓'}
          </p>
        </div>
        {due > 0 && <span className="w-2.5 h-2.5 rounded-full bg-bad" aria-label="有待複習項目" />}
      </Link>

      <section>
        <p className="eyebrow mb-2">快速開始</p>
        <div className="grid gap-3">
          <Link to="/practice/dictation" className="card p-4 hover:bg-raised transition-colors block">
            <p className="text-lg font-medium">句級聽寫</p>
            <p className="text-sm text-muted mt-0.5">聽一句，打出你聽到的內容</p>
          </Link>

          {LOCKED.map(m => (
            <div key={m.name} className="card p-4 opacity-45">
              <div className="flex items-baseline justify-between">
                <p className="text-lg font-medium">{m.name}</p>
                <span className="text-[11px] text-faint font-mono">Phase {m.phase}</span>
              </div>
              <p className="text-sm text-muted mt-0.5">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="pt-4 pb-8 flex justify-between text-sm">
        <Link to="/settings" className="btn-quiet px-2">設定</Link>
        <span className="text-faint self-center text-xs">Phase 1</span>
      </footer>
    </div>
  );
}

const LOCKED = [
  { name: 'Section 1 快打', desc: '姓名拼字、電話、日期、金額', phase: 3 },
  { name: '同義轉換辨識', desc: '聽 cut down on，題目寫 reduce', phase: 3 },
  { name: '陷阱與自我更正', desc: '抓出被推翻的答案', phase: 3 },
  { name: '全真模考', desc: '30 分鐘 4 個 Section，不可暫停', phase: 3 }
];

function Ring({ progress, label, sublabel }: { progress: number; label: string; sublabel: string }) {
  const R = 30, C = 2 * Math.PI * R;
  return (
    <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
      <svg viewBox="0 0 76 76" className="-rotate-90 w-full h-full" aria-hidden>
        <circle cx="38" cy="38" r={R} fill="none" stroke="rgb(var(--c-line))" strokeWidth="5" />
        <circle
          cx="38" cy="38" r={R} fill="none"
          stroke="rgb(var(--c-accent))" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 400ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="font-mono text-xl leading-none">{label}</span>
        <span className="text-[9px] text-faint mt-0.5">{sublabel}</span>
      </div>
    </div>
  );
}
