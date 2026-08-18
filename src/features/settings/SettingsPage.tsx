import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useSettings } from '@/store/useSettings';
import { exportAll, importAll, resetAll, storageEstimate, requestPersistence } from '@/core/db/db';
import { currentHapticTier, hapticTick, unlockHaptics } from '@/core/haptics/haptics';

export function SettingsPage() {
  const nav = useNavigate();
  const s = useSettings();
  const [storage, setStorage] = useState({ usage: 0, quota: 0 });
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void storageEstimate().then(setStorage);
    void requestPersistence().then(setPersisted);
  }, []);

  const download = async () => {
    const blob = new Blob([await exportAll()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ilt-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg('已匯出。在 iPhone 上可存到「檔案」或 iCloud 雲碟。');
  };

  const upload = (file: File) => {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const { merged } = await importAll(String(r.result));
        setMsg(`已匯入 ${merged} 筆紀錄。衝突以較新的為準。`);
      } catch {
        setMsg('匯入失敗：檔案格式不正確。');
      }
    };
    r.readAsText(file);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 pb-16">
      <header>
        <button className="btn-quiet text-sm px-2 -ml-2 mb-2" onClick={() => nav('/')}>← 首頁</button>
        <h1 className="text-2xl font-semibold">設定</h1>
      </header>

      <Section title="外觀">
        <Row label="主題">
          <Segmented
            options={[['dark', '深色'], ['light', '淺色']]}
            value={s.theme}
            onChange={v => s.set('theme', v as 'dark' | 'light')}
          />
        </Row>
        <Row label="字級">
          <Segmented
            options={[['0.875', 'S'], ['1', 'M'], ['1.125', 'L'], ['1.25', 'XL'], ['1.5', 'XXL']]}
            value={String(s.fontScale)}
            onChange={v => s.set('fontScale', Number(v))}
          />
        </Row>
        <Toggle
          label="色盲友善配色"
          hint="正確/錯誤改用藍/橘，並一律附圖示"
          checked={s.colorBlindSafe}
          onChange={v => s.set('colorBlindSafe', v)}
        />
      </Section>

      <Section title="判分規則">
        <Toggle
          label="連字號計較"
          hint="開啟時 car-park 與 car park 視為不同答案（與真實考試一致）"
          checked={s.strictHyphen}
          onChange={v => s.set('strictHyphen', v)}
        />
        <Toggle
          label="答錯時詢問失分原因"
          hint="關閉後改在結果頁批次標記。這個標記決定弱點分析準不準。"
          checked={s.askFailureReason}
          onChange={v => s.set('askFailureReason', v)}
        />
        <Row label="每日目標">
          <Segmented
            options={[['10', '10 分'], ['20', '20 分'], ['30', '30 分'], ['60', '60 分']]}
            value={String(s.dailyGoalMinutes)}
            onChange={v => s.set('dailyGoalMinutes', Number(v))}
          />
        </Row>
      </Section>

      <Section title="回饋">
        <Toggle label="觸覺回饋" checked={s.hapticsEnabled} onChange={v => s.set('hapticsEnabled', v)} />
        <Toggle
          label="音效回饋"
          hint="iOS 不支援網頁震動，音效是主要的替代管道"
          checked={s.soundFeedbackEnabled}
          onChange={v => s.set('soundFeedbackEnabled', v)}
        />
        <div className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="text-sm">目前回饋管道</p>
            <p className="text-xs text-faint mt-0.5 font-mono">{tierLabel(currentHapticTier())}</p>
          </div>
          <button
            className="btn-ghost text-sm shrink-0"
            onClick={() => { unlockHaptics(); hapticTick('strong'); }}
          >
            測試
          </button>
        </div>
      </Section>

      <Section title="資料">
        <div className="py-2">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-muted">已用空間</span>
            <span className="font-mono">
              {mb(storage.usage)} / {storage.quota ? mb(storage.quota) : '—'}
            </span>
          </div>
          <div className="h-1.5 bg-line rounded-full overflow-hidden">
            <div
              className="h-full bg-accent"
              style={{ width: `${storage.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 0}%` }}
            />
          </div>
          <p className="text-xs text-faint mt-1.5">
            {persisted === true ? '已申請持久化儲存，資料不會被系統自動清除。'
              : persisted === false ? '瀏覽器未授予持久化儲存。把 App 加入主畫面可提高保留機率。'
              : '檢查中…'}
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <button className="btn-ghost flex-1 text-sm" onClick={download}>匯出備份</button>
          <label className="btn-ghost flex-1 text-sm cursor-pointer">
            匯入備份
            <input
              type="file" accept="application/json" className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }}
            />
          </label>
        </div>

        <button
          className="btn-danger w-full text-sm mt-2"
          onClick={async () => {
            if (prompt('這會清除所有練習紀錄與複習進度。輸入 RESET 確認：') === 'RESET') {
              await resetAll();
              setMsg('已重設所有進度。');
            }
          }}
        >
          重設所有進度
        </button>

        {msg && <p className="text-sm text-accent mt-2 reveal" role="status">{msg}</p>}
      </Section>

      <p className="text-xs text-faint leading-relaxed px-1">
        所有資料只存在這台裝置的瀏覽器中，不會上傳任何伺服器。換裝置請用匯出/匯入。
      </p>
    </div>
  );
}

function tierLabel(t: string) {
  return {
    'vibrate': '系統震動（navigator.vibrate）',
    'ios-switch': 'iOS 原生 haptic（switch 元件）',
    'audio': '音效 click + 視覺脈衝（此裝置不支援網頁震動）',
    'visual-only': '僅視覺脈衝'
  }[t] ?? t;
}

function mb(n: number) { return `${(n / 1024 / 1024).toFixed(1)} MB`; }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <p className="eyebrow mb-2">{title}</p>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5">
      <p className="text-sm mb-2">{label}</p>
      {children}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange(v: boolean): void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 py-2.5 cursor-pointer">
      <span className="min-w-0">
        <span className="text-sm block">{label}</span>
        {hint && <span className="text-xs text-faint block mt-0.5 leading-snug">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <span className={clsx(
        'shrink-0 w-11 h-6 rounded-full border transition-colors relative mt-0.5',
        'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent',
        checked ? 'bg-accent/30 border-accent' : 'bg-raised border-line'
      )}>
        <span className={clsx(
          'absolute top-[3px] w-4 h-4 rounded-full transition-[left] duration-150',
          checked ? 'left-[24px] bg-accent' : 'left-[3px] bg-muted'
        )} />
      </span>
    </label>
  );
}

function Segmented({ options, value, onChange }: {
  options: [string, string][]; value: string; onChange(v: string): void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={clsx(
            'btn text-sm border px-3',
            value === v ? 'border-accent text-accent' : 'border-line text-muted'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
