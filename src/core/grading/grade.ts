import type { Blank, FailureReason, HintLevel, ExerciseItem } from '@/types';
import { matches, normalize, countWords, type NormalizeOptions } from './normalize';
import { levenshtein, isTransposition } from './levenshtein';
import { charDiff, wordDiff, type DiffCell } from './diff';

export interface GradeContext {
  replayCount: number;
  hintLevelUsed: HintLevel;
  timeSpentMs: number;
  /** 該題型的平均作答時間，用於推測 too-slow */
  avgTimeMs: number;
  strictHyphen: boolean;
  traps?: ExerciseItem['traps'];
  /** 整句聽寫模式：diff 用詞級而非字母級 */
  sentenceMode?: boolean;
}

export interface GradeResult {
  isCorrect: boolean;
  /** 0–1，含提示扣分 */
  score: number;
  multiplier: number;
  editDistance: number;
  autoReason: FailureReason;
  diff: DiffCell[];
  /** 失敗原因為字數超限時填入 */
  rejectedBy: 'word-limit' | null;
  /** 是否為單純的字母顛倒，UI 可給更精準的提示 */
  transposed: boolean;
}

export function hintMultiplier(hintLevel: HintLevel, replayCount: number): number {
  let m = 1;
  // L0：前 2 次重播免費，第 3 次起每次 −10%，下限 0.5
  if (replayCount > 2) m -= 0.1 * (replayCount - 2);
  m = Math.max(m, 0.5);
  if (hintLevel >= 1) m = Math.min(m, 0.75);
  if (hintLevel >= 2) m = Math.min(m, 0.5);
  if (hintLevel >= 3) m = 0;
  return Math.round(m * 100) / 100;
}

export function gradeBlank(blank: Blank, userAnswer: string, ctx: GradeContext): GradeResult {
  const opts: NormalizeOptions = {
    strictHyphen: ctx.strictHyphen,
    numeric: blank.numeric,
    skillTags: blank.skillTags
  };

  const multiplier = hintMultiplier(ctx.hintLevelUsed, ctx.replayCount);
  const primary = blank.answers[0] ?? '';
  const normUser = normalize(userAnswer, opts);
  const normPrimary = normalize(primary, opts);
  const diff = ctx.sentenceMode
    ? wordDiff(userAnswer.trim(), primary)
    : charDiff(userAnswer.trim(), primary);

  // 字數超限 → 直接判錯（真實考試規則）
  if (userAnswer.trim() && countWords(userAnswer) > blank.maxWords) {
    return {
      isCorrect: false, score: 0, multiplier, editDistance: 99,
      autoReason: 'misunderstood', diff, rejectedBy: 'word-limit', transposed: false
    };
  }

  const isCorrect = normUser.length > 0 && matches(userAnswer, blank.answers, opts);
  const editDistance = Math.min(
    ...blank.answers.map(a => levenshtein(normUser, normalize(a, opts)))
  );
  const transposed = blank.answers.some(a => isTransposition(normUser, normalize(a, opts)));

  return {
    isCorrect,
    score: isCorrect ? multiplier : 0,
    multiplier,
    editDistance,
    autoReason: inferReason({ isCorrect, normUser, normPrimary, editDistance, ctx }),
    diff,
    rejectedBy: null,
    transposed
  };
}

function inferReason(a: {
  isCorrect: boolean; normUser: string; normPrimary: string;
  editDistance: number; ctx: GradeContext;
}): FailureReason {
  if (a.isCorrect) return 'correct';
  if (!a.normUser) return 'not-heard';

  const decoys = (a.ctx.traps ?? []).map(t => t.decoy.toLowerCase().trim());
  if (decoys.includes(a.normUser)) return 'trap';

  // 拼字錯：編輯距離小且長度接近
  const lenRatio = a.normUser.length / Math.max(1, a.normPrimary.length);
  if (a.editDistance <= 2 && lenRatio > 0.6 && lenRatio < 1.6) return 'heard-misspelled';

  if (a.ctx.avgTimeMs > 0 && a.ctx.timeSpentMs > a.ctx.avgTimeMs * 2) return 'too-slow';
  return 'misunderstood';
}

/** SM-2 質量分推導（規格 §10） */
export function qualityFrom(res: GradeResult, ctx: GradeContext): 0 | 1 | 2 | 3 | 4 | 5 {
  if (ctx.hintLevelUsed >= 3) return 0;
  if (res.isCorrect) {
    if (ctx.hintLevelUsed === 0 && ctx.replayCount <= 1) return 5;
    if (ctx.hintLevelUsed === 0 && ctx.replayCount <= 2) return 4;
    return 3;
  }
  return res.editDistance <= 2 ? 2 : 1;
}
