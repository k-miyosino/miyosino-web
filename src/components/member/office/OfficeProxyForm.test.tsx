// @vitest-environment jsdom
/**
 * 紙の申請の代理入力の画面（OfficeProxyForm）: ボタンを押して最後まで進め、送る内容と結果の表示を確かめる。
 * office Worker への通信は差し替える
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfficeUnit } from '@/types/office';

const submitMock = vi.fn();
const unitsMock = vi.fn();

vi.mock('@/repositories/office/officeRepository', () => {
  class OfficeInputError extends Error {
    constructor(readonly messages: string[]) {
      super(messages.join(' / '));
    }
  }
  return {
    OfficeInputError,
    fetchOfficeUnits: () => unitsMock(),
    submitOfficeProxyApplication: (input: unknown) => submitMock(input),
  };
});

import OfficeProxyForm from './OfficeProxyForm';
import { OfficeInputError } from '@/repositories/office/officeRepository';

const units: OfficeUnit[] = [
  {
    id: '1',
    name: '01-101',
    building: '1',
    room: '101',
    owner: { display: '01-101 山田', userCode: 'u1', startDate: '2010-01-01' },
    ownerConflict: false,
  },
  {
    id: '2',
    name: '01-102',
    building: '1',
    room: '102',
    owner: null,
    ownerConflict: false,
  },
];

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }));
}

beforeEach(() => {
  unitsMock.mockResolvedValue({ date: '2026-11-24', units });
  submitMock.mockResolvedValue({ id: '42', duplicate: false });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('紙の申請を入力する', () => {
  it('氏名の変更を最後まで入力すると、送って申請番号を出す', async () => {
    const onDone = vi.fn();
    render(<OfficeProxyForm onDone={onDone} />);

    // 選ばずに進もうとすると、理由を出して進まない
    click('次へ →');
    expect(screen.getByRole('alert').textContent).toContain(
      '申請書を選んでください'
    );

    click(/氏名の変更/);
    click('次へ →');
    expect(screen.getByText(/いま 2 \/ 5/)).toBeTruthy();

    // お部屋: 号棟 → 部屋番号。いまの組合員が出る
    fireEvent.click(await screen.findByRole('button', { name: '101' }));
    expect(screen.getByText(/いまの組合員/).textContent).toContain('山田');
    click('次へ →');

    // 申請した人（情報変更には購入者がない）
    expect(
      screen.queryByRole('button', { name: /新しい組合員（購入者など）/ })
    ).toBeNull();
    click('組合員本人');
    click('次へ →');

    fireEvent.change(screen.getByLabelText(/変更後の氏名/), {
      target: { value: '山田 花子' },
    });
    click('次へ →');

    // 確認画面
    expect(screen.getByText('内容の確認')).toBeTruthy();
    expect(screen.getByText('山田 花子')).toBeTruthy();
    click('登録する');

    expect(await screen.findByText('登録しました')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(submitMock.mock.calls[0][0]).toMatchObject({
      type: '情報変更',
      propertyName: '01-101',
      applicantKind: '組合員',
      newName: '山田 花子',
    });

    click('トップに戻る');
    expect(onDone).toHaveBeenCalled();
  });

  it('所有中の組合員がいないお部屋では先に進めない', async () => {
    render(<OfficeProxyForm onDone={vi.fn()} />);
    click(/組合員名義変更届/);
    click('次へ →');
    fireEvent.click(await screen.findByRole('button', { name: '102' }));
    click('次へ →');
    expect(screen.getByRole('alert').textContent).toContain(
      '所有している組合員が登録されていません'
    );
    expect(screen.getByText(/いま 2 \/ 8/)).toBeTruthy();
  });

  it('戻っても入力は消えない', async () => {
    render(<OfficeProxyForm onDone={vi.fn()} />);
    click(/氏名の変更/);
    click('次へ →');
    fireEvent.click(await screen.findByRole('button', { name: '101' }));
    click('← 戻る');
    expect(
      screen
        .getByRole('button', { name: /氏名の変更/ })
        .getAttribute('aria-pressed')
    ).toBe('true');
    click('次へ →');
    expect(
      (await screen.findByRole('button', { name: '101' })).getAttribute(
        'aria-pressed'
      )
    ).toBe('true');
  });

  it('Worker が入力の誤りを返したら、そのメッセージを出す。送り直しても同じ送信キーを使う', async () => {
    submitMock
      .mockRejectedValueOnce(
        new OfficeInputError(['届出日に、今日より後の日は入れられません'])
      )
      .mockResolvedValueOnce({ id: '43', duplicate: false });
    render(<OfficeProxyForm onDone={vi.fn()} />);
    click(/氏名の変更/);
    click('次へ →');
    fireEvent.click(await screen.findByRole('button', { name: '101' }));
    click('次へ →');
    click('代理人');
    fireEvent.change(screen.getByLabelText(/代理人の氏名/), {
      target: { value: '山田 一郎（長男）' },
    });
    click('次へ →');
    fireEvent.change(screen.getByLabelText(/変更後の氏名/), {
      target: { value: '山田 花子' },
    });
    click('次へ →');
    click('登録する');

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        '届出日に、今日より後の日は入れられません'
      )
    );
    click('登録する');
    expect(await screen.findByText('登録しました')).toBeTruthy();
    const [first, second] = submitMock.mock.calls.map((call) => call[0]);
    expect(first.submitKey).toBe(second.submitKey);
    expect(first.agent).toBe('山田 一郎（長男）');
  });
});
