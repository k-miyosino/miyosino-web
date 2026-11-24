/**
 * 紙の申請の代理入力の手順・確認・送る内容（officeProxy.ts）
 */

import { describe, expect, it } from 'vitest';
import {
  ProxyDraft,
  applicantKindsFor,
  confirmRows,
  emptyDraft,
  formatJapaneseDate,
  newSubmitKey,
  stepsFor,
  toProxyInput,
  todayLocal,
  validateStep,
} from './officeProxy';

const TODAY = '2026-11-24';

function transferDraft(overrides: Partial<ProxyDraft> = {}): ProxyDraft {
  return {
    ...emptyDraft(TODAY),
    type: '名義変更',
    propertyName: '01-101',
    ownerDisplay: '01-101 山田',
    applicantKind: '組合員',
    newName: ' 佐藤 次郎 ',
    switchDate: '2026-12-01',
    transferDate: '2026-11-16',
    oldAddress: '東京都',
    ...overrides,
  };
}

describe('stepsFor', () => {
  it('名義変更は紙の名義変更届の順番で、最後に確認', () => {
    expect(stepsFor('名義変更')).toEqual([
      'type',
      'unit',
      'applicant',
      'newName',
      'dates',
      'oldContact',
      'newContact',
      'confirm',
    ]);
  });

  it('情報変更は短い。選ぶ前は種類の画面だけ', () => {
    expect(stepsFor('情報変更')).toEqual([
      'type',
      'unit',
      'applicant',
      'newName',
      'confirm',
    ]);
    expect(stepsFor(null)).toEqual(['type']);
  });
});

describe('validateStep', () => {
  it('種類・お部屋を選ばないと進めない', () => {
    const draft = emptyDraft(TODAY);
    expect(validateStep(draft, 'type', TODAY)).toEqual([
      '申請書を選んでください',
    ]);
    expect(validateStep(draft, 'unit', TODAY)).toEqual([
      'お部屋を選んでください',
    ]);
  });

  it('所有中の組合員がいないお部屋では進めない', () => {
    const draft = transferDraft({ ownerDisplay: '' });
    expect(validateStep(draft, 'unit', TODAY)[0]).toContain(
      '所有している組合員が登録されていません'
    );
  });

  it('届出日は今日まで。代理人なら代理人の名前が要る', () => {
    expect(
      validateStep(
        transferDraft({ submittedDate: '2026-11-25' }),
        'applicant',
        TODAY
      )
    ).toContain('届出日に、今日より後の日は入れられません');
    expect(
      validateStep(
        transferDraft({ applicantKind: '代理人', agent: ' ' }),
        'applicant',
        TODAY
      )
    ).toContain('代理人の氏名と続柄（または会社名）を入れてください');
    expect(validateStep(transferDraft(), 'applicant', TODAY)).toEqual([]);
  });

  it('名義変更の日付は、負担となる日と名義変更日の両方が要る（入居日はなくてよい）', () => {
    expect(
      validateStep(
        transferDraft({ switchDate: '', transferDate: '' }),
        'dates',
        TODAY
      )
    ).toHaveLength(2);
    expect(validateStep(transferDraft(), 'dates', TODAY)).toEqual([]);
  });

  it('氏名が空なら、申請の種類に合ったことばで知らせる', () => {
    expect(
      validateStep(transferDraft({ newName: '' }), 'newName', TODAY)
    ).toEqual(['新しい組合員の氏名を入れてください']);
    expect(
      validateStep(
        transferDraft({ type: '情報変更', newName: '' }),
        'newName',
        TODAY
      )
    ).toEqual(['変更後の氏名を入れてください']);
  });

  it('連絡先と確認の画面は、空でも進める', () => {
    expect(validateStep(transferDraft(), 'oldContact', TODAY)).toEqual([]);
    expect(validateStep(transferDraft(), 'confirm', TODAY)).toEqual([]);
  });
});

describe('applicantKindsFor', () => {
  it('情報変更には購入者がいない', () => {
    expect(applicantKindsFor('情報変更')).toEqual(['組合員', '代理人']);
    expect(applicantKindsFor('名義変更')).toEqual([
      '組合員',
      '購入者',
      '代理人',
    ]);
  });
});

describe('toProxyInput', () => {
  it('名義変更は、前後の空白を除いて名義変更の項目も送る', () => {
    const input = toProxyInput(transferDraft(), 'key-1');
    expect(input).toMatchObject({
      type: '名義変更',
      submitKey: 'key-1',
      propertyName: '01-101',
      newName: '佐藤 次郎',
      switchDate: '2026-12-01',
      transferDate: '2026-11-16',
      oldAddress: '東京都',
      agent: '',
    });
    // 旧組合員は送らない（Worker が台帳から改めて調べる）
    expect(JSON.stringify(input)).not.toContain('山田');
  });

  it('情報変更は、名義変更の項目を送らない', () => {
    const input = toProxyInput(
      transferDraft({ type: '情報変更', newName: '山田 花子' }),
      'key-2'
    );
    expect(input.switchDate).toBeUndefined();
    expect(input.newName).toBe('山田 花子');
  });

  it('代理人でなければ、代理人の欄に何か入っていても送らない', () => {
    expect(
      toProxyInput(transferDraft({ agent: '残っていた文字' }), 'k').agent
    ).toBe('');
  });

  it('種類か申請した人を選んでいなければ送らない', () => {
    expect(() =>
      toProxyInput(transferDraft({ applicantKind: null }), 'k')
    ).toThrow();
  });
});

describe('confirmRows', () => {
  it('名義変更は紙の様式の順に並べ、空の項目は（なし）にする', () => {
    const rows = confirmRows(transferDraft());
    expect(rows.map(([label]) => label)).toEqual([
      '申請書',
      'お部屋',
      '旧組合員',
      '届出日',
      '申請した人',
      '新しい組合員',
      '新しい組合員の負担となる日',
      '名義変更日',
      '入居（予定）日',
      '旧組合員の転出先の住所',
      '旧組合員の転出先の電話番号',
      '新しい組合員の住所',
      '新しい組合員の電話番号',
    ]);
    expect(Object.fromEntries(rows)['新しい組合員の負担となる日']).toBe(
      '2026年12月1日'
    );
    expect(Object.fromEntries(rows)['入居（予定）日']).toBe('（なし）');
  });

  it('代理人は名前も出す', () => {
    const rows = Object.fromEntries(
      confirmRows(
        transferDraft({ applicantKind: '代理人', agent: '山田 一郎（長男）' })
      )
    );
    expect(rows['申請した人']).toBe('代理人（山田 一郎（長男））');
  });
});

describe('日付と送信キー', () => {
  it('formatJapaneseDate は形が正しくなければ空', () => {
    expect(formatJapaneseDate('2026-01-05')).toBe('2026年1月5日');
    expect(formatJapaneseDate('')).toBe('');
  });

  it('todayLocal は端末の日付を YYYY-MM-DD にする', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('送信キーは Worker が受け付ける形（英数字とハイフン、8〜64 文字）で、毎回違う', () => {
    const a = newSubmitKey();
    expect(a).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(newSubmitKey()).not.toBe(a);
  });
});
