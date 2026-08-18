import { describe, it, expect } from 'vitest';
import { snapRate, DETENTS, prevDetent, nextDetent, RATE_MIN, RATE_MAX } from './snap';

describe('語速滑桿磁吸（規格 §7.2）', () => {
  it('範圍限制在 0.5 – 3.0', () => {
    expect(snapRate(0.1, null).value).toBe(RATE_MIN);
    expect(snapRate(9, null).value).toBe(RATE_MAX);
  });

  it('每個刻度都吸得到', () => {
    for (const d of DETENTS) {
      expect(snapRate(d + 0.02, null).value).toBe(d);
      expect(snapRate(d - 0.02, null).value).toBe(d);
    }
  });

  it('刻度外維持自由值，兩位小數', () => {
    const r = snapRate(1.137, null);
    expect(r.snappedTo).toBeNull();
    expect(r.value).toBe(1.14);
  });

  it('新吸上刻度時回報 entered（觸發回饋的唯一時機）', () => {
    expect(snapRate(1.01, null).entered).toBe(true);
  });

  it('已吸附在同一刻度不重複觸發回饋', () => {
    expect(snapRate(1.01, 1.0).entered).toBe(false);
  });

  it('已吸附時小幅移動不脫離（實體 detent 手感）', () => {
    expect(snapRate(1.04, 1.0).value).toBe(1.0);
  });

  it('施力超過門檻才脫離', () => {
    const r = snapRate(1.09, 1.0);
    expect(r.value).not.toBe(1.0);
    expect(r.snappedTo).toBeNull();
  });

  it('鍵盤跳刻度', () => {
    expect(nextDetent(1.0)).toBe(1.25);
    expect(prevDetent(1.0)).toBe(0.9);
    expect(nextDetent(3.0)).toBe(3.0);
    expect(prevDetent(0.5)).toBe(0.5);
  });
});
