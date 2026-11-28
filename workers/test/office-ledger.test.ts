/**
 * 台帳の更新（office Worker）: 入力の確認、名義変更・氏名の変更・取り消しの書き込みの組み立て、API
 */

import { describe, expect, it, vi } from 'vitest';
import office from '../api/office';
import {
  BulkRequest,
  LedgerContext,
  LedgerOwnership,
  computeProration,
  jstDate,
  parseLedgerInput,
  planCancel,
  planRename,
  planTransfer,
  previousDay,
  uniqueDisplay,
} from '../api/_office-ledger';
import { todayJst } from '../api/_office';
import { TEST_SECRET, json, makeToken, silenceConsole, stubFetch } from './helpers';

silenceConsole();

const TODAY = '2026-11-28';
const apps = { member: '96', ownership: '44', parking: '50', log: '200' };

function ownership(overrides: Partial<Record<keyof LedgerOwnership, unknown>> = {}): LedgerOwnership {
  return {
    $id: { value: '10' },
    $revision: { value: '3' },
    property: { value: '01-101' },
    member: { value: '01-101山田' },
    start_date: { value: '2010-04-01' },
    end_date: { value: null },
    status: { value: '所有中' },
    user: { value: [{ code: '01101yamada', name: '山田' }] },
    management_fee: { value: '5500' },
    repair_reserve_fee: { value: '17000' },
    ...(overrides as object),
  } as LedgerOwnership;
}

function context(overrides: Partial<LedgerContext> = {}): LedgerContext {
  const owner = ownership();
  return {
    today: TODAY,
    propertyOwnerships: [owner],
    member: {
      $id: { value: '5' },
      $revision: { value: '2' },
      display: { value: '01-101山田' },
      status: { value: '有効' },
      user: owner.user,
    },
    memberOwnerships: [owner],
    memberParkings: [],
    ...overrides,
  };
}

const transfer = {
  type: '名義変更' as const,
  submitKey: 'key-12345678',
  propertyName: '01-101',
  newName: '佐藤次郎',
  newLogin: '01101sato',
  switchDate: '2026-12-01',
  transferDate: '2026-11-16',
};
const rename = {
  type: '氏名の変更' as const,
  submitKey: 'key-abcdefgh',
  propertyName: '01-101',
  newName: '山田花子',
};

