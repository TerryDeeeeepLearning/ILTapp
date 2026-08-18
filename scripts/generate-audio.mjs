#!/usr/bin/env node
/**
 * 用 Edge TTS 生成題庫音檔 + 逐詞時間戳。
 *
 * 前置需求（只需一次）：
 *   pip install edge-tts
 *   ffmpeg 需在 PATH 中
 *
 * 執行：
 *   npm run audio
 *
 * 產出：
 *   public/audio/core-starter/{id}.mp3
 *   public/audio/core-starter/pack.json   ← App 靠這份自動升級為完整功能
 *
 * 注意：edge-tts 走微軟的公開端點，需要網路。腳本會逐題重試，
 * 已生成的檔案預設跳過，可用 --force 重跑。
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACK_ID = 'core-starter';
const SRC = join(ROOT, 'src', 'content', 'seed', 'core-starter.json');
const OUT = join(ROOT, 'public', 'audio', PACK_ID);
const FORCE = process.argv.includes('--force');

const VOICE = {
  'en-GB': 'en-GB-SoniaNeural',
  'en-AU': 'en-AU-NatashaNeural',
  'en-US': 'en-US-JennyNeural',
  'en-CA': 'en-CA-ClaraNeural',
  'en-NZ': 'en-NZ-MollyNeural'
};

async function has(cmd, args) {
  try { await exec(cmd, args); return true; } catch { return false; }
}

/** 解析 edge-tts 產出的 SRT（每個 cue 一個詞）→ WordTiming[] */
function parseSrt(srt, transcript) {
  const cues = [];
  const blocks = srt.replace(/\r/g, '').split('\n\n').filter(Boolean);
  for (const b of blocks) {
    const lines = b.split('\n').filter(Boolean);
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;
    const [a, z] = timeLine.split('-->').map(s => s.trim());
    const text = lines.slice(lines.indexOf(timeLine) + 1).join(' ').trim();
    if (!text) continue;
    cues.push({ word: text, start: toSec(a), end: toSec(z) });
  }

  // 把 cue 對回 transcript 的字元位置，讓前端能做卡拉 OK 高亮
  let cursor = 0;
  return cues.map(c => {
    const idx = transcript.toLowerCase().indexOf(c.word.toLowerCase(), cursor);
    const charStart = idx >= 0 ? idx : cursor;
    const charEnd = charStart + c.word.length;
    cursor = charEnd;
    return { word: c.word, start: c.start, end: c.end, charStart, charEnd };
  });
}

function toSec(t) {
  const m = t.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return 0;
  return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000;
}

async function durationMs(file) {
  const { stdout } = await exec('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file
  ]);
  return Math.round(parseFloat(stdout.trim()) * 1000);
}

async function main() {
  if (!existsSync(SRC)) {
    console.error(`找不到題庫來源：${SRC}`);
    process.exit(1);
  }
  if (!await has('python3', ['-c', 'import edge_tts']) && !await has('edge-tts', ['--help'])) {
    console.error('缺少 edge-tts。請先執行：pip install edge-tts');
    process.exit(1);
  }
  if (!await has('ffprobe', ['-version'])) {
    console.error('缺少 ffmpeg/ffprobe，請先安裝。');
    process.exit(1);
  }

  const specs = JSON.parse(readFileSync(SRC, 'utf-8'));
  mkdirSync(OUT, { recursive: true });

  const items = [];
  let generated = 0, skipped = 0, failed = 0;

  for (const spec of specs) {
    const mp3 = join(OUT, `${spec.id}.mp3`);
    const srtPath = join(OUT, `${spec.id}.srt`);
    const voice = VOICE[spec.accent];

    if (existsSync(mp3) && !FORCE) {
      skipped++;
    } else {
      process.stdout.write(`  ${spec.id} (${spec.accent})… `);
      try {
        await exec('edge-tts', [
          '--voice', voice,
          '--text', spec.text,
          '--write-media', mp3,
          '--write-subtitles', srtPath,
          '--words-in-cue', '1'
        ], { timeout: 60_000 });
        generated++;
        console.log('✓');
      } catch (e) {
        failed++;
        console.log(`✗ ${e.message.split('\n')[0]}`);
        continue;
      }
    }

    if (!existsSync(mp3)) { failed++; continue; }

    const timings = existsSync(srtPath)
      ? parseSrt(readFileSync(srtPath, 'utf-8'), spec.text)
      : [];

    items.push({
      id: spec.id,
      file: `${spec.id}.mp3`,
      durationMs: await durationMs(mp3),
      bytes: statSync(mp3).size,
      timings,
      // 單句素材只有一個句界；多句題組時改由標點推導
      sentenceBoundaries: [0]
    });

    if (existsSync(srtPath)) rmSync(srtPath);
  }

  const manifest = { packId: PACK_ID, generatedAt: new Date().toISOString(), items };
  writeFileSync(join(OUT, 'pack.json'), JSON.stringify(manifest, null, 2));

  const totalMB = items.reduce((s, i) => s + i.bytes, 0) / 1024 / 1024;
  console.log(`\n完成：新生成 ${generated}、沿用 ${skipped}、失敗 ${failed}`);
  console.log(`題庫包 ${items.length} 個檔案，共 ${totalMB.toFixed(1)} MB`);
  console.log(`已寫入 ${join(OUT, 'pack.json')}`);
  console.log('重新整理 App 後會自動從系統語音升級為完整音檔模式。');
  if (failed) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });
