/**
 * 事務員が台帳を更新する入力の手順・確認・送る内容（officeLedger.ts）
 */

import { describe, expect, it } from 'vitest';
import {
  LedgerDraft,
  composedName,
  displayPreview,
  emptyDraft,
  formatJapaneseDate,
  newSubmitKey,
  propertyCode,
  stepsFor,
  toLedgerInput,
  validateStep,
} from './officeLedger';

function transferDraft(overrides: Partial<LedgerDraft> = {}): LedgerDraft {
  return {
    ...emptyDraft(),
    type: '名義変更',
    propertyName: '01-101',
    ownerDisplay: '01-101 山田',
    familyName: ' 佐藤 ',
    givenName: '次郎　',
    newLogin: ' 01101sato ',
    switchDate: '2026-12-01',
    transferDate: '2026-11-16',
    ...overrides,
  };
}

describe('stepsFor', () => {
  it('名義変更は紙の名義変更届の順番にログイン名を足し、最後に確認', () => {
    expect(stepsFor('名義変更')).toEqual([
      'type',
      'unit',
      'newName',
      'newLogin',
      'dates',
      'confirm',
    ]);
  });

  it('氏名の変更は短い。選ぶ前は手続きの画面だけ', () => {
    expect(stepsFor('氏名の変更')).toEqual([
      'type',
      'unit',
      'newName',
      'confirm',
    ]);
    expect(stepsFor(null)).toEqual(['type']);
  });
});

describe('validateStep', () => {
  it('手続き・お部屋を選ばないと進めない。所有者がいないお部屋も進めない', () => {
    expect(validateStep(emptyDraft(), 'type')).toEqual([
      '手続きを選んでください',
    ]);
    expect(validateStep(emptyDraft(), 'unit')).toEqual([
      'お部屋を選んでください',
    ]);
    expect(
      validateStep(transferDraft({ ownerDisplay: '' }), 'unit')[0]
    ).toContain('所有している組合員が登録されていません');
  });

  it('ログイン名は英数字で、お部屋の番号で始まる', () => {
    expect(validateStep(transferDraft(), 'newLogin')).toEqual([]);
    expect(
      validateStep(transferDraft({ newLogin: '02202sato' }), 'newLogin')[0]
    ).toContain('01101');
    expect(
      validateStep(transferDraft({ newLogin: 'さとう' }), 'newLogin')[0]
    ).toContain('半角の英数字');
  });

  it('名義変更の日付は、負担となる日と名義変更日の両方が要る', () => {
    expect(
      validateStep(transferDraft({ switchDate: '', transferDate: '' }), 'dates')
    ).toHaveLength(2);
  });

  it('姓・名が空なら、手続きに合ったことばで知らせる', () => {
    expect(
      validateStep(transferDraft({ familyName: '', givenName: ' ' }), 'newName')
    ).toEqual([
      '新しい組合員の姓を入れてください',
      '新しい組合員の名を入れてください',
    ]);
    expect(
      validateStep(
        transferDraft({ type: '氏名の変更', nameMode: 'single', newName: '' }),
        'newName'
      )
    ).toEqual(['変更後の氏名を入れてください']);
  });

  it('姓と名は半角の空白 1 つでつなぐ。分けられないときは 1 つの欄の空白をそろえる', () => {
    expect(composedName(transferDraft())).toBe('佐藤 次郎');
    expect(displayPreview(transferDraft())).toBe('01-101佐藤 次郎');
    expect(
      composedName(
        transferDraft({ nameMode: 'single', newName: ' John　 A  Smith ' })
      )
    ).toBe('John A Smith');
  });
});

describe('toLedgerInput', () => {
  it('名義変更は、前後の空白を除いてログイン名・日付も送る（旧組合員は送らない）', () => {
    const input = toLedgerInput(transferDraft(), 'key-1');
    expect(input).toEqual({
      type: '名義変更',
      submitKey: 'key-1',
      propertyName: '01-101',
      newName: '佐藤 次郎',
      newLogin: '01101sato',
      switchDate: '2026-12-01',
      transferDate: '2026-11-16',
    });
  });

  it('氏名の変更は、名義変更の項目を送らない', () => {
    expect(
      toLedgerInput(transferDraft({ type: '氏名の変更' }), 'key-2')
    ).toEqual({
      type: '氏名の変更',
      submitKey: 'key-2',
      propertyName: '01-101',
      newName: '佐藤 次郎',
    });
  });

  it('手続きを選んでいなければ送らない', () => {
    expect(() => toLedgerInput(emptyDraft(), 'k')).toThrow();
  });
});

describe('そのほか', () => {
  it('propertyCode・formatJapaneseDate', () => {
    expect(propertyCode('01-101')).toBe('01101');
    expect(formatJapaneseDate('2026-01-05')).toBe('2026年1月5日');
    expect(formatJapaneseDate('')).toBe('');
  });

  it('送信キーは Worker が受け付ける形で、毎回違う', () => {
    const a = newSubmitKey();
    expect(a).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(newSubmitKey()).not.toBe(a);
  });
});
