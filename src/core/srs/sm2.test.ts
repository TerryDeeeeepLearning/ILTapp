import { describe, it, expect } from 'vitest';
import { newCard, schedule, reviewOrder, DAY } from './sm2';

describe('SM-2', () => {
  it('第一次答對間隔 1 天', () => {
    const c = schedule({ card: newCard('i', 'b'), quality: 5, forcedTomorrow: false });
    expect(c.intervalDays).toBe(1);
    expect(c.repetitions).toBe(1);
  });

  it('第二次答對間隔 6 天', () => {
    let c = schedule({ card: newCard('i', 'b'), quality: 5, forcedTomorrow: false });
    c = schedule({ card: c, quality: 5, forcedTomorrow: false });
    expect(c.intervalDays).toBe(6);
  });

  it('答錯時重置並累加 lapses', () => {
    let c = schedule({ card: newCard('i', 'b'), quality: 5, forcedTomorrow: false });
    c = schedule({ card: c, quality: 1, forcedTomorrow: false });
    expect(c.repetitions).toBe(0);
    expect(c.intervalDays).toBe(1);
    expect(c.lapses).toBe(1);
  });

  it('lapses 達 5 標記為 leech', () => {
    let c = newCard('i', 'b');
    for (let i = 0; i < 5; i++) c = schedule({ card: c, quality: 1, forcedTomorrow: false });
    expect(c.status).toBe('leech');
  });

  it('公布解答強制排入隔日，覆寫 SM-2 結果', () => {
    let c = newCard('i', 'b');
    c = schedule({ card: c, quality: 5, forcedTomorrow: false });
    c = schedule({ card: c, quality: 5, forcedTomorrow: false }); // 本應 6 天
    const forced = schedule({ card: c, quality: 0, forcedTomorrow: true });
    expect(forced.intervalDays).toBe(1);
    expect(forced.forcedTomorrow).toBe(true);
  });

  it('easeFactor 夾在 1.3 – 2.8', () => {
    let c = newCard('i', 'b');
    for (let i = 0; i < 20; i++) c = schedule({ card: c, quality: 5, forcedTomorrow: false });
    expect(c.easeFactor).toBeLessThanOrEqual(2.8);
    expect(c.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('複習排序：leech 優先，其次逾期最久', () => {
    const now = Date.now();
    const a = { ...newCard('a', 'b'), dueAt: now - DAY, status: 'review' as const };
    const b = { ...newCard('b', 'b'), dueAt: now - 5 * DAY, status: 'review' as const };
    const l = { ...newCard('l', 'b'), dueAt: now - 1000, status: 'leech' as const };
    const future = { ...newCard('f', 'b'), dueAt: now + DAY };
    const ordered = reviewOrder([a, b, l, future], now);
    expect(ordered.map(c => c.itemId)).toEqual(['l', 'b', 'a']);
  });
});
