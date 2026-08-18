const UNITS = ['zero','one','two','three','four','five','six','seven','eight','nine',
  'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen',
  'eighteen','nineteen'];
const TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
const ORDINALS: Record<string, number> = {
  first:1, second:2, third:3, fourth:4, fifth:5, sixth:6, seventh:7, eighth:8,
  ninth:9, tenth:10, eleventh:11, twelfth:12, thirteenth:13, fourteenth:14,
  fifteenth:15, sixteenth:16, seventeenth:17, eighteenth:18, nineteenth:19,
  twentieth:20, thirtieth:30, fortieth:40, fiftieth:50
};

const WORD_TO_NUM = new Map<string, number>();
UNITS.forEach((w, i) => WORD_TO_NUM.set(w, i));
TENS.forEach((w, i) => { if (w) WORD_TO_NUM.set(w, i * 10); });
// 英式電話常見唸法
WORD_TO_NUM.set('oh', 0);
WORD_TO_NUM.set('nought', 0);

export function numToWords(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > 999) return null;
  if (n < 20) return UNITS[n];
  if (n < 100) {
    const t = Math.floor(n / 10), u = n % 10;
    return u ? `${TENS[t]} ${UNITS[u]}` : TENS[t];
  }
  const h = Math.floor(n / 100), r = n % 100;
  const head = `${UNITS[h]} hundred`;
  return r ? `${head} and ${numToWords(r)}` : head;
}

/**
 * 把英文數字詞轉成阿拉伯數字。
 * "twenty five" → "25"、"one hundred and twenty" → "120"、"third" → "3"
 */
/** 英式電話唸法：double four = 44、triple eight = 888 */
const REPEAT: Record<string, number> = { double: 2, triple: 3, treble: 3 };

export function wordsToDigits(text: string): string {
  const tokens = text.split(' ').filter(Boolean);
  const out: string[] = [];
  let acc: number | null = null;
  let pending = 0;
  let repeat = 0;

  const flush = () => {
    if (acc !== null || pending) {
      out.push(String((acc ?? 0) + pending));
      acc = null; pending = 0;
    }
  };

  for (const t of tokens) {
    if (REPEAT[t] !== undefined) { flush(); repeat = REPEAT[t]; continue; }

    // double / triple 後面接的那個數字要重複，且不參與位數累加
    if (repeat && WORD_TO_NUM.has(t)) {
      const v = WORD_TO_NUM.get(t)!;
      flush();
      out.push(String(v).repeat(repeat));
      repeat = 0;
      continue;
    }
    if (repeat && /^\d$/.test(t)) {
      flush();
      out.push(t.repeat(repeat));
      repeat = 0;
      continue;
    }
    if (repeat) { flush(); repeat = 0; }

    if (t === 'hundred' && (acc !== null || pending)) {
      pending = ((acc ?? 0) + pending) * 100; acc = null; continue;
    }
    if (t === 'and' && (acc !== null || pending)) continue;
    if (WORD_TO_NUM.has(t)) {
      const v = WORD_TO_NUM.get(t)!;
      if (acc === null) acc = v;
      else if (acc % 10 === 0 && acc >= 20 && v < 10) acc += v;
      else { flush(); acc = v; }
      continue;
    }
    if (ORDINALS[t] !== undefined) { flush(); out.push(String(ORDINALS[t])); continue; }
    flush();
    out.push(t);
  }
  flush();
  return out.join(' ');
}

/** 15th / 3rd / 1st → 15 / 3 / 1 */
export function stripOrdinalSuffix(text: string): string {
  return text.replace(/(\d+)(st|nd|rd|th)\b/g, '$1');
}

/** 只保留數字，用於電話號碼比對 */
export function digitsOnly(text: string): string {
  return wordsToDigits(text).replace(/\D/g, '');
}

/** 產生數字的所有可接受寫法（digits ↔ words） */
export function numericVariants(text: string): string[] {
  const set = new Set<string>();
  const asDigits = stripOrdinalSuffix(wordsToDigits(text)).trim();
  set.add(asDigits);
  const asWords = asDigits.split(' ').map(tok =>
    /^\d+$/.test(tok) ? (numToWords(parseInt(tok, 10)) ?? tok) : tok
  ).join(' ');
  set.add(asWords);
  return [...set];
}
