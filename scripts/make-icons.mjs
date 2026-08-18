// 產生 PWA 圖示，不依賴任何影像函式庫（純 zlib + PNG 編碼）。
// 圖案：暖黑底 + 琥珀色音量條，對應 App 的錄音室視覺語彙。
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(OUT, { recursive: true });

const BG = [23, 22, 20];
const FG = [224, 168, 62];

// 條狀高度比例（模擬波形），與 App 內波形元件同語彙
const BARS = [0.30, 0.58, 0.86, 1.0, 0.72, 0.44, 0.66, 0.94, 0.52, 0.28];

function render(size) {
  const px = new Uint8Array(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    px[i * 3] = BG[0]; px[i * 3 + 1] = BG[1]; px[i * 3 + 2] = BG[2];
  }

  const pad = Math.round(size * 0.18);
  const inner = size - pad * 2;
  const gap = Math.max(1, Math.round(inner / (BARS.length * 3.4)));
  const barW = Math.floor((inner - gap * (BARS.length - 1)) / BARS.length);
  const maxH = Math.round(inner * 0.82);
  const cy = Math.round(size / 2);

  BARS.forEach((h, i) => {
    const x0 = pad + i * (barW + gap);
    const half = Math.max(1, Math.round((h * maxH) / 2));
    for (let y = cy - half; y <= cy + half; y++) {
      if (y < 0 || y >= size) continue;
      for (let x = x0; x < x0 + barW; x++) {
        if (x < 0 || x >= size) continue;
        const o = (y * size + x) * 3;
        px[o] = FG[0]; px[o + 1] = FG[1]; px[o + 2] = FG[2];
      }
    }
  });

  // 加上 filter byte（每列前綴 0）
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    Buffer.from(px.buffer, y * size * 3, size * 3)
      .copy(raw, y * (size * 3 + 1) + 1);
  }
  return png(size, size, deflateSync(raw, { level: 9 }));
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function png(w, h, idat) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

let TABLE = null;
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[n] = c;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(join(OUT, name), render(size));
  console.log(`✓ ${name} (${size}×${size})`);
}
