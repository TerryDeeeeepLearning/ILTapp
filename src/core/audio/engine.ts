import type { WordTiming } from '@/types';

export type EngineEvent = 'time' | 'play' | 'pause' | 'ended' | 'ready' | 'error';
export type Listener = () => void;

export interface PlaybackSource {
  readonly kind: 'file' | 'speech';
  /** speech 來源無法 seek，UI 需據此隱藏波形與 AB 循環 */
  readonly supportsSeek: boolean;
  readonly duration: number;
  readonly currentTime: number;
  readonly playing: boolean;
  load(): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(t: number): void;
  setRate(r: number): void;
  on(ev: EngineEvent, cb: Listener): () => void;
  destroy(): void;
}

class Emitter {
  private map = new Map<EngineEvent, Set<Listener>>();
  on(ev: EngineEvent, cb: Listener) {
    if (!this.map.has(ev)) this.map.set(ev, new Set());
    this.map.get(ev)!.add(cb);
    return () => { this.map.get(ev)?.delete(cb); };
  }
  emit(ev: EngineEvent) { this.map.get(ev)?.forEach(cb => cb()); }
  clear() { this.map.clear(); }
}

// ── 檔案來源（主軌）────────────────────────────────────────────────────────

export class FileSource implements Readonly<PlaybackSource> {
  readonly kind = 'file' as const;
  readonly supportsSeek = true;
  private el: HTMLAudioElement;
  private em = new Emitter();
  private raf = 0;

  constructor(private src: string) {
    this.el = new Audio();
    this.el.preload = 'auto';
    this.el.setAttribute('playsinline', '');
    this.el.src = src;
    this.el.addEventListener('loadedmetadata', () => this.em.emit('ready'));
    this.el.addEventListener('ended', () => { this.stopTicker(); this.em.emit('ended'); });
    this.el.addEventListener('error', () => this.em.emit('error'));
  }

  get duration() { return Number.isFinite(this.el.duration) ? this.el.duration : 0; }
  get currentTime() { return this.el.currentTime; }
  get playing() { return !this.el.paused && !this.el.ended; }

  load() {
    return new Promise<void>((resolve, reject) => {
      if (this.el.readyState >= 1) return resolve();
      const ok = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error(`音檔載入失敗：${this.src}`)); };
      const cleanup = () => {
        this.el.removeEventListener('loadedmetadata', ok);
        this.el.removeEventListener('error', fail);
      };
      this.el.addEventListener('loadedmetadata', ok);
      this.el.addEventListener('error', fail);
      this.el.load();
    });
  }

  async play() { await this.el.play(); this.em.emit('play'); this.startTicker(); }
  pause() { this.el.pause(); this.stopTicker(); this.em.emit('pause'); }
  seek(t: number) { this.el.currentTime = Math.max(0, Math.min(this.duration, t)); this.em.emit('time'); }
  setRate(r: number) { this.el.playbackRate = r; this.el.defaultPlaybackRate = r; }
  on(ev: EngineEvent, cb: Listener) { return this.em.on(ev, cb); }

  private startTicker() {
    const tick = () => { this.em.emit('time'); this.raf = requestAnimationFrame(tick); };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(tick);
  }
  private stopTicker() { cancelAnimationFrame(this.raf); this.raf = 0; }

  destroy() { this.stopTicker(); this.el.pause(); this.el.src = ''; this.em.clear(); }
}

// ── 系統語音來源（降級軌）──────────────────────────────────────────────────
// 規格 §2.3：僅在尚未生成 MP3 時使用。無法 seek、無波形、語速三檔。

const IOS_VOICE_PREFERENCE: Record<string, string[]> = {
  'en-GB': ['Daniel', 'Kate', 'Serena', 'Google UK English Male'],
  'en-AU': ['Karen', 'Lee', 'Google UK English Female'],
  'en-US': ['Samantha', 'Alex', 'Google US English'],
  'en-CA': ['Samantha', 'Alex'],
  'en-NZ': ['Karen', 'Daniel']
};

