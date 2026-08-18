import { describe, it, expect } from 'vitest';
import { normalize, matches, countWords, type NormalizeOptions } from './normalize';
import { wordsToDigits, numToWords, digitsOnly, numericVariants } from './numbers';
import { levenshtein, isTransposition } from './levenshtein';
import { charDiff, wordDiff } from './diff';
import { gradeBlank, hintMultiplier, qualityFrom, type GradeContext } from './grade';
import { toBandScore, pointsToNextBand } from './bandScore';
import type { Blank, SkillTag } from '@/types';

const opts = (over: Partial<NormalizeOptions> = {}): NormalizeOptions => ({
  strictHyphen: true, numeric: true, skillTags: [], ...over
});

const blank = (answers: string[], over: Partial<Blank> = {}): Blank => ({
  id: 'b1', answers, surface: answers[0], charStart: 0, charEnd: answers[0].length,
  maxWords: 2, numeric: true, audioStart: 0, audioEnd: 1, skillTags: [], ...over
});

const ctx = (over: Partial<GradeContext> = {}): GradeContext => ({
  replayCount: 0, hintLevelUsed: 0, timeSpentMs: 5000, avgTimeMs: 8000,
  strictHyphen: true, ...over
});

describe('normalize', () => {
  it('忽略大小寫與前後標點', () => {
    expect(normalize('  Whitfield. ', opts())).toBe('whitfield');
  });
  it('壓縮連續空白、全形轉半形', () => {
    expect(normalize('ｃａｒ　　park', opts())).toBe('car park');
  });
  it('展開縮寫為 canonical form', () => {
    expect(normalize('St', opts())).toBe('street');
    expect(normalize('Wed', opts())).toBe('wednesday');
  });
});

describe('答案比對規則（驗收 §19）', () => {
  it('15 與 fifteen 皆判對', () => {
    const b = blank(['15']);
    expect(matches('fifteen', b.answers, opts())).toBe(true);
    expect(matches('15', b.answers, opts())).toBe(true);
  });

  it('St 與 Street 皆判對', () => {
    expect(matches('St', ['Street'], opts())).toBe(true);
    expect(matches('Street', ['St'], opts())).toBe(true);
  });

  it('strictHyphen 開啟時 car-park ≠ car park', () => {
    expect(matches('car park', ['car-park'], opts({ strictHyphen: true }))).toBe(false);
  });

  it('strictHyphen 關閉時 car-park = car park', () => {
    expect(matches('car park', ['car-park'], opts({ strictHyphen: false }))).toBe(true);
  });

  it('複數 s 錯誤判為錯', () => {
    expect(matches('book', ['books'], opts())).toBe(false);
    expect(matches('books', ['book'], opts())).toBe(false);
  });

  it('大小寫不影響判定', () => {
    expect(matches('WHITFIELD', ['Whitfield'], opts())).toBe(true);
  });

  it('電話號碼忽略空白與連字號', () => {
    const o = opts({ skillTags: ['number-phone'] as SkillTag[] });
    expect(matches('0447 823 119', ['0447823119'], o)).toBe(true);
    expect(matches('oh four four seven', ['0447'], o)).toBe(true);
  });

  it('日期支援 3 March / March 3 / third of March', () => {
    const o = opts({ skillTags: ['number-date'] as SkillTag[] });
    expect(matches('March 3', ['3 March'], o)).toBe(true);
    expect(matches('3rd March', ['3 March'], o)).toBe(true);
  });

  it('金額可省略貨幣符號', () => {
    const o = opts({ skillTags: ['number-money'] as SkillTag[] });
    expect(matches('£15', ['15'], o)).toBe(true);
  });
});

describe('字數限制', () => {
  it('連字號詞算一個字', () => {
    expect(countWords('car-park')).toBe(1);
    expect(countWords('car park')).toBe(2);
  });
  it('超過 maxWords 直接判錯', () => {
    const res = gradeBlank(blank(['library'], { maxWords: 1 }), 'the main library', ctx());
    expect(res.isCorrect).toBe(false);
    expect(res.rejectedBy).toBe('word-limit');
  });
});

describe('數字轉換', () => {
  it('twenty five → 25', () => expect(wordsToDigits('twenty five')).toBe('25'));
  it('one hundred and twenty → 120', () => expect(wordsToDigits('one hundred and twenty')).toBe('120'));
  it('third → 3', () => expect(wordsToDigits('third')).toBe('3'));
  it('numToWords(15) → fifteen', () => expect(numToWords(15)).toBe('fifteen'));
  it('numToWords(42) → forty two', () => expect(numToWords(42)).toBe('forty two'));
  it('digitsOnly 抓出純數字', () => expect(digitsOnly('oh four four seven')).toBe('0447'));
  it('英式 double four → 44', () => expect(digitsOnly('oh seven double four')).toBe('0744'));
  it('英式 triple eight → 888', () => expect(digitsOnly('triple eight')).toBe('888'));
  it('完整英式電話號碼', () =>
    expect(digitsOnly('oh seven double four eight two three one one nine')).toBe('0744823119'));
  it('numericVariants 同時含數字與英文寫法', () => {
    const v = numericVariants('15');
    expect(v).toContain('15');
    expect(v).toContain('fifteen');
  });
});

