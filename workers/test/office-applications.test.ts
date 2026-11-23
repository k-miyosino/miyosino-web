/**
 * 組合員申請（office Worker）: 入力の確認、kintone のレコードへの変換、代理入力・一覧・詳細の API
 */

import { describe, expect, it } from 'vitest';
import office from '../api/office';
import {
  buildSummary,
  fromKintoneRecord,
  parseApplicationInput,
  toKintoneRecord,
} from '../api/_office-applications';
import { todayJst } from '../api/_office';
import { TEST_SECRET, json, makeToken, silenceConsole, stubFetch } from './helpers';

silenceConsole();

const WORKER = 'https://miyosino-office.example.workers.dev';
const KINTONE_DOMAIN = 'example.cybozu.com';
const TODAY = '2026-11-23';

const env = {
  JWT_SECRET: TEST_SECRET,
  KINTONE_DOMAIN,
  KINTONE_API_TOKEN_OFFICE: 'token-a,token-b',
  KINTONE_APP_ID_PROPERTY: '133',
  KINTONE_APP_ID_OWNERSHIP: '132',
  KINTONE_APP_ID_MEMBER_APPLICATION: '150',
};

const transferBody = {
  type: '名義変更',
  submitKey: 'key-12345678',
  submittedDate: '2026-11-20',
  applicantKind: '組合員',
  agent: '',
  propertyName: '01-101',
  transferDate: '2026-11-15',
  switchDate: '2026-12-01',
  newName: '佐藤 次郎',
  newAddress: '川越市かわつる三芳野1',
  newPhone: '049-000-0000',
  moveInDate: '',
  oldAddress: '東京都',
  oldPhone: '03-0000-0000',
};

const infoBody = {
  type: '情報変更',
  submitKey: 'key-abcdefgh',
  submittedDate: '2026-11-20',
  applicantKind: '組合員',
  agent: '',
  propertyName: '01-101',
  newName: '山田 花子',
};

describe('parseApplicationInput', () => {
  it('名義変更の正しい入力を通す（前後の空白は除く）', () => {
    const result = parseApplicationInput({ ...transferBody, newName: ' 佐藤 次郎 ' }, TODAY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe('名義変更');
      expect(result.value.newName).toBe('佐藤 次郎');
    }
  });

  it('情報変更の正しい入力を通す', () => {
    expect(parseApplicationInput(infoBody, TODAY).ok).toBe(true);
  });

  it('種類が正しくなければ、そのことだけを返す', () => {
    const result = parseApplicationInput({ ...transferBody, type: '退会' }, TODAY);
    expect(result).toEqual({ ok: false, errors: ['申請の種類を選んでください'] });
  });

  it('名義変更で必要な日付・氏名が空なら、すべてのエラーを返す', () => {
    const result = parseApplicationInput(
      { ...transferBody, transferDate: '', switchDate: '2026-13-01', newName: '' },
      TODAY
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('名義変更日を入れてください');
      expect(result.errors).toContain('新しい組合員の負担となる日を入れてください');
      expect(result.errors).toContain('新しい組合員の氏名を入れてください');
    }
  });

  it('届出日に今日より後の日は入れられない', () => {
    const result = parseApplicationInput({ ...infoBody, submittedDate: '2026-11-24' }, TODAY);
    expect(result.ok).toBe(false);
  });

  it('代理人のときは、代理人の氏名が要る', () => {
    const result = parseApplicationInput({ ...infoBody, applicantKind: '代理人' }, TODAY);
    expect(result.ok).toBe(false);
    expect(
      parseApplicationInput(
        { ...infoBody, applicantKind: '代理人', agent: '山田 一郎（長男）' },
        TODAY
      ).ok
    ).toBe(true);
  });

  it('情報変更を購入者は出せない', () => {
    const result = parseApplicationInput({ ...infoBody, applicantKind: '購入者' }, TODAY);
    expect(result.ok).toBe(false);
  });

  it('物件名・送信キーの形が正しくなければ通さない（kintone のクエリに入れるため）', () => {
    expect(
      parseApplicationInput({ ...infoBody, propertyName: '01-101" or 1=1' }, TODAY).ok
    ).toBe(false);
    expect(parseApplicationInput({ ...infoBody, submitKey: 'a"b' }, TODAY).ok).toBe(false);
  });

  it('文字数の上限を超えたら通さない', () => {
    expect(
      parseApplicationInput({ ...transferBody, newPhone: '0'.repeat(21) }, TODAY).ok
    ).toBe(false);
  });

  it('オブジェクトでなければ通さない', () => {
    expect(parseApplicationInput(null, TODAY).ok).toBe(false);
  });
});

