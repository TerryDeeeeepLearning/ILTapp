import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExerciseItem, WordTiming } from '@/types';
import {
  FileSource, SpeechSource, estimateTimings, estimateDurationMs,
  activeWordIndex, type PlaybackSource
} from './engine';

export interface PlaybackState {
  ready: boolean;
  error: string | null;
  playing: boolean;
  time: number;
  duration: number;
  rate: number;
  replayCount: number;
  degraded: boolean;      // 使用系統語音
  supportsSeek: boolean;
  timings: WordTiming[];
  activeWord: number;
  loopA: number | null;
  loopB: number | null;
}

export interface PlaybackApi extends PlaybackState {
  toggle(): void;
  play(): void;
  pause(): void;
  seek(t: number): void;
  replaySentence(): void;
  prevSentence(): void;
  nextSentence(): void;
  nudge(sec: number): void;
  setRate(r: number): void;
  cycleLoop(): void;
  clearLoop(): void;
  resetReplayCount(): void;
}

export function usePlayback(item: ExerciseItem | null, opts: { initialRate: number; lockRate?: boolean }): PlaybackApi {
  const srcRef = useRef<PlaybackSource | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(opts.initialRate);
  const [replayCount, setReplayCount] = useState(0);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);

  const degraded = !item?.audio.src;

  const timings = useMemo<WordTiming[]>(() => {
    if (!item) return [];
    if (item.audio.timings.length) return item.audio.timings;
    const d = (item.audio.durationMs || estimateDurationMs(item.transcript)) / 1000;
    return estimateTimings(item.transcript, d);
  }, [item]);

  const boundaries = useMemo(() => {
    if (!item) return [0];
    if (item.audio.sentenceBoundaries.length) return item.audio.sentenceBoundaries;
    const b = [0];
    timings.forEach((w, i) => {
      if (/[.!?]$/.test(w.word) && i < timings.length - 1) b.push(timings[i + 1].start);
    });
    return b;
  }, [item, timings]);

  useEffect(() => {
    if (!item) return;
    setReady(false); setError(null); setTime(0); setPlaying(false);
    setLoopA(null); setLoopB(null); setReplayCount(0);

    const durMs = item.audio.durationMs || estimateDurationMs(item.transcript);
    const source: PlaybackSource = item.audio.src
      ? new FileSource(item.audio.src)
      : new SpeechSource(item.transcript, item.primaryAccent, durMs);
    srcRef.current = source;
    source.setRate(rate);

    const offs = [
      source.on('time', () => setTime(source.currentTime)),
      source.on('play', () => setPlaying(true)),
      source.on('pause', () => setPlaying(false)),
      source.on('ended', () => { setPlaying(false); setTime(source.duration); }),
      source.on('error', () => setError('音檔無法載入。可改用系統語音，或重新下載題庫包。'))
    ];

    source.load()
      .then(() => { setReady(true); setDuration(source.duration || durMs / 1000); })
      .catch((e: Error) => setError(e.message));

    return () => { offs.forEach(f => f()); source.destroy(); srcRef.current = null; };
    // rate 刻意不列入依賴：切換語速不應重建來源（規格 §7.1 邊界狀況）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  // AB 循環
  useEffect(() => {
    if (loopA === null || loopB === null) return;
    const s = srcRef.current;
    if (!s || !s.supportsSeek) return;
    if (time >= loopB) s.seek(loopA);
  }, [time, loopA, loopB]);

  // 進入背景時暫停（規格 §7.1）
  useEffect(() => {
    const onHide = () => { if (document.hidden) srcRef.current?.pause(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const play = useCallback(() => { void srcRef.current?.play().catch(() => setError('播放被瀏覽器阻擋，請再點一次。')); }, []);
  const pause = useCallback(() => srcRef.current?.pause(), []);
  const toggle = useCallback(() => { playing ? pause() : play(); }, [playing, play, pause]);
  const seek = useCallback((t: number) => srcRef.current?.seek(t), []);

  const sentenceStart = useCallback((t: number) => {
    let start = 0;
    for (const b of boundaries) if (b <= t + 0.05) start = b;
    return start;
  }, [boundaries]);

  const replaySentence = useCallback(() => {
    const s = srcRef.current; if (!s) return;
    setReplayCount(c => c + 1);
    if (!s.supportsSeek) { void s.play(); return; }
    s.seek(sentenceStart(s.currentTime));
    void s.play();
  }, [sentenceStart]);

  const prevSentence = useCallback(() => {
    const s = srcRef.current; if (!s) return;
    setReplayCount(c => c + 1);
    if (!s.supportsSeek) { void s.play(); return; }
    const cur = sentenceStart(s.currentTime);
    const target = s.currentTime - cur < 1.5
      ? [...boundaries].reverse().find(b => b < cur - 0.05) ?? 0
      : cur;
    s.seek(target); void s.play();
  }, [boundaries, sentenceStart]);

  const nextSentence = useCallback(() => {
    const s = srcRef.current; if (!s || !s.supportsSeek) return;
    const target = boundaries.find(b => b > s.currentTime + 0.05);
    if (target !== undefined) { s.seek(target); void s.play(); }
  }, [boundaries]);

  const nudge = useCallback((sec: number) => {
    const s = srcRef.current; if (!s || !s.supportsSeek) return;
    s.seek(Math.max(0, s.currentTime + sec));
  }, []);

  const setRate = useCallback((r: number) => {
    if (opts.lockRate) return;
    setRateState(r);
    srcRef.current?.setRate(r);
  }, [opts.lockRate]);

  const cycleLoop = useCallback(() => {
    const s = srcRef.current; if (!s || !s.supportsSeek) return;
    if (loopA === null) setLoopA(s.currentTime);
    else if (loopB === null) setLoopB(Math.max(s.currentTime, loopA + 0.4));
    else { setLoopA(null); setLoopB(null); }
  }, [loopA, loopB]);

  const clearLoop = useCallback(() => { setLoopA(null); setLoopB(null); }, []);

  return {
    ready, error, playing, time, duration, rate, replayCount, degraded,
    supportsSeek: srcRef.current?.supportsSeek ?? !degraded,
    timings, activeWord: activeWordIndex(timings, time),
    loopA, loopB,
    toggle, play, pause, seek, replaySentence, prevSentence, nextSentence,
    nudge, setRate, cycleLoop, clearLoop,
    resetReplayCount: () => setReplayCount(0)
  };
}
