import Dexie, { type Table } from 'dexie';
import type {
  AttemptRecord, SrsCard, VocabEntry, MockExamResult, ExerciseItem, UserSettings
} from '@/types';

export interface KV { key: string; value: unknown }

export class IltDb extends Dexie {
  items!: Table<ExerciseItem, string>;
  attempts!: Table<AttemptRecord, string>;
  srs!: Table<SrsCard, string>;
  mocks!: Table<MockExamResult, string>;
  vocab!: Table<VocabEntry, string>;
  kv!: Table<KV, string>;

  constructor() {
    super('ilt');
    this.version(1).stores({
      items: 'id, packId, mode, section, primaryAccent, difficulty',
      attempts: 'id, itemId, blankId, timestamp, accent, mode, isCorrect',
      srs: 'id, dueAt, status, itemId',
      mocks: 'id, startedAt',
      vocab: 'word, addedAt',
      kv: 'key'
    });
  }
}

export const db = new IltDb();

export async function exportAll(): Promise<string> {
  const [attempts, srs, mocks, vocab, kv] = await Promise.all([
    db.attempts.toArray(), db.srs.toArray(), db.mocks.toArray(),
    db.vocab.toArray(), db.kv.toArray()
  ]);
  return JSON.stringify(
    { schema: 1, exportedAt: Date.now(), attempts, srs, mocks, vocab, kv },
    null, 2
  );
}

export async function importAll(json: string): Promise<{ merged: number }> {
  const data = JSON.parse(json) as Awaited<ReturnType<typeof parseShape>>;
  let merged = 0;
  await db.transaction('rw', db.attempts, db.srs, db.mocks, db.vocab, db.kv, async () => {
    for (const a of data.attempts ?? []) { await db.attempts.put(a); merged++; }
    for (const c of data.srs ?? []) {
      const existing = await db.srs.get(c.id);
      // 衝突以較新者為準
      if (!existing || c.dueAt > existing.dueAt) { await db.srs.put(c); merged++; }
    }
    for (const m of data.mocks ?? []) { await db.mocks.put(m); merged++; }
    for (const v of data.vocab ?? []) { await db.vocab.put(v); merged++; }
    for (const k of data.kv ?? []) { await db.kv.put(k); merged++; }
  });
  return { merged };
}

// 只為型別推導存在
function parseShape() {
  return {} as {
    attempts?: AttemptRecord[]; srs?: SrsCard[]; mocks?: MockExamResult[];
    vocab?: VocabEntry[]; kv?: KV[];
  };
}

export async function resetAll(): Promise<void> {
  await Promise.all([
    db.attempts.clear(), db.srs.clear(), db.mocks.clear(), db.vocab.clear(), db.kv.clear()
  ]);
}

export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted?.()) return true;
  return navigator.storage.persist();
}

export async function storageEstimate(): Promise<{ usage: number; quota: number }> {
  const e = await navigator.storage?.estimate?.();
  return { usage: e?.usage ?? 0, quota: e?.quota ?? 0 };
}

export const SETTINGS_KEY = 'settings';
export async function loadSettings(): Promise<Partial<UserSettings> | null> {
  const row = await db.kv.get(SETTINGS_KEY);
  return (row?.value as Partial<UserSettings>) ?? null;
}
export async function saveSettings(value: UserSettings): Promise<void> {
  await db.kv.put({ key: SETTINGS_KEY, value });
}
