import { canonToken } from './abbrev';
import { digitsOnly, numericVariants } from './numbers';
import type { SkillTag } from '@/types';

export interface NormalizeOptions {
  /** true 時 "car-park" ≠ "car park"（規格 §9.1 預設） */
  strictHyphen: boolean;
  /** 允許 15 ⇄ fifteen */
  numeric: boolean;
  skillTags: SkillTag[];
}

const FULLWIDTH_OFFSET = 0xfee0;

/** 全形轉半形 + 智慧引號/破折號正規化 */
export function toHalfWidth(s: string): string {
  return s
    .replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - FULLWIDTH_OFFSET))
    .replace(/\u3000/g, ' ')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-');
}

/**
 * 規格 §9.1 正規化流程。
 * 注意：複數 s 與連字號**刻意不處理**（考試計較），大小寫刻意忽略。
 */
export function normalize(input: string, opts: NormalizeOptions): string {
  let s = toHalfWidth(input).trim();
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/^[.,!?;:"']+|[.,!?;:"']+$/g, '');
  s = s.toLowerCase();
  if (!opts.strictHyphen) s = s.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.split(' ').map(canonToken).join(' ');
  return s.trim();
}

/** 產生一個答案的所有可接受變體集合 */
export function variants(input: string, opts: NormalizeOptions): Set<string> {
  const base = normalize(input, opts);
  const out = new Set<string>([base]);

  // 連字號：strict 模式下不放寬；非 strict 已在 normalize 展平
  if (!opts.strictHyphen && base.includes(' ')) out.add(base.replace(/ /g, '-'));

  if (opts.numeric) for (const v of numericVariants(base)) out.add(v.trim());

  if (opts.skillTags.includes('number-phone')) {
    const d = digitsOnly(base);
    if (d) out.add(`#phone:${d}`);
  }

  if (opts.skillTags.includes('number-money')) {
    const stripped = base.replace(/[£$€]/g, '').trim();
    out.add(stripped);
    for (const v of numericVariants(stripped)) out.add(v.trim());
  }

  if (opts.skillTags.includes('number-date')) {
    // "3 march" ⇄ "march 3"
    const parts = base.split(' ');
    if (parts.length === 2) out.add(`${parts[1]} ${parts[0]}`);
    for (const v of numericVariants(base)) {
      const p = v.trim().split(' ');
      if (p.length === 2) out.add(`${p[1]} ${p[0]}`);
      out.add(v.trim());
    }
  }

  out.delete('');
  return out;
}

/** IELTS 字數規則：連字號詞算一個字 */
export function countWords(input: string): number {
  const s = toHalfWidth(input).trim().replace(/\s+/g, ' ');
  if (!s) return 0;
  return s.split(' ').length;
}

export function matches(userAnswer: string, accepted: string[], opts: NormalizeOptions): boolean {
  const u = variants(userAnswer, opts);
  for (const a of accepted) {
    for (const v of variants(a, opts)) if (u.has(v)) return true;
  }
  return false;
}
