import { create } from 'zustand';
import type {
  AttemptRecord, ExerciseItem, FailureReason, HintLevel, RevealMode
} from '@/types';
import type { GradeResult } from '@/core/grading/grade';

export interface SessionConfig {
  mode: 'dictation';
  reveal: RevealMode;
  count: number;
  accents: string[];
  difficulty: [number, number];
}

/**
 * 一題可能有多個空格（挖空模式），因此所有作答狀態都以 blankId 為 key。
 * 隱藏/顯示模式只會有一個 'full' 空格。
 */
export interface QuestionState {
  item: ExerciseItem;
  blankIds: string[];
  answers: Record<string, string>;
  hintLevels: Record<string, HintLevel>;
  results: Record<string, GradeResult>;
  reasons: Record<string, FailureReason>;
  activeBlankId: string;
  replayCount: number;
  startedAt: number;
  submittedAt: number | null;
}

interface SessionStore {
  config: SessionConfig | null;
  queue: QuestionState[];
  index: number;
  finishedAt: number | null;
  attempts: AttemptRecord[];

  begin(config: SessionConfig, items: ExerciseItem[]): void;
  setAnswer(blankId: string, v: string): void;
  setActive(blankId: string): void;
  setHintLevel(blankId: string, l: HintLevel): void;
  bumpReplay(n: number): void;
  submit(results: Record<string, GradeResult>, attempts: AttemptRecord[]): void;
  setReason(blankId: string, r: FailureReason): void;
  advance(): boolean;
  reset(): void;
}

function blankIdsFor(item: ExerciseItem, reveal: RevealMode): string[] {
  if (reveal !== 'gapped') return ['full'];
  const gaps = item.blanks.filter(b => b.id !== 'full').map(b => b.id);
  return gaps.length ? gaps : ['full'];
}

export const useSession = create<SessionStore>((set, get) => ({
  config: null,
  queue: [],
  index: 0,
  finishedAt: null,
  attempts: [],

  begin(config, items) {
    set({
      config, index: 0, finishedAt: null, attempts: [],
      queue: items.map(item => {
        const blankIds = blankIdsFor(item, config.reveal);
        return {
          item, blankIds,
          answers: Object.fromEntries(blankIds.map(id => [id, ''])),
          hintLevels: Object.fromEntries(blankIds.map(id => [id, 0 as HintLevel])),
          results: {}, reasons: {},
          activeBlankId: blankIds[0],
          replayCount: 0, startedAt: Date.now(), submittedAt: null
        };
      })
    });
  },

  setAnswer(blankId, v) { patch(set, get, q => ({ answers: { ...q.answers, [blankId]: v } })); },
  setActive(blankId) { patch(set, get, () => ({ activeBlankId: blankId })); },

  setHintLevel(blankId, l) {
    patch(set, get, q => ({
      hintLevels: {
        ...q.hintLevels,
        [blankId]: Math.max(q.hintLevels[blankId] ?? 0, l) as HintLevel
      }
    }));
  },

  bumpReplay(n) { patch(set, get, () => ({ replayCount: n })); },

  submit(results, newAttempts) {
    patch(set, get, () => ({ results, submittedAt: Date.now() }));
    set({ attempts: [...get().attempts, ...newAttempts] });
  },

  setReason(blankId, r) {
    patch(set, get, q => ({ reasons: { ...q.reasons, [blankId]: r } }));
    const { queue, index, attempts } = get();
    const itemId = queue[index]?.item.id;
    set({
      attempts: attempts.map(a =>
        a.itemId === itemId && a.blankId === blankId ? { ...a, failureReason: r } : a)
    });
  },

  advance() {
    const { index, queue } = get();
    if (index + 1 >= queue.length) { set({ finishedAt: Date.now() }); return false; }
    set({ index: index + 1 });
    return true;
  },

  reset() { set({ config: null, queue: [], index: 0, finishedAt: null, attempts: [] }); }
}));

function patch(
  set: (p: Partial<SessionStore>) => void,
  get: () => SessionStore,
  fn: (q: QuestionState) => Partial<QuestionState>
) {
  const { queue, index } = get();
  if (!queue[index]) return;
  const next = [...queue];
  next[index] = { ...next[index], ...fn(next[index]) };
  set({ queue: next });
}