describe('toKintoneRecord・buildSummary・fromKintoneRecord', () => {
  it('名義変更を、紙の代理入力・申請中のレコードにする', () => {
    const parsed = parseApplicationInput(transferBody, TODAY);
    if (!parsed.ok) throw new Error('入力が通らない');
    const record = toKintoneRecord(parsed.value, '01-101 山田', '事務 佐藤（clerk-sato）');
    expect(record.type.value).toBe('名義変更');
    expect(record.status.value).toBe('申請中');
    expect(record.method.value).toBe('紙（代理入力）');
    expect(record.property.value).toBe('01-101');
    expect(record.member.value).toBe('01-101 山田');
    expect(record.switch_date.value).toBe('2026-12-01');
    expect(record.entered_by.value).toBe('事務 佐藤（clerk-sato）');
    expect(record.submit_key.value).toBe('key-12345678');
    expect(JSON.parse(record.payload.value).input.newName).toBe('佐藤 次郎');
  });

  it('情報変更のレコードには、名義変更だけのフィールドを入れない', () => {
    const parsed = parseApplicationInput(infoBody, TODAY);
    if (!parsed.ok) throw new Error('入力が通らない');
    const record = toKintoneRecord(parsed.value, '01-101 山田', 'x');
    expect(record.switch_date).toBeUndefined();
    expect(record.new_address).toBeUndefined();
  });

  it('要約は人が読める文にする', () => {
    const transfer = parseApplicationInput(transferBody, TODAY);
    const info = parseApplicationInput(infoBody, TODAY);
    if (!transfer.ok || !info.ok) throw new Error('入力が通らない');
    expect(buildSummary(transfer.value, '01-101 山田')).toBe(
      '01-101 の名義を 01-101 山田 から 佐藤 次郎 様に変更（2026年12月1日から新組合員の負担）'
    );
    expect(buildSummary(info.value, '01-101 山田')).toBe(
      '01-101 山田 の氏名を「山田 花子」に変更'
    );
  });

  it('レコードを画面の形にする（送信キー・内容データは返さない）', () => {
    const view = fromKintoneRecord({
      $id: { value: '7' },
      type: { value: '名義変更' },
      status: { value: '申請中' },
      submit_key: { value: 'secret-key' },
      payload: { value: '{}' },
      move_in_date: { value: null },
    });
    expect(view.id).toBe('7');
    expect(view.moveInDate).toBe('');
    expect(JSON.stringify(view)).not.toContain('secret-key');
  });
});

/** kintone の差し替え。所有状況・組合員申請の読み込みと、申請の追加を記録する */
function stubKintone(options: {
  owners?: unknown[];
  existing?: unknown[];
  applications?: unknown[];
  createStatus?: number;
  record?: unknown;
  recordStatus?: number;
}) {
  return stubFetch((url, init) => {
    if (url.host !== KINTONE_DOMAIN) return undefined;
    const app = url.searchParams.get('app');
    const query = url.searchParams.get('query') ?? '';
    if (url.pathname === '/k/v1/records.json' && app === '132') {
      return json({ records: options.owners ?? [] });
    }
    if (url.pathname === '/k/v1/records.json' && app === '150') {
      if (query.startsWith('submit_key')) return json({ records: options.existing ?? [] });
      return json({ records: options.applications ?? [] });
    }
    if (url.pathname === '/k/v1/record.json' && init?.method === 'POST') {
      return options.createStatus && options.createStatus !== 200
        ? json({ code: 'GAIA_LO04', message: 'lookup error 01-101 山田' }, options.createStatus)
        : json({ id: '42', revision: '1' });
    }
    if (url.pathname === '/k/v1/record.json') {
      return options.recordStatus
        ? json({ message: 'not found' }, options.recordStatus)
        : json({ record: options.record });
    }
    return undefined;
  });
}

function owner(member: string, start: string, end: string | null) {
  return {
    $id: { value: '1' },
    property: { value: '01-101' },
    member: { value: member },
    start_date: { value: start },
    end_date: { value: end },
    user: { value: [{ code: '01101yamada', name: '山田' }] },
  };
}

