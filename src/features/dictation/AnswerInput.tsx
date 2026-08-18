import { forwardRef, useEffect, useRef } from 'react';
import clsx from 'clsx';

interface Props {
  value: string;
  onChange(v: string): void;
  onSubmit(): void;
  maxWords: number;
  disabled?: boolean;
  placeholder?: string;
  multiline?: boolean;
  /** 顯示長度暗示（挖空模式用） */
  widthCh?: number;
  autoFocus?: boolean;
  ariaLabel: string;
}

export const AnswerInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, Props>(
  function AnswerInput(p, _ref) {
    const inner = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
    const words = p.value.trim() ? p.value.trim().split(/\s+/).length : 0;
    const over = words > p.maxWords && p.maxWords < 99;

    // iOS 鍵盤遮擋處理（規格 §2.4）
    useEffect(() => {
      const vv = window.visualViewport;
      if (!vv) return;
      const onResize = () => {
        if (document.activeElement === inner.current) {
          inner.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      };
      vv.addEventListener('resize', onResize);
      return () => vv.removeEventListener('resize', onResize);
    }, []);

    const shared = {
      ref: inner,
      value: p.value,
      disabled: p.disabled,
      placeholder: p.placeholder,
      'aria-label': p.ariaLabel,
      'aria-invalid': over,
      autoFocus: p.autoFocus,
      // 必須關閉，否則 iOS 自動更正會直接送分（規格 §7.3）
      autoCapitalize: 'off' as const,
      autoCorrect: 'off' as const,
      autoComplete: 'off' as const,
      spellCheck: false,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        p.onChange(e.target.value),
      onPaste: (e: React.ClipboardEvent) => {
        e.preventDefault();
        p.onChange(p.value + e.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
      }
    };

    return (
      <div className="w-full">
        {p.multiline ? (
          <textarea
            {...shared}
            rows={3}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); p.onSubmit(); }
            }}
            className={clsx(
              'field w-full resize-none rounded-md border-2 leading-relaxed',
              'text-lg tracking-wide',
              over ? 'border-bad' : 'border-line focus:border-accent'
            )}
          />
        ) : (
          <input
            {...shared}
            type="text"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); p.onSubmit(); } }}
            style={p.widthCh ? { width: `${Math.max(6, p.widthCh + 3)}ch` } : undefined}
            className={clsx(
              'field text-lg tracking-wide',
              over ? 'border-bad' : 'border-line focus:border-accent'
            )}
          />
        )}

        {p.maxWords < 99 && (
          <p className={clsx('mt-1 text-xs font-mono', over ? 'text-bad' : 'text-faint')}>
            {words}/{p.maxWords} 字{over && '　超過字數上限，會判錯'}
          </p>
        )}
      </div>
    );
  }
);