describe('parseLedgerInput', () => {
  it('名義変更・氏名の変更の正しい入力を通す（前後の空白は除く）', () => {
    const parsed = parseLedgerInput({ ...transfer, newName: ' 佐藤 次郎 ' });
    expect(parsed.ok && parsed.value.newName).toBe('佐藤 次郎');
    expect(parseLedgerInput(rename).ok).toBe(true);
  });

  it('手続きが正しくなければ、そのことだけを返す', () => {
    expect(parseLedgerInput({ ...rename, type: '退会' })).toEqual({ ok: false, errors: ['手続きを選んでください'] });
  });

  it('名義変更のログイン名は、お部屋の番号（棟部屋コード）で始まる', () => {
    const parsed = parseLedgerInput({ ...transfer, newLogin: '02202sato' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors[0]).toContain('01101');
  });

  it('名義変更の日付・ログイン名が空なら、すべてのエラーを返す', () => {
    const parsed = parseLedgerInput({ ...transfer, newLogin: '', switchDate: '', transferDate: '2026-02-30' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors).toHaveLength(3);
  });

  it('クエリに入れる値（物件名・送信キー・ログイン名）は形を確かめる', () => {
    expect(parseLedgerInput({ ...rename, propertyName: '01-101" or 1=1' }).ok).toBe(false);
    expect(parseLedgerInput({ ...rename, submitKey: 'a"b' }).ok).toBe(false);
    expect(parseLedgerInput({ ...transfer, newLogin: '01101"x' }).ok).toBe(false);
  });
});

describe('planTransfer（名義変更）', () => {
  it('旧組合員の所有を前の日で終え、無効にし、新しい組合員と所有を作る（書き換えは revision 付き）', () => {
    const planned = planTransfer(transfer, context(), apps, '事務 佐藤（clerk）', '2026-11-28T01:00:00.000Z');
    if (!planned.ok) throw new Error(planned.errors.join(' / '));
    const [endOld, disableOld, newMember, newOwnership] = planned.value.requests;
    expect(endOld.payload).toEqual({
      app: '44',
      id: '10',
      revision: '3',
      record: { end_date: { value: '2026-11-30' }, status: { value: '譲渡済' } },
    });
    expect(disableOld.payload).toEqual({ app: '96', id: '5', revision: '2', record: { status: { value: '無効' } } });
    expect(newMember.payload).toEqual({
      app: '96',
      record: {
        display: { value: '01-101佐藤次郎' },
        user: { value: [{ code: '01101sato' }] },
        status: { value: '有効' },
      },
    });
    expect(newOwnership.payload).toEqual({
      app: '44',
      record: {
        member: { value: '01-101佐藤次郎' },
        property: { value: '01-101' },
        start_date: { value: '2026-12-01' },
        status: { value: '所有中' },
      },
    });
    const log = planned.value.logRecord;
    expect(log.old_member.value).toBe('01-101山田');
    expect(log.entered_by.value).toBe('事務 佐藤（clerk）');
    expect(JSON.parse(log.before.value)).toEqual({
      oldOwnership: { id: '10', end_date: '', status: '所有中' },
      oldMember: { id: '5', status: '有効' },
    });
    // 1 日に切り替えるので日割りはない
    expect(planned.value.proration).toBeNull();
    expect(planned.value.summary[0]).toContain('2026年11月30日');
  });

  it('月の途中で切り替えると、会計担当への日割りの知らせを付ける', () => {
    const planned = planTransfer({ ...transfer, switchDate: '2026-12-16' }, context(), apps, 'x', 'y');
    if (!planned.ok) throw new Error('not ok');
    expect(planned.value.proration).toEqual({
      daysInMonth: 31,
      oldDays: 15,
      newDays: 16,
      monthlyFee: 22500,
      oldAmount: Math.floor((22500 * 15) / 31),
      newAmount: Math.floor((22500 * 16) / 31),
    });
    expect(planned.value.notices.some((n) => n.includes('2026年12月分') && n.includes('日割り'))).toBe(true);
  });

  it('旧組合員に続いている駐車場の契約があれば、確認画面で知らせる', () => {
    const parking = {
      $id: { value: '70' },
      $revision: { value: '1' },
      member: { value: '01-101山田' },
      start_date: { value: '2020-01-01' },
      end_date: { value: null },
    };
    const planned = planTransfer(transfer, context({ memberParkings: [parking] }), apps, 'x', 'y');
    expect(planned.ok && planned.value.warnings[0]).toContain('駐車場の契約が 1 件');
  });

  it('所有者がいない・重なる・開始日より前に切り替える・終了日がある・同じログイン名は断る', () => {
    const none = planTransfer(transfer, context({ propertyOwnerships: [] }), apps, 'x', 'y');
    expect(none.ok).toBe(false);
    const both = planTransfer(transfer, context({ propertyOwnerships: [ownership(), ownership({ $id: { value: '11' } })] }), apps, 'x', 'y');
    expect(both.ok).toBe(false);
    const early = planTransfer({ ...transfer, switchDate: '2010-04-01' }, context(), apps, 'x', 'y');
    expect(!early.ok && early.errors[0]).toContain('開始日');
    const ended = planTransfer(transfer, context({ propertyOwnerships: [ownership({ end_date: { value: '2026-12-31' } })] }), apps, 'x', 'y');
    expect(!ended.ok && ended.errors[0]).toContain('終了日');
    const sameLogin = planTransfer({ ...transfer, newLogin: '01101yamada' }, context(), apps, 'x', 'y');
    expect(sameLogin.ok).toBe(false);
  });

  it('旧組合員の M_組合員が見つからなければ断る', () => {
    expect(planTransfer(transfer, context({ member: null }), apps, 'x', 'y').ok).toBe(false);
  });
});

describe('planRename（氏名の変更）', () => {
  it('M_組合員の表示を書き換え、所有状況・駐車場契約の「組合員」も写し直す', () => {
    const parking = {
      $id: { value: '70' },
      $revision: { value: '4' },
      member: { value: '01-101山田' },
      start_date: { value: '2020-01-01' },
      end_date: { value: null },
    };
    const planned = planRename(rename, context({ memberParkings: [parking] }), apps, 'x', 'y');
    if (!planned.ok) throw new Error(planned.errors.join(' / '));
    expect(planned.value.requests.map((r) => [r.payload.app, r.payload.id, r.payload.record])).toEqual([
      ['96', '5', { display: { value: '01-101山田花子' } }],
      ['44', '10', { member: { value: '01-101山田花子' } }],
      ['50', '70', { member: { value: '01-101山田花子' } }],
    ]);
    expect(JSON.parse(planned.value.logRecord.before.value)).toEqual({
      member: { id: '5', display: '01-101山田' },
      ownerships: ['10'],
      parkings: ['70'],
    });
    expect(planned.value.notices[0]).toContain('01101yamada');
  });

  it('駐車場契約のアプリが設定されていなければ、駐車場契約は写し直さない', () => {
    const planned = planRename(rename, context(), { ...apps, parking: undefined }, 'x', 'y');
    expect(planned.ok && planned.value.requests).toHaveLength(2);
  });

  it('今と同じ氏名なら断る', () => {
    expect(planRename({ ...rename, newName: '山田' }, context(), apps, 'x', 'y').ok).toBe(false);
  });

  it('ほかの組合員の表示と重なれば番号を付ける（今の自分の表示は数えない）', () => {
    const planned = planRename(
      rename,
      context({ takenDisplays: ['01-101山田', '01-101山田花子'] }),
      apps,
      'x',
      'y'
    );
    if (!planned.ok) throw new Error(planned.errors.join(' / '));
    expect(recordOf(planned.value.requests[0])).toEqual({ display: { value: '01-101山田花子(2)' } });
    expect(planned.value.warnings[0]).toContain('01-101山田花子(2)');
  });
});

function recordOf(request: BulkRequest): Record<string, unknown> {
  return request.payload.record as Record<string, unknown>;
}

describe('台帳の「表示」の形', () => {
  it('氏名の間の空白（全角・半角・続いたもの）は半角 1 つにし、物件名とは空けずにつなぐ（今の台帳の「01-101田中」と同じ形）', () => {
    const parsed = parseLedgerInput({ ...transfer, newName: '　田中　 太郎 ' });
    expect(parsed.ok && parsed.value.newName).toBe('田中 太郎');
    const foreign = parseLedgerInput({ ...transfer, newName: 'John　 A  Smith' });
    expect(foreign.ok && foreign.value.newName).toBe('John A Smith');
    const planned = planTransfer({ ...transfer, newName: '田中 太郎' }, context(), apps, 'x', 'y');
    expect(planned.ok && recordOf(planned.value.requests[2]).display).toEqual({ value: '01-101田中 太郎' });
  });

  it('名義変更で、同じ表示の組合員（同じ姓名の旧組合員など）がいれば、重ならない番号を付けて知らせる', () => {
    const planned = planTransfer(
      { ...transfer, newName: '山田' },
      context({ takenDisplays: ['01-101山田', '01-101山田(2)'] }),
      apps,
      'x',
      'y'
    );
    if (!planned.ok) throw new Error(planned.errors.join(' / '));
    expect(recordOf(planned.value.requests[2]).display).toEqual({ value: '01-101山田(3)' });
    expect(recordOf(planned.value.requests[3]).member).toEqual({ value: '01-101山田(3)' });
    expect(planned.value.warnings[0]).toContain('「01-101山田(3)」で登録します');
  });

  it('uniqueDisplay は重ならなければそのまま、重なれば (2) から順に空いている番号', () => {
    expect(uniqueDisplay('01-101田中', [])).toBe('01-101田中');
    expect(uniqueDisplay('01-101田中', ['01-101田中', '01-101田中(3)'])).toBe('01-101田中(2)');
  });
});

describe('planCancel（その日の取り消し）', () => {
  function transferLog(overrides: Record<string, string> = {}) {
    const planned = planTransfer(transfer, context(), apps, 'x', '2026-11-28T01:00:00.000Z');
    if (!planned.ok) throw new Error('not ok');
    const after = JSON.parse(planned.value.logRecord.after.value);
    after.ids = { member: '300', ownership: '400' };
    const log: Record<string, { value: string }> = { $id: { value: '9' }, ...planned.value.logRecord };
    log.after = { value: JSON.stringify(after) };
    for (const [k, v] of Object.entries(overrides)) log[k] = { value: v };
    return log;
  }

  it('名義変更を戻す: 旧組合員の所有と状況を戻し、作った組合員・所有は消さずに無効・期間なしにする', () => {
    const planned = planCancel(transferLog(), apps, TODAY, '事務 佐藤（clerk）', 'now');
    if (!planned.ok) throw new Error(planned.errors.join(' / '));
    expect(planned.value.map((r) => [r.payload.app, r.payload.id, r.payload.record])).toEqual([
      ['44', '10', { end_date: { value: '' }, status: { value: '所有中' } }],
      ['96', '5', { status: { value: '有効' } }],
      ['96', '300', { status: { value: '無効' }, display: { value: '01-101佐藤次郎（取り消し 9）' } }],
      ['44', '400', { member: { value: '01-101佐藤次郎（取り消し 9）' }, end_date: { value: '2026-11-30' }, status: { value: '所有前' } }],
      ['200', '9', { status: { value: '取り消し' }, canceled_by: { value: '事務 佐藤（clerk）' }, canceled_at: { value: 'now' } }],
    ]);
  });

  it('氏名の変更を戻す: 表示を戻し、写し直した記録も戻す', () => {
    const planned = planRename(rename, context(), apps, 'x', '2026-11-28T01:00:00.000Z');
    if (!planned.ok) throw new Error('not ok');
    const log = { $id: { value: '8' }, ...planned.value.logRecord };
    const cancel = planCancel(log, apps, TODAY, 'y', 'now');
    if (!cancel.ok) throw new Error(cancel.errors.join(' / '));
    expect(cancel.value.map((r) => [r.payload.id, r.payload.record])).toEqual([
      ['5', { display: { value: '01-101山田' } }],
      ['10', { member: { value: '01-101山田' } }],
      ['8', { status: { value: '取り消し' }, canceled_by: { value: 'y' }, canceled_at: { value: 'now' } }],
    ]);
  });

  it('前の日の記録・取り消し済み・作ったレコードの番号がない記録は取り消せない', () => {
    expect(planCancel(transferLog(), apps, '2026-11-29', 'y', 'now').ok).toBe(false);
    expect(planCancel(transferLog({ status: '取り消し' }), apps, TODAY, 'y', 'now').ok).toBe(false);
    const log = transferLog();
    log.after = { value: JSON.stringify({ newMember: { display: 'x' }, newOwnership: { start_date: '2026-12-01' } }) };
    expect(planCancel(log, apps, TODAY, 'y', 'now').ok).toBe(false);
  });
});

describe('日付と日割り', () => {
  it('previousDay は月・年をまたぐ', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2027-01-01')).toBe('2026-12-31');
  });

  it('computeProration は 1 日なら null、うるう年の 2 月も日数で割る', () => {
    expect(computeProration('2026-12-01', 22500)).toBeNull();
    expect(computeProration('2028-02-15', 2900)).toMatchObject({ daysInMonth: 29, oldDays: 14, newDays: 15, oldAmount: 1400, newAmount: 1500 });
  });

  it('jstDate は UTC の 15:00 以降を翌日にする', () => {
    expect(jstDate('2026-11-28T14:59:00Z')).toBe('2026-11-28');
    expect(jstDate('2026-11-28T15:00:00Z')).toBe('2026-11-29');
  });
});

// ---- API ----

const WORKER = 'https://miyosino-office.example.workers.dev';
const KINTONE_DOMAIN = 'example.cybozu.com';
const env = {
  JWT_SECRET: TEST_SECRET,
  KINTONE_DOMAIN,
  KINTONE_API_TOKEN_OFFICE: 'token-a,token-b',
  KINTONE_APP_ID_PROPERTY: '40',
  KINTONE_APP_ID_OWNERSHIP: '44',
  KINTONE_APP_ID_MEMBER: '96',
  KINTONE_APP_ID_PARKING: '50',
  KINTONE_APP_ID_LEDGER_LOG: '200',
};

/** kintone の差し替え。台帳の読み込み・bulkRequest・記録の更新を記録する */
function stubKintone(options: { existing?: unknown[]; bulkStatus?: number; bulkCode?: string; logs?: unknown[]; log?: unknown }) {
  const owner = ownership({ start_date: { value: '2010-04-01' } });
  return stubFetch((url, init) => {
    if (url.host !== KINTONE_DOMAIN) return undefined;
    const app = url.searchParams.get('app');
    const query = url.searchParams.get('query') ?? '';
    if (url.pathname === '/k/v1/records.json') {
      if (app === '200') return json({ records: query.startsWith('submit_key') ? (options.existing ?? []) : (options.logs ?? []) });
      if (app === '44') return json({ records: [owner] });
      if (app === '96') return json({ records: [context().member] });
      if (app === '50') return json({ records: [] });
    }
    if (url.pathname === '/k/v1/bulkRequest.json') {
      if (options.bulkStatus) {
        return json(
          {
            results: [
              {},
              {
                code: options.bulkCode ?? 'GAIA_XX',
                message: '01-101山田 の個人情報',
                errors: { 'record.user.values.value': { messages: ['01101yamada は存在しません'] }, '01-101山田': {} },
              },
            ],
          },
          options.bulkStatus
        );
      }
      const body = JSON.parse(String(init?.body)) as { requests: unknown[] };
      return json({ results: body.requests.map((_, i) => ({ id: String(100 + i), revision: '1' })) });
    }
    if (url.pathname === '/k/v1/record.json' && init?.method === 'PUT') return json({ revision: '2' });
    if (url.pathname === '/k/v1/record.json') return options.log ? json({ record: options.log }) : json({ message: 'nf' }, 404);
    return undefined;
  });
}

async function clerkRequest(path: string, body?: unknown) {
  const token = await makeToken({ clerk: true, name: '事務 佐藤', sub: 'clerk-sato' });
  return new Request(`${WORKER}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const futureTransfer = { ...transfer, switchDate: '2099-12-01' };

describe('POST /office/ledger/preview', () => {
  it('書き込まずに、台帳がどう変わるかを返す', async () => {
    const calls = stubKintone({});
    const response = await office.fetch(await clerkRequest('/office/ledger/preview', futureTransfer), env);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { summary: string[] };
    expect(body.summary).toHaveLength(4);
    expect(calls.some((c) => c.url.pathname === '/k/v1/bulkRequest.json')).toBe(false);
    // 物件で所有状況を絞り、今の所有者のユーザーで組合員・所有状況・駐車場契約を読む
    const queries = calls.map((c) => c.url.searchParams.get('query') ?? '');
    expect(queries.some((q) => q.startsWith('property = "01-101"'))).toBe(true);
    expect(queries.some((q) => q.startsWith('user in ("01101yamada")'))).toBe(true);
    // 新しい表示が重ならないよう、物件名を含む組合員の表示も読む
    expect(queries.some((q) => q.startsWith('display like "01-101"'))).toBe(true);
  });

  it('入力の誤りは 400 と画面に出すエラー', async () => {
    stubKintone({});
    const response = await office.fetch(await clerkRequest('/office/ledger/preview', { ...transfer, newLogin: '' }), env);
    expect(response.status).toBe(400);
  });
});

describe('POST /office/ledger', () => {
  it('台帳の書き込みと更新記録を 1 回の bulkRequest で送り、作った番号を記録に足す', async () => {
    const calls = stubKintone({});
    const response = await office.fetch(await clerkRequest('/office/ledger', futureTransfer), env);
    expect(response.status).toBe(201);
    const body = (await response.json()) as { logId: string; notices: string[] };
    expect(body.logId).toBe('104');
    const bulk = calls.find((c) => c.url.pathname === '/k/v1/bulkRequest.json');
    const sent = JSON.parse(String(bulk?.init?.body)) as { requests: { payload: { app: string } }[] };
    expect(sent.requests.map((r) => r.payload.app)).toEqual(['44', '96', '96', '44', '200']);
    const saved = calls.find((c) => c.init?.method === 'PUT');
    const after = JSON.parse(JSON.parse(String(saved?.init?.body)).record.after.value);
    expect(after.ids).toEqual({ member: '102', ownership: '103' });
    expect(body.notices.length).toBeGreaterThan(0);
  });

  it('同じ送信キーの記録があれば、書き込まずにその番号を返す', async () => {
    const calls = stubKintone({ existing: [{ $id: { value: '55' } }] });
    const response = await office.fetch(await clerkRequest('/office/ledger', futureTransfer), env);
    expect(await response.json()).toEqual({ logId: '55', duplicate: true });
    expect(calls.some((c) => c.url.pathname === '/k/v1/bulkRequest.json')).toBe(false);
  });

  it('kintone が断ったら 409 と画面に出すことばを返し、kintone のメッセージ（個人情報を含みうる）は返さない', async () => {
    stubKintone({ bulkStatus: 400, bulkCode: 'GAIA_CO02' });
    const response = await office.fetch(await clerkRequest('/office/ledger', futureTransfer), env);
    expect(response.status).toBe(409);
    const text = JSON.stringify(await response.json());
    expect(text).toContain('ほかの人が先に台帳を変えました');
    expect(text).not.toContain('山田');
  });

  it('kintone が断ったら、エラーコード・断られた書き込みの番号とアプリ・フィールドのキーだけをログに残す', async () => {
    stubKintone({ bulkStatus: 400, bulkCode: 'CB_VA01' });
    const response = await office.fetch(await clerkRequest('/office/ledger', futureTransfer), env);
    // 新しい組合員のログイン名のユーザーがないときは、画面にもそう出す（本番で確かめた CB_VA01・record.user.values.value）
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).toContain(
      `ログイン名 ${futureTransfer.newLogin} のユーザーが cybozu.com にありません`
    );
    const warn = vi.mocked(console.warn);
    const logged = warn.mock.calls.find((c) => c[0] === '[Office] kintone rejected');
    expect(logged).toBeDefined();
    expect(JSON.parse(String(logged?.[1]))).toEqual({
      action: '名義変更',
      status: 400,
      code: 'CB_VA01',
      request: 1,
      app: '96',
      fields: ['record.user.values.value'],
    });
    // kintone のメッセージ・値（個人情報を含みうる）は残さない
    const all = JSON.stringify(warn.mock.calls);
    expect(all).not.toContain('山田');
    expect(all).not.toContain('存在しません');
  });

  it('台帳の更新のアプリ ID が未設定なら 500（住戸の一覧は使える）', async () => {
    stubKintone({});
    const response = await office.fetch(await clerkRequest('/office/ledger', futureTransfer), {
      ...env,
      KINTONE_APP_ID_LEDGER_LOG: undefined,
    });
    expect(response.status).toBe(500);
  });

  it('事務員でなければ 403（kintone には問い合わせない）', async () => {
    const calls = stubKintone({});
    const token = await makeToken({ koho: true });
    const response = await office.fetch(
      new Request(`${WORKER}/office/ledger`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(futureTransfer),
      }),
      env
    );
    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
});

describe('GET /office/ledger/logs と取り消し', () => {
  it('その日の記録を、日本時間の 1 日の範囲で読む（変更前後の値・送信キーは返さない）', async () => {
    const calls = stubKintone({
      logs: [{ $id: { value: '9' }, type: { value: '名義変更' }, before: { value: '{"x":1}' }, submit_key: { value: 'secret' } }],
    });
    const response = await office.fetch(await clerkRequest('/office/ledger/logs?date=2026-11-28'), env);
    const body = (await response.json()) as { logs: { id: string }[] };
    expect(body.logs.map((l) => l.id)).toEqual(['9']);
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(calls[0].url.searchParams.get('query')).toContain('entered_at >= "2026-11-28T00:00:00+09:00" and entered_at < "2026-11-29T00:00:00+09:00"');
  });

  it('今日の記録は取り消せる。見つからなければ 404', async () => {
    const planned = planRename(rename, context(), apps, 'x', new Date().toISOString());
    if (!planned.ok) throw new Error('not ok');
    const calls = stubKintone({ log: { $id: { value: '8' }, ...planned.value.logRecord } });
    const response = await office.fetch(await clerkRequest('/office/ledger/logs/8/cancel', {}), env);
    expect(response.status).toBe(200);
    expect(calls.some((c) => c.url.pathname === '/k/v1/bulkRequest.json')).toBe(true);

    stubKintone({});
    const missing = await office.fetch(await clerkRequest('/office/ledger/logs/999/cancel', {}), env);
    expect(missing.status).toBe(404);
  });

  it('todayJst と同じ日を「今日」として扱う', () => {
    expect(jstDate(new Date().toISOString())).toBe(todayJst());
  });
});
