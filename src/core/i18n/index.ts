import zhTW from '@/locales/zh-TW';
import en from '@/locales/en';

export type DictKey = keyof typeof zhTW;
type Dict = Record<DictKey, string>;

const DICTS: Record<string, Dict> = { 'zh-TW': zhTW, en };

export function t(locale: string, key: DictKey, vars?: Record<string, string | number>): string {
  const dict = DICTS[locale] ?? DICTS['zh-TW'];
  let s = dict[key] ?? zhTW[key] ?? String(key);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
