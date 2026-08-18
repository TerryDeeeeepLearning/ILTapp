export type DiffOp = 'same' | 'wrong' | 'missing' | 'extra';
export interface DiffCell { op: DiffOp; user: string; correct: string }

/** 通用 LCS 對齊，回傳可直接渲染的 cell 陣列 */
function align<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): { op: DiffOp; ai: number; bi: number }[] {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const out: { op: DiffOp; ai: number; bi: number }[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) { out.push({ op: 'same', ai: i, bi: j }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ op: 'extra', ai: i, bi: -1 }); i++; }
    else { out.push({ op: 'missing', ai: -1, bi: j }); j++; }
  }
  while (i < n) { out.push({ op: 'extra', ai: i, bi: -1 }); i++; }
  while (j < m) { out.push({ op: 'missing', ai: -1, bi: j }); j++; }

  // 相鄰的 extra + missing 合併成 wrong（同位置寫錯），視覺上更好讀
  const merged: { op: DiffOp; ai: number; bi: number }[] = [];
  for (let k = 0; k < out.length; k++) {
    const cur = out[k], next = out[k + 1];
    if (next && ((cur.op === 'extra' && next.op === 'missing') || (cur.op === 'missing' && next.op === 'extra'))) {
      merged.push({ op: 'wrong', ai: cur.ai >= 0 ? cur.ai : next.ai, bi: cur.bi >= 0 ? cur.bi : next.bi });
      k++;
    } else merged.push(cur);
  }
  return merged;
}

/** 字母級 diff，用於拼字錯誤的視覺標示 */
export function charDiff(user: string, correct: string): DiffCell[] {
  const a = [...user], b = [...correct];
  return align(a, b, (x, y) => x.toLowerCase() === y.toLowerCase()).map(c => ({
    op: c.op,
    user: c.ai >= 0 ? a[c.ai] : '',
    correct: c.bi >= 0 ? b[c.bi] : ''
  }));
}

/** 詞級 diff，用於整句聽寫 */
export function wordDiff(user: string, correct: string): DiffCell[] {
  const strip = (w: string) => w.toLowerCase().replace(/^[^a-z0-9'-]+|[^a-z0-9'-]+$/g, '');
  const a = user.trim().split(/\s+/).filter(Boolean);
  const b = correct.trim().split(/\s+/).filter(Boolean);
  return align(a, b, (x, y) => strip(x) === strip(y)).map(c => ({
    op: c.op,
    user: c.ai >= 0 ? a[c.ai] : '',
    correct: c.bi >= 0 ? b[c.bi] : ''
  }));
}

export function diffAccuracy(cells: DiffCell[]): number {
  if (!cells.length) return 0;
  return cells.filter(c => c.op === 'same').length / cells.length;
}
