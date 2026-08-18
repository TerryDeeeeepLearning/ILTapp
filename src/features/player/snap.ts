/** 規格 §7.2：磁吸刻度 */
export const DETENTS = [0.5, 0.75, 0.9, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];
export const RATE_MIN = 0.5;
export const RATE_MAX = 3.0;
const SNAP_IN = 0.03;   // 進入吸附的距離
const SNAP_OUT = 0.06;  // 脫離吸附需要的施力

export interface SnapResult {
  value: number;
  /** 目前吸附在哪個刻度上，null 表示自由值 */
  snappedTo: number | null;
  /** 這次是否「新吸上」某個刻度 —— 觸發回饋的唯一時機 */
  entered: boolean;
}

/**
 * 純函式的滑桿吸附邏輯：已吸附時需明顯施力才脫離，模擬實體 detent。
 * 抽成純函式是為了能被測試 —— 這是使用者唯一能「感覺到」的互動，不能只靠手測。
 */
export function snapRate(raw: number, currentSnap: number | null): SnapResult {
  const v = Math.max(RATE_MIN, Math.min(RATE_MAX, raw));

  if (currentSnap !== null) {
    if (Math.abs(v - currentSnap) < SNAP_OUT) {
      return { value: currentSnap, snappedTo: currentSnap, entered: false };
    }
  }

  const nearest = DETENTS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  if (Math.abs(v - nearest) <= SNAP_IN) {
    return { value: nearest, snappedTo: nearest, entered: currentSnap !== nearest };
  }
  return { value: Math.round(v * 100) / 100, snappedTo: null, entered: false };
}

export function prevDetent(v: number): number {
  return [...DETENTS].reverse().find(d => d < v - 0.001) ?? DETENTS[0];
}
export function nextDetent(v: number): number {
  return DETENTS.find(d => d > v + 0.001) ?? DETENTS[DETENTS.length - 1];
}
