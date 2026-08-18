import type { Accent, ExerciseItem, SectionNo, SkillTag, WordTiming } from '@/types';
import { estimateDurationMs } from '@/core/audio/engine';
import RAW from './core-starter.json';

/**
 * 題庫的單一真實來源是 core-starter.json —— App 與 scripts/generate-audio.mjs
 * 讀的是同一份檔案，避免文本與音檔對不上。
 */
export interface SeedSpec {
  id: string;
  text: string;
  accent: Accent;
  section: SectionNo;
  difficulty: 1 | 2 | 3 | 4 | 5;
  topic: string;
  gaps: {
    answer: string;
    /** 原文中的字面形式，必須逐字出現在 text 裡 */
    surface: string;
    maxWords?: number;
    numeric?: boolean;
    tags: SkillTag[];
  }[];
  traps?: { decoy: string; correct: string; atSecond: number }[];
}

const VOICE_BY_ACCENT: Record<Accent, string> = {
  'en-GB': 'en-GB-SoniaNeural',
  'en-AU': 'en-AU-NatashaNeural',
  'en-US': 'en-US-JennyNeural',
  'en-CA': 'en-CA-ClaraNeural',
  'en-NZ': 'en-NZ-MollyNeural'
};

/**
 * 把每個 gap 的 surface 定位到 transcript 的字元區間。
 * 依序搜尋，避免同一個詞重複出現時全部指到第一個。
 */
function locateGaps(spec: SeedSpec) {
  const lower = spec.text.toLowerCase();
  let cursor = 0;
  return spec.gaps.map((g, i) => {
    const at = lower.indexOf(g.surface.toLowerCase(), cursor);
    if (at < 0) {
      // 題庫校驗會擋掉這種情況；真的發生時寧可拋錯也不要靜靜挖不出空格
      throw new Error(`[${spec.id}] surface「${g.surface}」不在 transcript 中`);
    }
    cursor = at + g.surface.length;
    return {
      id: `g${i + 1}`,
      answers: [g.answer],
      surface: spec.text.slice(at, at + g.surface.length),
      charStart: at,
      charEnd: at + g.surface.length,
      maxWords: g.maxWords ?? 1,
      numeric: g.numeric ?? false,
      audioStart: 0,
      audioEnd: 0,
      skillTags: g.tags
    };
  });
}

function build(spec: SeedSpec): ExerciseItem {
  const durationMs = estimateDurationMs(spec.text, 145);
  return {
    id: spec.id,
    packId: 'core-starter',
    mode: 'dictation',
    section: spec.section,
    title: spec.topic,
    topic: spec.topic,
    transcript: spec.text,
    primaryAccent: spec.accent,
    difficulty: spec.difficulty,
    source: 'seed',
    createdAt: 0,
    speakers: [{
      id: 'A', label: 'Speaker', accent: spec.accent,
      voice: VOICE_BY_ACCENT[spec.accent], gender: 'F', rateAdjust: 0
    }],
    traps: spec.traps,
    audio: {
      id: spec.id, packId: 'core-starter',
      // null → 執行期降級為系統語音；hydrateAudioPack() 找到 MP3 後會填入
      src: null, durationMs, bytes: 0, timings: [], sentenceBoundaries: [0]
    },
    blanks: [
      // blank[0] 恆為整句，供「完全隱藏」模式使用
      {
        id: 'full', answers: [spec.text], surface: spec.text,
        charStart: 0, charEnd: spec.text.length,
        maxWords: 99, numeric: false,
        audioStart: 0, audioEnd: durationMs / 1000,
        skillTags: [...new Set(spec.gaps.flatMap(g => g.tags))]
      },
      ...locateGaps(spec)
    ]
  };
}

export const SEED_DICTATION: ExerciseItem[] = (RAW as SeedSpec[]).map(build);

// ── 音檔包熱升級（規格 §2.3 雙軌制）───────────────────────────────────────

interface PackEntry {
  id: string;
  file: string;
  durationMs: number;
  bytes: number;
  timings: WordTiming[];
  sentenceBoundaries: number[];
}
interface PackManifest { packId: string; generatedAt: string; items: PackEntry[] }

let hydrated = false;

/**
 * 啟動時嘗試載入 public/audio/{pack}/pack.json。
 * 找到就把 MP3 掛上去（完整功能），找不到就維持系統語音降級。
 */
export async function hydrateAudioPack(packId = 'core-starter'): Promise<boolean> {
  if (hydrated) return true;
  try {
    const res = await fetch(`./audio/${packId}/pack.json`, { cache: 'no-cache' });
    if (!res.ok) return false;
    const manifest = (await res.json()) as PackManifest;
    const byId = new Map(manifest.items.map(e => [e.id, e]));
    let n = 0;
    for (const item of SEED_DICTATION) {
      const e = byId.get(item.id);
      if (!e) continue;
      item.audio = {
        ...item.audio,
        src: `./audio/${packId}/${e.file}`,
        durationMs: e.durationMs,
        bytes: e.bytes,
        timings: e.timings ?? [],
        sentenceBoundaries: e.sentenceBoundaries?.length ? e.sentenceBoundaries : [0]
      };
      for (const b of item.blanks) if (b.id === 'full') b.audioEnd = e.durationMs / 1000;
      n++;
    }
    hydrated = n > 0;
    return hydrated;
  } catch {
    return false;
  }
}

export function isAudioPackLoaded(): boolean { return hydrated; }

export function pickItems(opts: {
  count: number; accents?: Accent[]; difficulty?: [number, number];
}): ExerciseItem[] {
  const pool = SEED_DICTATION.filter(i =>
    (!opts.accents?.length || opts.accents.includes(i.primaryAccent)) &&
    (!opts.difficulty || (i.difficulty >= opts.difficulty[0] && i.difficulty <= opts.difficulty[1]))
  );
  return [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(opts.count, pool.length));
}
