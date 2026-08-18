#!/usr/bin/env node
/**
 * 規格 §5.3：題庫規則校驗。CI 與每次改題庫後都應執行。
 *
 * 數字與縮寫的等價判斷直接呼叫 src/core/grading 的執行期實作，
 * 不在這裡重寫一份 —— 兩份實作遲早會漂移，漂移後校驗就失去意義。
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTs } from './lib/load-ts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { wordsToDigits, stripOrdinalSuffix, digitsOnly } = await loadTs('src/core/grading/numbers.ts');
const { canonToken } = await loadTs('src/core/grading/abbrev.ts');
const { matches } = await loadTs('src/core/grading/normalize.ts');

const specs = JSON.parse(readFileSync(join(ROOT, 'src/content/seed/core-starter.json'), 'utf-8'));

/** 去標點、展平連字號，與執行期 normalize() 的前處理一致 */
function flatten(s) {
  return String(s)
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s) {
  return stripOrdinalSuffix(wordsToDigits(flatten(s)))
    .split(' ').map(canonToken).filter(Boolean);
}

/** 答案的每個 token 是否依序出現在 transcript 中 */
function appearsInOrder(text, answer) {
  const hay = tokens(text);
  const need = tokens(answer);
  if (!need.length) return false;
  let from = 0;
  for (const t of need) {
    const at = hay.indexOf(t, from);
    if (at < 0) return false;
    from = at + 1;
  }
  return true;
}

/** 電話等長數字串：逐位唸出，比對純數字 */
function phoneMatches(text, answer) {
  const want = digitsOnly(flatten(answer));
  if (want.length < 5) return false;
  return digitsOnly(flatten(text)).includes(want);
}

const errors = [];
const warnings = [];
const tagCount = new Map();
const accentCount = new Map();

for (const s of specs) {
  const where = `[${s.id}]`;
  if (!s.text?.trim()) errors.push(`${where} 缺少 text`);
  if (!s.gaps?.length) errors.push(`${where} 沒有任何 gap`);

  const seen = new Set();
  for (const g of s.gaps ?? []) {
    // 1. surface 必須逐字出現在 transcript 中 —— 挖空渲染完全依賴這一點
    if (!g.surface) {
      errors.push(`${where} 答案「${g.answer}」缺少 surface`);
    } else if (!s.text.toLowerCase().includes(g.surface.toLowerCase())) {
      errors.push(`${where} surface「${g.surface}」未逐字出現在 transcript`);
    }

    // 2. answer 必須被執行期判分視為與 surface 等價，否則使用者照著唸也會判錯
    if (g.surface) {
      const opts = { strictHyphen: false, numeric: g.numeric ?? true, skillTags: g.tags ?? [] };
      const equivalent = matches(g.surface, [g.answer], opts)
        || appearsInOrder(g.surface, g.answer)
        || phoneMatches(g.surface, g.answer);
      if (!equivalent) {
        errors.push(`${where} 答案「${g.answer}」與原文「${g.surface}」在判分上不等價`);
      }
    }

    const words = String(g.answer).trim().split(/\s+/).length;
    if (g.maxWords && words > g.maxWords) {
      errors.push(`${where} 答案「${g.answer}」有 ${words} 字，超過 maxWords=${g.maxWords}`);
    }

    const key = String(g.answer).toLowerCase();
    if (seen.has(key)) errors.push(`${where} 答案重複：${g.answer}`);
    seen.add(key);

    if (!g.tags?.length) errors.push(`${where} 答案「${g.answer}」缺少 skillTag`);
    for (const t of g.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  }

  // 3. 空格區間不得重疊，否則挖空渲染會錯位
  const spans = (s.gaps ?? []).map(g => {
    const at = s.text.toLowerCase().indexOf((g.surface ?? '').toLowerCase());
    return at < 0 ? null : [at, at + g.surface.length];
  }).filter(Boolean).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < spans.length; i++) {
    if (spans[i][0] < spans[i - 1][1]) {
      errors.push(`${where} 空格區間重疊，無法正確渲染挖空`);
      break;
    }
  }

  for (const t of s.traps ?? []) {
    if (!appearsInOrder(s.text, t.decoy)) {
      errors.push(`${where} 誘答「${t.decoy}」未出現在 transcript`);
    }
    if (!appearsInOrder(s.text, t.correct)) {
      errors.push(`${where} 陷阱的正解「${t.correct}」未出現在 transcript`);
    }
  }

  accentCount.set(s.accent, (accentCount.get(s.accent) ?? 0) + 1);
}

// 口音配比 GB40 / AU20 / US20 / CA10 / NZ10，誤差 ±5%
const TARGET = { 'en-GB': 40, 'en-AU': 20, 'en-US': 20, 'en-CA': 10, 'en-NZ': 10 };
const SEED_STAGE = specs.length < 100;
for (const [accent, target] of Object.entries(TARGET)) {
  const pct = ((accentCount.get(accent) ?? 0) / specs.length) * 100;
  if (Math.abs(pct - target) > 5) {
    (SEED_STAGE ? warnings : errors).push(
      `口音配比 ${accent}：實際 ${pct.toFixed(0)}%，目標 ${target}%`);
  }
}

// 每個 skillTag 至少 15 題
for (const [tag, n] of tagCount) {
  if (n < 15) (SEED_STAGE ? warnings : errors).push(`skillTag「${tag}」只有 ${n} 題，目標 15 題`);
}

console.log(`檢查 ${specs.length} 題`);
console.log(`口音分布：${[...accentCount.entries()].map(([a, n]) => `${a}=${n}`).join(', ')}`);
console.log(`skillTag：${[...tagCount.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}=${n}`).join(', ')}`);

if (SEED_STAGE && warnings.length) {
  console.log(`\n種子階段警告 ${warnings.length} 項（題庫達 100 題後會升級為錯誤）：`);
  for (const w of warnings.slice(0, 3)) console.log(`⚠  ${w}`);
  if (warnings.length > 3) console.log(`⚠  …另有 ${warnings.length - 3} 項`);
}

for (const e of errors) console.error(`✗  ${e}`);
if (errors.length) {
  console.error(`\n${errors.length} 個錯誤，題庫不可用。`);
  process.exit(1);
}
console.log('\n✓ 題庫通過校驗');