async function clerkRequest(path: string, init: RequestInit = {}) {
  const token = await makeToken({ clerk: true, name: '事務 佐藤', sub: 'clerk-sato' });
  return new Request(`${WORKER}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
}

describe('代理入力（POST /office/applications/proxy）', () => {
  // 届出日は今日より前にする（今日の日付に頼らないように、遠い過去の日にする）
  const body = { ...transferBody, submittedDate: '2020-01-01' };

  it('今日所有中の組合員を旧組合員として、申請中で登録する', async () => {
    const calls = stubKintone({ owners: [owner('01-101 山田', '2010-01-01', null)] });
    const response = await office.fetch(
      await clerkRequest('/office/applications/proxy', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      env
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: '42', duplicate: false });
    const post = calls.find((c) => c.init?.method === 'POST');
    const sent = JSON.parse(String(post?.init?.body));
    expect(sent.app).toBe('150');
    expect(sent.record.member.value).toBe('01-101 山田');
    expect(sent.record.entered_by.value).toBe('事務 佐藤（clerk-sato）');
    // 所有状況は物件で絞って読む
    const ownerCall = calls.find((c) => c.url.searchParams.get('app') === '132');
    expect(ownerCall?.url.searchParams.get('query')).toContain('property = "01-101"');
  });

  it('同じ送信キーの申請がすでにあれば、新しく作らずにその番号を返す', async () => {
    const calls = stubKintone({ existing: [{ $id: { value: '41' } }] });
    const response = await office.fetch(
      await clerkRequest('/office/applications/proxy', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      env
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: '41', duplicate: true });
    expect(calls.some((c) => c.init?.method === 'POST')).toBe(false);
  });

  it('入力が正しくなければ 400 と、画面に出すエラーを返す（kintone には書かない）', async () => {
    const calls = stubKintone({});
    const response = await office.fetch(
      await clerkRequest('/office/applications/proxy', {
        method: 'POST',
        body: JSON.stringify({ ...body, newName: '' }),
      }),
      env
    );
    expect(response.status).toBe(400);
    const result = (await response.json()) as { messages: string[] };
    expect(result.messages).toContain('新しい組合員の氏名を入れてください');
    expect(calls).toHaveLength(0);
  });

  it('所有中の組合員がいない・記録が重なっているお部屋は 400', async () => {
    stubKintone({ owners: [owner('01-101 前の人', '2000-01-01', '2010-12-31')] });
    const none = await office.fetch(
      await clerkRequest('/office/applications/proxy', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      env
    );
    expect(none.status).toBe(400);

    stubKintone({
      owners: [owner('01-101 A', '2010-01-01', null), owner('01-101 B', '2011-01-01', null)],
    });
    const conflict = await office.fetch(
      await clerkRequest('/office/applications/proxy', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      env
    );
    expect(conflict.status).toBe(400);
  });

  it('kintone が登録を断ったら 502 を返し、kintone のメッセージ（個人情報を含みうる）は返さない', async () => {
    stubKintone({ owners: [owner('01-101 山田', '2010-01-01', null)], createStatus: 400 });
    const response = await office.fetch(
      await clerkRequest('/office/applications/proxy', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      env
    );
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain('山田');
  });

  it('壊れた JSON は 400', async () => {
    stubKintone({});
    const response = await office.fetch(
      await clerkRequest('/office/applications/proxy', { method: 'POST', body: '{' }),
      env
    );
    expect(response.status).toBe(400);
  });

  it('事務員でなければ 403（kintone には問い合わせない）', async () => {
    const calls = stubKintone({});
    const token = await makeToken();
    const response = await office.fetch(
      new Request(`${WORKER}/office/applications/proxy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }),
      env
    );
    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it('組合員申請のアプリ ID が未設定なら 500（住戸の一覧は使える）', async () => {
    stubKintone({});
    const response = await office.fetch(
      await clerkRequest('/office/applications'),
      { ...env, KINTONE_APP_ID_MEMBER_APPLICATION: undefined }
    );
    expect(response.status).toBe(500);
  });
});

describe('一覧と詳細（GET /office/applications）', () => {
  it('既定は申請中だけを、状態で絞って読む', async () => {
    const calls = stubKintone({
      applications: [{ $id: { value: '1' }, type: { value: '名義変更' }, status: { value: '申請中' } }],
    });
    const response = await office.fetch(await clerkRequest('/office/applications'), env);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; applications: { id: string }[] };
    expect(body.status).toBe('申請中');
    expect(body.applications.map((a) => a.id)).toEqual(['1']);
    expect(calls[0].url.searchParams.get('query')).toContain('status in ("申請中")');
  });

  it('知らない状態は 400', async () => {
    stubKintone({});
    const response = await office.fetch(
      await clerkRequest('/office/applications?status=' + encodeURIComponent('") or ("')),
      env
    );
    expect(response.status).toBe(400);
  });

  it('詳細を返す。無ければ 404', async () => {
    stubKintone({ record: { $id: { value: '5' }, type: { value: '情報変更' } } });
    const found = await office.fetch(await clerkRequest('/office/applications/5'), env);
    expect(found.status).toBe(200);
    expect(((await found.json()) as { application: { id: string } }).application.id).toBe('5');

    stubKintone({ recordStatus: 404 });
    const missing = await office.fetch(await clerkRequest('/office/applications/999'), env);
    expect(missing.status).toBe(404);
  });
});

describe('todayJst を使う日付の確認', () => {
  it('届出日に今日を入れられる', () => {
    expect(parseApplicationInput({ ...infoBody, submittedDate: todayJst() }, todayJst()).ok).toBe(
      true
    );
  });
});
