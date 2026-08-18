import clsx from 'clsx';
import type { FailureReason } from '@/types';

const OPTIONS: { key: FailureReason; label: string; hint: string }[] = [
  { key: 'not-heard',        label: '我沒聽到',       hint: '整段沒抓到' },
  { key: 'heard-misspelled', label: '聽到了但拼錯',   hint: '耳朵沒問題' },
  { key: 'unknown-word',     label: '不認識這個字',   hint: '字彙缺口' },
  { key: 'too-slow',         label: '來不及打',       hint: '反應速度' },
  { key: 'misunderstood',    label: '聽成別的意思',   hint: '同義轉換沒對上' },
  { key: 'trap',             label: '中了陷阱',       hint: '被更正或誘答騙到' }
];

interface Props {
  autoReason: FailureReason | null;
  selected: FailureReason | null;
  onSelect(r: FailureReason): void;
}

/** 規格 §7.5：系統預選推測值，使用者一鍵確認即可 */
export function ReasonDialog({ autoReason, selected, onSelect }: Props) {
  const active = selected ?? autoReason;
  return (
    <div className="card p-3">
      <p className="eyebrow mb-1">這題卡在哪裡？</p>
      <p className="text-xs text-muted mb-2.5">
        這個標記直接決定弱點分析準不準，花兩秒選一下最值得。
      </p>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map(o => (
          <button
            key={o.key}
            onClick={() => onSelect(o.key)}
            aria-pressed={active === o.key}
            className={clsx(
              'btn text-left flex-col items-start justify-center py-2 px-3 border',
              active === o.key
                ? 'border-accent bg-accent/10 text-ink'
                : 'border-line text-muted hover:text-ink hover:bg-raised'
            )}
          >
            <span className="text-sm font-medium">{o.label}</span>
            <span className="text-[11px] text-faint">{o.hint}</span>
          </button>
        ))}
      </div>
      {autoReason && !selected && (
        <p className="mt-2 text-[11px] text-faint">
          已依你的作答預選「{OPTIONS.find(o => o.key === autoReason)?.label}」，不對就改。
        </p>
      )}
    </div>
  );
}