describe('拼字診斷', () => {
  it('偵測相鄰字母顛倒', () => {
    expect(isTransposition('whitfeild', 'whitfield')).toBe(true);
    expect(isTransposition('whitfield', 'whitfield')).toBe(false);
  });
  it('編輯距離 ≤2 推測為拼字錯誤', () => {
    const res = gradeBlank(blank(['whitfield'], { maxWords: 1 }), 'whitfeild', ctx());
    expect(res.isCorrect).toBe(false);
    expect(res.autoReason).toBe('heard-misspelled');
    expect(res.transposed).toBe(true);
  });
  it('空白推測為沒聽到', () => {
    expect(gradeBlank(blank(['library']), '', ctx()).autoReason).toBe('not-heard');
  });
  it('答到誘答推測為中陷阱', () => {
    const res = gradeBlank(blank(['wednesday']), 'tuesday',
      ctx({ traps: [{ decoy: 'tuesday', correct: 'wednesday', atSecond: 4 }] }));
    expect(res.autoReason).toBe('trap');
  });
  it('作答時間超過平均兩倍推測為來不及', () => {
    const res = gradeBlank(blank(['peninsula']), 'penninsulla',
      ctx({ timeSpentMs: 30000, avgTimeMs: 8000 }));
    expect(['too-slow', 'heard-misspelled', 'misunderstood']).toContain(res.autoReason);
  });
});

describe('提示扣分（規格 §7.4 / §9.4）', () => {
  it('前兩次重播不扣分', () => {
    expect(hintMultiplier(0, 2)).toBe(1);
  });
  it('第三次起每次扣 10%', () => {
    expect(hintMultiplier(0, 3)).toBe(0.9);
    expect(hintMultiplier(0, 4)).toBe(0.8);
  });
  it('重播扣分下限為 50%', () => {
    expect(hintMultiplier(0, 20)).toBe(0.5);
  });
  it('L1 提示上限 75%', () => expect(hintMultiplier(1, 0)).toBe(0.75));
  it('L2 提示上限 50%', () => expect(hintMultiplier(2, 0)).toBe(0.5));
  it('L3 公布解答一律 0 分', () => {
    expect(hintMultiplier(3, 0)).toBe(0);
    const res = gradeBlank(blank(['library']), 'library', ctx({ hintLevelUsed: 3 }));
    expect(res.isCorrect).toBe(true);
    expect(res.score).toBe(0);
  });
});

describe('SM-2 質量分', () => {
  const g = (over: Partial<GradeContext>, answer = 'library') =>
    qualityFrom(gradeBlank(blank(['library']), answer, ctx(over)), ctx(over));
  it('一次過無提示 → 5', () => expect(g({ replayCount: 0 })).toBe(5));
  it('重播兩次 → 4', () => expect(g({ replayCount: 2 })).toBe(4));
  it('用了提示 → 3', () => expect(g({ hintLevelUsed: 1 })).toBe(3));
  it('公布解答 → 0', () => expect(g({ hintLevelUsed: 3 })).toBe(0));
  it('拼字錯 → 2', () => expect(g({}, 'librery')).toBe(2));
  it('完全答錯 → 1', () => expect(g({}, 'gymnasium')).toBe(1));
});

describe('diff', () => {
  it('字母級 diff 標出錯誤位置', () => {
    const cells = charDiff('whitfeild', 'whitfield');
    expect(cells.filter(c => c.op !== 'same').length).toBeGreaterThan(0);
    expect(cells.map(c => c.correct).join('')).toBe('whitfield');
  });
  it('詞級 diff 找出漏字', () => {
    const cells = wordDiff('the meeting is on', 'the meeting is on Wednesday');
    expect(cells.some(c => c.op === 'missing' && c.correct === 'Wednesday')).toBe(true);
  });
  it('詞級 diff 忽略標點與大小寫', () => {
    const cells = wordDiff('The meeting, is on.', 'the meeting is on');
    expect(cells.every(c => c.op === 'same')).toBe(true);
  });
});

describe('levenshtein', () => {
  it('相同字串距離為 0', () => expect(levenshtein('abc', 'abc')).toBe(0));
  it('單字元差異距離為 1', () => expect(levenshtein('abc', 'abd')).toBe(1));
});

describe('Band Score 換算', () => {
  it.each([[40, 9], [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5]])(
    '原始分 %i → 帶分 %f', (raw, band) => expect(toBandScore(raw)).toBe(band)
  );
  it('計算距離下一個帶分的題數', () => {
    expect(pointsToNextBand(29)).toEqual({ needed: 1, nextBand: 7 });
  });
  it('滿分沒有下一個帶分', () => expect(pointsToNextBand(40)).toBeNull());
});
