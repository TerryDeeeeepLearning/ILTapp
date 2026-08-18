/** Academic Listening 原始分 → 帶分（概估，實際依考場版本浮動） */
const TABLE: [number, number][] = [
  [39, 9.0], [37, 8.5], [35, 8.0], [32, 7.5], [30, 7.0], [26, 6.5],
  [23, 6.0], [18, 5.5], [16, 5.0], [13, 4.5], [11, 4.0], [8, 3.5],
  [6, 3.0], [4, 2.5], [0, 2.0]
];

export function toBandScore(raw: number): number {
  const r = Math.max(0, Math.min(40, Math.round(raw)));
  for (const [min, band] of TABLE) if (r >= min) return band;
  return 2.0;
}

/** 距離下一個帶分還差幾題，用於激勵文案 */
export function pointsToNextBand(raw: number): { needed: number; nextBand: number } | null {
  const r = Math.max(0, Math.min(40, Math.round(raw)));
  const current = toBandScore(r);
  for (let i = r + 1; i <= 40; i++) {
    if (toBandScore(i) > current) return { needed: i - r, nextBand: toBandScore(i) };
  }
  return null;
}
