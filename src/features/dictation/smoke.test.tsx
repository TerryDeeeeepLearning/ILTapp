import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SetupPage } from './SetupPage';
import { AnswerInput } from './AnswerInput';
import { HintPanel } from './HintPanel';
import { GappedSentence } from './GappedSentence';
import { SEED_DICTATION } from '@/content/seed/dictation';
import type { Blank } from '@/types';

describe('畫面煙霧測試', () => {
  it('練習設定頁可渲染且選項齊全', () => {
    render(<MemoryRouter><SetupPage /></MemoryRouter>);
    expect(screen.getByText('句級聽寫')).toBeDefined();
    expect(screen.getByText('完全隱藏')).toBeDefined();
    expect(screen.getByText('顯示挖空')).toBeDefined();
    expect(screen.getByText('完整顯示')).toBeDefined();
  });

  it('作答框關閉自動更正（否則 iOS 會直接送分）', () => {
    render(
      <AnswerInput value="" onChange={() => {}} onSubmit={() => {}}
        maxWords={2} ariaLabel="測試作答" />
    );
    const input = screen.getByLabelText('測試作答') as HTMLInputElement;
    expect(input.getAttribute('autocorrect')).toBe('off');
    expect(input.getAttribute('autocapitalize')).toBe('off');
    expect(input.getAttribute('spellcheck')).toBe('false');
  });

  it('提示面板不會在未使用時洩漏答案', () => {
    const blank: Blank = {
      id: 'b1', answers: ['Whitfield'], surface: 'Whitfield',
      charStart: 0, charEnd: 9, maxWords: 1, numeric: false,
      audioStart: 0, audioEnd: 1, skillTags: ['spelling-name']
    };
    render(<HintPanel blank={blank} level={0} onUse={() => {}} />);
    expect(screen.queryByText('Whitfield')).toBeNull();
  });

  it('種子題庫的每個項目都有整句 blank', () => {
    expect(SEED_DICTATION.length).toBeGreaterThan(0);
    for (const item of SEED_DICTATION) {
      const full = item.blanks.find(b => b.id === 'full');
      expect(full).toBeDefined();
      expect(full!.answers[0]).toBe(item.transcript);
      expect(item.blanks.length).toBeGreaterThan(1);
    }
  });
});

describe('挖空模式定位（修復回歸）', () => {
  it('每個空格都能在原文中定位出非空區間', () => {
    for (const item of SEED_DICTATION) {
      const gaps = item.blanks.filter(b => b.id !== 'full');
      expect(gaps.length).toBeGreaterThan(0);
      for (const g of gaps) {
        expect(g.charEnd).toBeGreaterThan(g.charStart);
        expect(item.transcript.slice(g.charStart, g.charEnd).toLowerCase())
          .toBe(g.surface.toLowerCase());
      }
    }
  });

  it('答案形式與原文說法不同時仍挖得出空格（250 vs two hundred and fifty）', () => {
    const item = SEED_DICTATION.find(i => i.id === 'sd-001')!;
    const g = item.blanks.find(b => b.answers[0] === '250')!;
    expect(item.transcript.slice(g.charStart, g.charEnd)).toBe('two hundred and fifty');
    // 用舊的做法（拿答案去搜原文）會定位失敗，這正是先前整句挖不出空格的原因
    expect(item.transcript.indexOf('250')).toBe(-1);
  });

  it('同一題的空格區間不重疊', () => {
    for (const item of SEED_DICTATION) {
      const gaps = item.blanks.filter(b => b.id !== 'full')
        .sort((a, b) => a.charStart - b.charStart);
      for (let i = 1; i < gaps.length; i++) {
        expect(gaps[i].charStart).toBeGreaterThanOrEqual(gaps[i - 1].charEnd);
      }
    }
  });

  it('挖空題型不再由數字類主導', () => {
    const gaps = SEED_DICTATION.flatMap(i => i.blanks.filter(b => b.id !== 'full'));
    const numeric = gaps.filter(g => g.numeric).length;
    expect(numeric / gaps.length).toBeLessThan(0.4);
  });

  it('挖空模式渲染出對應數量的輸入框', () => {
    const item = SEED_DICTATION.find(i => i.id === 'sd-001')!;
    const gaps = item.blanks.filter(b => b.id !== 'full');
    render(
      <GappedSentence
        transcript={item.transcript}
        blanks={item.blanks}
        answers={{}}
        results={{}}
        activeBlankId={gaps[0].id}
        hintLevels={{}}
        onChange={() => {}}
        onFocus={() => {}}
        onSubmit={() => {}}
        submitted={false}
      />
    );
    expect(screen.getAllByRole('textbox').length).toBe(gaps.length);
  });
});
