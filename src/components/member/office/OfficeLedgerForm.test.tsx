// @vitest-environment jsdom
/**
 * 台帳を更新する画面（OfficeLedgerForm）: ボタンを押して最後まで進め、確認画面・反映・知らせることの表示を確かめる。
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

const unitsMock = vi.fn();
const previewMock = vi.fn();
const applyMock = vi.fn();

vi.mock('@/repositories/office/officeRepository', () => {
  class OfficeInputError extends Error {
    constructor(readonly messages: string[]) {
      super(messages.join(' / '));
    }
  }
  return {
    OfficeInputError,
    fetchOfficeUnits: () => unitsMock(),
    previewOfficeLedger: (input: unknown) => previewMock(input),
    applyOfficeLedger: (input: unknown) => applyMock(input),
  };
});

import OfficeLedgerForm from './OfficeLedgerForm';
import { OfficeInputError } from '@/repositories/office/officeRepository';

const units: OfficeUnit[] = [
  {
    id: '1',
    name: '01-101',
    building: '1',
    room: '101',
    owner: { display: '01-101 山田', userCode: 'u1', startDate: '2010-04-01' },
    ownerConflict: false,
  },
];

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }));
}

async function chooseRoom() {
  fireEvent.click(await screen.findByRole('button', { name: '101' }));
}

beforeEach(() => {
  unitsMock.mockResolvedValue({ date: '2026-11-28', units });
  previewMock.mockResolvedValue({
    summary: [
      '01-101 山田 様の所有を 2026年11月30日 で終えます（譲渡済）',
      '新しい組合員「01-101 佐藤 次郎」を登録します',
    ],
    warnings: ['01-101 山田 様には、続いている駐車場の契約が 1 件あります。'],
    notices: [
      '管理者へ: 2026年12月1日 に、旧組合員のアカウントを止めてください',
    ],
    proration: null,
  });
  applyMock.mockResolvedValue({
    logId: '42',
    duplicate: false,
    notices: [
      '管理者へ: 2026年12月1日 に、旧組合員のアカウントを止めてください',
    ],
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('台帳を更新する', () => {
  it('名義変更: ログイン名・日付まで入れると、確認画面で台帳の変わり方を見せ、反映して記録番号と知らせることを出す', async () => {
    const onDone = vi.fn();
    render(<OfficeLedgerForm onDone={onDone} />);

    click(/名義変更/);
    click('次へ →');
    await chooseRoom();
    click('次へ →');
    fireEvent.change(screen.getByLabelText(/新しい組合員の氏名/), {
      target: { value: '佐藤 次郎' },
    });
    click('次へ →');

    // ログイン名はお部屋の番号で始まる
    fireEvent.change(screen.getByLabelText(/ログイン名/), {
      target: { value: '02202sato' },
    });
    click('次へ →');
    expect(screen.getByRole('alert').textContent).toContain('01101');
    fireEvent.change(screen.getByLabelText(/ログイン名/), {
      target: { value: '01101sato' },
    });
    click('次へ →');

    fireEvent.change(screen.getByLabelText(/負担となる日/), {
      target: { value: '2026-12-01' },
    });
    fireEvent.change(screen.getByLabelText(/所有名義変更月日/), {
      target: { value: '2026-11-16' },
    });
    click('次へ →');

    // 確認画面は Worker に問い合わせた内容を出す
    expect(
      await screen.findByText(/所有を 2026年11月30日 で終えます/)
    ).toBeTruthy();
    expect(screen.getByText(/駐車場の契約が 1 件/)).toBeTruthy();
    expect(previewMock.mock.calls[0][0]).toMatchObject({
      type: '名義変更',
      propertyName: '01-101',
      newName: '佐藤 次郎',
      newLogin: '01101sato',
      switchDate: '2026-12-01',
      transferDate: '2026-11-16',
    });

    click('台帳に反映する');
    expect(await screen.findByText('台帳に反映しました')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(
      screen.getByText(/旧組合員のアカウントを止めてください/)
    ).toBeTruthy();
    // 確認と反映は同じ送信キー
    expect(applyMock.mock.calls[0][0].submitKey).toBe(
      previewMock.mock.calls[0][0].submitKey
    );

    click('トップに戻る');
    expect(onDone).toHaveBeenCalled();
  });

  it('氏名の変更は、お部屋と新しい氏名だけで確認画面に進む', async () => {
    render(<OfficeLedgerForm onDone={vi.fn()} />);
    click(/氏名の変更/);
    click('次へ →');
    await chooseRoom();
    click('次へ →');
    expect(screen.getByText(/いま 3 \/ 4/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/変更後の氏名/), {
      target: { value: '山田 花子' },
    });
    click('次へ →');
    await screen.findByText('台帳がこう変わります（確認）');
    expect(previewMock.mock.calls[0][0]).toEqual({
      type: '氏名の変更',
      submitKey: expect.any(String),
      propertyName: '01-101',
      newName: '山田 花子',
    });
  });

  it('確認で Worker が断ったら、理由を出して確認画面に進まない', async () => {
    previewMock.mockRejectedValueOnce(
      new OfficeInputError(['旧組合員の所有には、すでに終了日が入っています'])
    );
    render(<OfficeLedgerForm onDone={vi.fn()} />);
    click(/氏名の変更/);
    click('次へ →');
    await chooseRoom();
    click('次へ →');
    fireEvent.change(screen.getByLabelText(/変更後の氏名/), {
      target: { value: '山田 花子' },
    });
    click('次へ →');
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'すでに終了日が入っています'
      )
    );
    expect(screen.queryByText('台帳がこう変わります（確認）')).toBeNull();
  });

  it('反映で断られたら理由を出し、送り直しても同じ送信キーを使う', async () => {
    applyMock
      .mockRejectedValueOnce(
        new OfficeInputError(['ほかの人が先に台帳を変えました'])
      )
      .mockResolvedValueOnce({ logId: '43', duplicate: false, notices: [] });
    render(<OfficeLedgerForm onDone={vi.fn()} />);
    click(/氏名の変更/);
    click('次へ →');
    await chooseRoom();
    click('次へ →');
    fireEvent.change(screen.getByLabelText(/変更後の氏名/), {
      target: { value: '山田 花子' },
    });
    click('次へ →');
    await screen.findByText('台帳がこう変わります（確認）');
    click('台帳に反映する');
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'ほかの人が先に台帳を変えました'
      )
    );
    click('台帳に反映する');
    expect(await screen.findByText('台帳に反映しました')).toBeTruthy();
    const [first, second] = applyMock.mock.calls.map((c) => c[0]);
    expect(first.submitKey).toBe(second.submitKey);
  });
});
