import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useSession } from '@/store/useSession';
import { useSettings } from '@/store/useSettings';
import { usePlayback } from '@/core/audio/usePlayback';
import { unlockAudio, isAudioUnlocked } from '@/core/audio/unlock';
import { AudioPlayer } from '@/features/player/AudioPlayer';
import { AnswerInput } from './AnswerInput';
import { HintPanel } from './HintPanel';
import { ReasonDialog } from './ReasonDialog';
import { GappedSentence } from './GappedSentence';
import { TranscriptViewer } from '@/features/transcript/TranscriptViewer';
import { gradeBlank, qualityFrom, type GradeContext, type GradeResult } from '@/core/grading/grade';
import { schedule, newCard } from '@/core/srs/sm2';
import { hapticResult } from '@/core/haptics/haptics';
import { db } from '@/core/db/db';
import type { AttemptRecord, FailureReason, HintLevel } from '@/types';

export function SessionPage() {
  const nav = useNavigate();
  const settings = useSettings();
  const session = useSession();
  const q = session.queue[session.index] ?? null;
  const config = session.config;

  const [unlocked, setUnlocked] = useState(isAudioUnlocked());
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());

  const pb = usePlayback(q?.item ?? null, { initialRate: settings.defaultRate });

  const blanks = useMemo(
    () => (q ? q.blankIds.map(id => q.item.blanks.find(b => b.id === id)!).filter(Boolean) : []),
    [q]
  );
  const activeBlank = blanks.find(b => b.id === q?.activeBlankId) ?? blanks[0] ?? null;

  useEffect(() => { session.bumpReplay(pb.replayCount); }, [pb.replayCount]); // eslint-disable-line
  useEffect(() => { if (!config) nav('/practice/dictation', { replace: true }); }, [config, nav]);

  const submitted = !!q?.submittedAt;
  const gapped = config?.reveal === 'gapped';
  const shown = config?.reveal === 'shown';

  const handleSubmit = useCallback(async () => {
    if (!q || submitted || !blanks.length) return;
    pb.pause();

    const results: Record<string, GradeResult> = {};
    const attempts: AttemptRecord[] = [];
    const now = Date.now();

    for (const b of blanks) {
      const ctx: GradeContext = {
        replayCount: pb.replayCount,
        hintLevelUsed: q.hintLevels[b.id] ?? 0,
        timeSpentMs: now - q.startedAt,
        avgTimeMs: 12_000,
        strictHyphen: settings.strictHyphen,
        traps: q.item.traps,
        sentenceMode: b.id === 'full'
      };

      const res = gradeBlank(b, q.answers[b.id] ?? '', ctx);
      results[b.id] = res;

      attempts.push({
        id: `${q.item.id}:${b.id}:${now}`,
        itemId: q.item.id,
        blankId: b.id,
        mode: 'dictation',
        userAnswer: q.answers[b.id] ?? '',
        isCorrect: res.isCorrect,
        score: res.score,
        replayCount: pb.replayCount,
        hintLevelUsed: ctx.hintLevelUsed,
        timeSpentMs: ctx.timeSpentMs,
        failureReason: res.isCorrect ? 'correct' : null,
        autoReason: res.autoReason,
        accent: q.item.primaryAccent,
        skillTags: b.skillTags,
        playbackRate: pb.rate,
        timestamp: now
      });

      // SRS：每個空格一張卡；L3 公布解答強制明天再見
      const cardId = `${q.item.id}:${b.id}`;
      const existing = (await db.srs.get(cardId)) ?? newCard(q.item.id, b.id);
      await db.srs.put(schedule({
        card: existing,
        quality: qualityFrom(res, ctx),
        forcedTomorrow: ctx.hintLevelUsed >= 3
      }));
    }

    hapticResult(Object.values(results).every(r => r.isCorrect));
    session.submit(results, attempts);
    await db.attempts.bulkPut(attempts);
  }, [q, blanks, submitted, pb, settings.strictHyphen, session]);

  const handleNext = useCallback(() => {
    if (!session.advance()) nav('/session/result');
  }, [session, nav]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && submitted) { e.preventDefault(); handleNext(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submitted, handleNext]);

  const addVocab = async (word: string) => {
    if (!q) return;
    await db.vocab.put({
      word: word.toLowerCase(), contextSentence: q.item.transcript,
      itemId: q.item.id, addedAt: Date.now()
    });
    setSavedWords(s => new Set(s).add(word.toLowerCase()));
  };

  if (!q || !activeBlank) return null;

  if (!unlocked) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-base p-6 text-center">
        <div>
          <p className="eyebrow mb-3">準備好了嗎</p>
          <button
            className="btn-primary text-lg px-8 py-4"
            onClick={() => { unlockAudio(); setUnlocked(true); }}
            autoFocus
          >
            點一下開始
          </button>
          <p className="mt-4 text-sm text-muted max-w-xs mx-auto leading-relaxed">
            iOS 需要先收到一次點擊才會播放聲音。建議戴上耳機。
          </p>
        </div>
      </div>
    );
  }

  const wrong = blanks.filter(b => q.results[b.id] && !q.results[b.id].isCorrect);
  const allCorrect = submitted && blanks.every(b => q.results[b.id]?.isCorrect);
  const totalScore = blanks.reduce((s, b) => s + (q.results[b.id]?.score ?? 0), 0);

  return (
    <div className="max-w-2xl mx-auto p-4 pb-28 space-y-4">
      <header className="flex items-center justify-between">
        <button
          className="btn-quiet text-sm px-2"
          onClick={() => { if (confirm('離開會捨棄本次練習，確定？')) { session.reset(); nav('/'); } }}
        >
          ← 離開
        </button>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-muted tabular-nums">
            {session.index + 1} / {session.queue.length}
          </span>
          <div className="w-24 h-1 bg-line rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-300"
              style={{ width: `${(session.index / session.queue.length) * 100}%` }}
            />
          </div>
        </div>
      </header>

      <AudioPlayer pb={pb} accent={q.item.primaryAccent} />

      <div className="card p-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="eyebrow">
            {gapped ? `填入 ${blanks.length} 個空格` : shown ? '對照原文聽讀' : '打出你聽到的整句'}
          </p>
          {gapped && !submitted && (
            <span className="text-[11px] text-faint">Tab 換格　Enter 送出</span>
          )}
        </div>

        {gapped ? (
          <GappedSentence
            transcript={q.item.transcript}
            blanks={q.item.blanks}
            answers={q.answers}
            results={q.results}
            activeBlankId={q.activeBlankId}
            hintLevels={q.hintLevels as Record<string, HintLevel>}
            onChange={session.setAnswer}
            onFocus={session.setActive}
            onSubmit={submitted ? handleNext : handleSubmit}
            submitted={submitted}
          />
        ) : (
          <>
            {shown && (
              <p className="font-mono text-[15px] leading-[2] text-muted mb-3">
                {q.item.transcript}
              </p>
            )}
            <AnswerInput
              value={q.answers.full ?? ''}
              onChange={v => session.setAnswer('full', v)}
              onSubmit={submitted ? handleNext : handleSubmit}
              maxWords={99}
              multiline
              autoFocus
              placeholder="在這裡打字…"
              ariaLabel="整句聽寫作答"
            />
          </>
        )}

        {!submitted && (
          <button className="btn-primary w-full mt-3" onClick={handleSubmit}>
            送出　<span className="text-xs opacity-70">Enter</span>
          </button>
        )}
      </div>

      {!submitted && (
        <HintPanel
          blank={activeBlank}
          level={(q.hintLevels[activeBlank.id] ?? 0) as HintLevel}
          onUse={(l: HintLevel) => session.setHintLevel(activeBlank.id, l)}
          label={gapped ? `第 ${blanks.indexOf(activeBlank) + 1} 個空格` : undefined}
        />
      )}

      {submitted && (
        <div className="space-y-4 reveal">
          <div className={clsx('card p-4 border-l-4', allCorrect ? 'border-l-ok' : 'border-l-bad')}>
            <div className="flex items-baseline justify-between">
              <span className={clsx('text-lg font-semibold', allCorrect ? 'text-ok' : 'text-bad')}>
                {allCorrect ? '✓ 全對' : `✗ 答錯 ${wrong.length} / ${blanks.length}`}
              </span>
              <span className="font-mono text-sm text-muted">
                得分 {totalScore.toFixed(2)} / {blanks.length}
              </span>
            </div>

            {blanks.some(b => q.results[b.id]?.rejectedBy === 'word-limit') && (
              <p className="mt-2 text-sm text-bad">有空格超過字數上限，真實考試會直接判錯。</p>
            )}
            {blanks.some(b => q.results[b.id]?.transposed) && (
              <p className="mt-2 text-sm text-muted">有字母寫顛倒 —— 耳朵沒問題，這是拼字問題。</p>
            )}
          </div>

          {settings.askFailureReason && wrong.map(b => (
            <div key={b.id}>
              {wrong.length > 1 && (
                <p className="eyebrow mb-1.5 px-1">
                  空格 {blanks.indexOf(b) + 1}：{b.answers[0]}
                </p>
              )}
              <ReasonDialog
                autoReason={q.results[b.id].autoReason}
                selected={q.reasons[b.id] ?? null}
                onSelect={(r: FailureReason) => session.setReason(b.id, r)}
              />
            </div>
          ))}

          <TranscriptViewer
            item={q.item}
            timings={pb.timings}
            activeWord={pb.activeWord}
            onSeek={t => { pb.seek(t); pb.play(); }}
            onAddVocab={addVocab}
            diff={q.results.full?.diff ?? null}
            savedWords={savedWords}
          />
        </div>
      )}

      {submitted && (
        <div
          className="fixed bottom-0 inset-x-0 p-3 bg-base/95 backdrop-blur border-t border-line"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-2xl mx-auto">
            <button className="btn-primary w-full" onClick={handleNext}>
              {session.index + 1 >= session.queue.length ? '看結果' : '下一題'}
              <span className="text-xs opacity-70 ml-1">Enter</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
