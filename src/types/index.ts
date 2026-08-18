// ── 內容層 ────────────────────────────────────────────────────────────────

export type Accent = 'en-GB' | 'en-AU' | 'en-US' | 'en-CA' | 'en-NZ';
export type SectionNo = 1 | 2 | 3 | 4;

export type ExerciseMode =
  | 'dictation' | 'formfill' | 'paraphrase' | 'trap'
  | 'map' | 'matching' | 'lecture' | 'accent' | 'mock';

export type SkillTag =
  | 'spelling-name' | 'number-phone' | 'number-date' | 'number-money'
  | 'number-general' | 'address' | 'paraphrase' | 'self-correction'
  | 'distractor' | 'connected-speech' | 'academic-vocab' | 'signposting';

export interface Speaker {
  id: string;
  label: string;
  accent: Accent;
  voice: string;
  gender: 'M' | 'F';
  rateAdjust: number;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
  charStart: number;
  charEnd: number;
}

export interface AudioAsset {
  id: string;
  packId: string;
  /** null = 尚未生成 MP3，執行期改用系統語音（降級） */
  src: string | null;
  durationMs: number;
  bytes: number;
  timings: WordTiming[];
  sentenceBoundaries: number[];
}

export interface Blank {
  id: string;
  /** 判分接受的答案形式，answers[0] 為主答案 */
  answers: string[];
  /**
   * 這個空格在 transcript 中的**字面**形式。
   * 與 answers 刻意分離：原文說 "two hundred and fifty"，作答寫 "250"。
   * 挖空渲染一律靠這個欄位定位，不可用 answers 去 indexOf。
   */
  surface: string;
  /** surface 在 transcript 中的字元區間，建題時算好 */
  charStart: number;
  charEnd: number;
  maxWords: number;
  numeric: boolean;
  hintPos?: string;
  audioStart: number;
  audioEnd: number;
  skillTags: SkillTag[];
}

export interface Choice {
  id: string; label: string; correct: boolean;
  rationale: string; mentionedAt?: number;
}

export interface MapConfig {
  imageSrc: string;
  dropZones: { id: string; x: number; y: number; w: number; h: number; label: string }[];
  labels: { id: string; text: string; correctZoneId: string }[];
}

export interface ExerciseItem {
  id: string;
  packId: string;
  mode: ExerciseMode;
  section: SectionNo;
  title: string;
  topic: string;
  audio: AudioAsset;
  transcript: string;
  speakers: Speaker[];
  primaryAccent: Accent;
  difficulty: 1 | 2 | 3 | 4 | 5;
  blanks: Blank[];
  choices?: Choice[];
  mapConfig?: MapConfig;
  traps?: { decoy: string; correct: string; atSecond: number }[];
  source: 'seed' | 'ai-generated';
  createdAt: number;
}

// ── 學習紀錄層 ────────────────────────────────────────────────────────────

export type FailureReason =
  | 'not-heard' | 'heard-misspelled' | 'unknown-word'
  | 'too-slow' | 'misunderstood' | 'trap' | 'correct';

export type HintLevel = 0 | 1 | 2 | 3;

export interface AttemptRecord {
  id: string;
  itemId: string;
  blankId: string;
  mode: ExerciseMode;
  userAnswer: string;
  isCorrect: boolean;
  score: number;
  replayCount: number;
  hintLevelUsed: HintLevel;
  timeSpentMs: number;
  failureReason: FailureReason | null;
  autoReason: FailureReason | null;
  accent: Accent;
  skillTags: SkillTag[];
  playbackRate: number;
  timestamp: number;
}

export type SrsStatus = 'new' | 'learning' | 'review' | 'mastered' | 'leech';

export interface SrsCard {
  id: string;
  itemId: string;
  blankId: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueAt: number;
  lapses: number;
  forcedTomorrow: boolean;
  status: SrsStatus;
}

export interface VocabEntry {
  word: string;
  contextSentence: string;
  itemId: string;
  addedAt: number;
  note?: string;
}

export interface MockExamResult {
  id: string;
  itemIds: string[];
  answers: Record<string, string>;
  rawScore: number;
  bandScore: number;
  sectionScores: [number, number, number, number];
  durationMs: number;
  startedAt: number;
  perAccentAccuracy: Partial<Record<Accent, number>>;
}

export type RevealMode = 'hidden' | 'gapped' | 'shown';

export interface UserSettings {
  locale: 'zh-TW' | 'en';
  theme: 'dark' | 'light';
  fontScale: number;
  colorBlindSafe: boolean;
  defaultRate: number;
  hapticsEnabled: boolean;
  soundFeedbackEnabled: boolean;
  autoAdvance: boolean;
  strictHyphen: boolean;
  askFailureReason: boolean;
  minimalMode: boolean;
  claudeApiKey: string | null;
  dailyGoalMinutes: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  locale: 'zh-TW',
  theme: 'dark',
  fontScale: 1,
  colorBlindSafe: false,
  defaultRate: 1,
  hapticsEnabled: true,
  soundFeedbackEnabled: true,
  autoAdvance: false,
  strictHyphen: true,
  askFailureReason: true,
  minimalMode: false,
  claudeApiKey: null,
  dailyGoalMinutes: 20
};

export const ACCENT_LABEL: Record<Accent, string> = {
  'en-GB': '英式', 'en-AU': '澳式', 'en-US': '美式',
  'en-CA': '加式', 'en-NZ': '紐式'
};

export const ACCENT_FLAG: Record<Accent, string> = {
  'en-GB': '🇬🇧', 'en-AU': '🇦🇺', 'en-US': '🇺🇸',
  'en-CA': '🇨🇦', 'en-NZ': '🇳🇿'
};