export function pickVoice(accent: string): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  for (const name of IOS_VOICE_PREFERENCE[accent] ?? []) {
    const v = voices.find(x => x.name.includes(name));
    if (v) return v;
  }
  return voices.find(v => v.lang.replace('_', '-') === accent)
    ?? voices.find(v => v.lang.startsWith('en')) ?? null;
}

export class SpeechSource implements Readonly<PlaybackSource> {
  readonly kind = 'speech' as const;
  readonly supportsSeek = false;
  private em = new Emitter();
  private rate = 1;
  private startedAt = 0;
  private elapsed = 0;
  private raf = 0;
  private _duration = 0;
  private _playing = false;

  constructor(private text: string, private accent: string, estimatedDurationMs: number) {
    this._duration = estimatedDurationMs / 1000;
  }

  get duration() { return this._duration / this.rate; }
  get currentTime() { return this.elapsed / 1000; }
  get playing() { return this._playing; }

  async load() {
    if (typeof speechSynthesis === 'undefined') throw new Error('此裝置不支援系統語音');
    if (!speechSynthesis.getVoices().length) {
      await new Promise<void>(res => {
        const t = setTimeout(res, 800);
        speechSynthesis.addEventListener('voiceschanged', () => { clearTimeout(t); res(); }, { once: true });
      });
    }
    this.em.emit('ready');
  }

  async play() {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(this.text);
    const v = pickVoice(this.accent);
    if (v) u.voice = v;
    u.lang = this.accent;
    u.rate = Math.max(0.5, Math.min(2, this.rate));
    u.onend = () => { this._playing = false; this.stopTicker(); this.elapsed = this._duration; this.em.emit('ended'); };
    u.onerror = () => { this._playing = false; this.stopTicker(); this.em.emit('error'); };
    this.elapsed = 0;
    this.startedAt = performance.now();
    this._playing = true;
    speechSynthesis.speak(u);
    this.em.emit('play');
    this.startTicker();
  }

  pause() {
    speechSynthesis.cancel();
    this._playing = false;
    this.stopTicker();
    this.em.emit('pause');
  }

  /** 不支援 seek：任何 seek 請求都從頭播（等同重播本句） */
  seek(_t: number) { void _t; if (this._playing) void this.play(); else { this.elapsed = 0; this.em.emit('time'); } }
  setRate(r: number) { this.rate = r; }
  on(ev: EngineEvent, cb: Listener) { return this.em.on(ev, cb); }

  private startTicker() {
    const tick = () => {
      this.elapsed = (performance.now() - this.startedAt) * this.rate;
      this.em.emit('time');
      this.raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(tick);
  }
  private stopTicker() { cancelAnimationFrame(this.raf); this.raf = 0; }

  destroy() { this.stopTicker(); speechSynthesis.cancel(); this.em.clear(); }
}

// ── 時間戳 ────────────────────────────────────────────────────────────────

/**
 * 沒有 Edge TTS 時間戳時的估算：依詞長比例分配，長詞給較多時間，
 * 標點後加停頓。誤差可接受於降級模式，正式模式一律用生成的 timings。
 */
export function estimateTimings(text: string, durationSec: number): WordTiming[] {
  const tokens: { word: string; charStart: number; charEnd: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) tokens.push({ word: m[0], charStart: m.index, charEnd: m.index + m[0].length });
  if (!tokens.length) return [];

  const weights = tokens.map(t => {
    const letters = t.word.replace(/[^A-Za-z0-9']/g, '').length || 1;
    const pause = /[,;:.!?]$/.test(t.word) ? 2.2 : 0;
    return letters + 1.2 + pause;
  });
  const total = weights.reduce((a, b) => a + b, 0);

  let cursor = 0;
  return tokens.map((t, i) => {
    const dur = (weights[i] / total) * durationSec;
    const start = cursor;
    cursor += dur;
    return { word: t.word, start, end: cursor, charStart: t.charStart, charEnd: t.charEnd };
  });
}

export function estimateDurationMs(text: string, wpm = 150): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1200, (words / wpm) * 60_000);
}

export function activeWordIndex(timings: WordTiming[], t: number): number {
  for (let i = timings.length - 1; i >= 0; i--) if (t >= timings[i].start) return i;
  return -1;
}
