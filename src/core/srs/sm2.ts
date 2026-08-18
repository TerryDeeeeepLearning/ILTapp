import type { SrsCard } from '@/types';

export const DAY = 86_400_000;

export function newCard(itemId: string, blankId: string): SrsCard {
  return {
    id: `${itemId}:${blankId}`,
    itemId, blankId,
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    dueAt: Date.now(),
    lapses: 0,
    forcedTomorrow: false,
    status: 'new'
  };
}

export interface ScheduleInput {
  card: SrsCard;
  quality: 0 | 1 | 2 | 3 | 4 | 5;
  /** 使用 L3 公布解答 → 強制排入隔日（規格 §7.4） */
  forcedTomorrow: boolean;
  now?: number;
}

export function schedule({ card, quality, forcedTomorrow, now = Date.now() }: ScheduleInput): SrsCard {
  const next: SrsCard = { ...card };

  if (quality < 3) {
    next.repetitions = 0;
    next.intervalDays = 1;
    next.lapses = card.lapses + 1;
    next.status = next.lapses >= 5 ? 'leech' : 'learning';
  } else {
    const ef = card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    next.easeFactor = Math.min(2.8, Math.max(1.3, Math.round(ef * 1000) / 1000));
    next.repetitions = card.repetitions + 1;
    next.intervalDays =
      next.repetitions === 1 ? 1 :
      next.repetitions === 2 ? 6 :
      Math.round(card.intervalDays * next.easeFactor);
    next.status = next.intervalDays >= 60 && quality >= 4 ? 'mastered' : 'review';
  }

  // L3 覆寫：無論 SM-2 算出什麼，明天一定再見
  if (forcedTomorrow) {
    next.intervalDays = 1;
    next.forcedTomorrow = true;
    if (next.status === 'mastered' || next.status === 'review') next.status = 'learning';
  } else {
    next.forcedTomorrow = false;
  }

  next.dueAt = now + next.intervalDays * DAY;
  return next;
}

/** 到期卡排序：leech 優先 → 逾期最久 → 新卡 */
export function reviewOrder(cards: SrsCard[], now = Date.now()): SrsCard[] {
  return [...cards]
    .filter(c => c.dueAt <= now)
    .sort((a, b) => {
      if (a.status === 'leech' && b.status !== 'leech') return -1;
      if (b.status === 'leech' && a.status !== 'leech') return 1;
      return a.dueAt - b.dueAt;
    });
}
