// 讓 Node 腳本直接使用 src/ 下的 TypeScript 模組。
// 目的：校驗器與執行期判分共用同一份數字/正規化邏輯，避免兩份實作漂移。
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function loadTs(entryRelPath) {
  const result = await build({
    entryPoints: [join(ROOT, entryRelPath)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    // @/ 別名對應 src/
    plugins: [{
      name: 'alias',
      setup(b) {
        b.onResolve({ filter: /^@\// }, args => ({
          path: join(ROOT, 'src', args.path.slice(2)) +
            (args.path.endsWith('.json') ? '' : '.ts')
        }));
      }
    }]
  });

  const dir = mkdtempSync(join(tmpdir(), 'ilt-'));
  const file = join(dir, 'mod.mjs');
  writeFileSync(file, result.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}
