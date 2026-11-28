/**
 * 事務員専用ページの Worker（office.ts）: 事務員だけに答えること、住戸と所有者の一覧
 */

import { describe, expect, it } from 'vitest';
import office from '../api/office';
import { OwnershipRecord, PropertyRecord, buildUnits, todayJst } from '../api/_office';
import { TEST_SECRET, json, makeToken, silenceConsole, stubFetch } from './helpers';

silenceConsole();

const WORKER = 'https://miyosino-office.example.workers.dev';
const KINTONE_DOMAIN = 'example.cybozu.com';

const env = {
  JWT_SECRET: TEST_SECRET,
  KINTONE_DOMAIN,
  KINTONE_API_TOKEN_OFFICE: 'token-property,token-ownership',
  KINTONE_APP_ID_PROPERTY: '133',
  KINTONE_APP_ID_OWNERSHIP: '132',
};

function property(id: string, name: string, building: string, room: string): PropertyRecord {
  return {
    $id: { value: id },
    property_name: { value: name },
    building: { value: building },
    room_number: { value: room },
  };
}

function ownership(
  id: string,
  propertyName: string,
  member: string,
  start: string | null,
  end: string | null,
  userCode = `${propertyName.replace('-', '')}user`
): OwnershipRecord {
  return {
    $id: { value: id },
    property: { value: propertyName },
    member: { value: member },
    start_date: { value: start },
    end_date: { value: end },
    user: { value: [{ code: userCode, name: member }] },
  };
}

function request(path: string, token?: string, init: RequestInit = {}): Request {
  return new Request(`${WORKER}${path}`, {
    ...init,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** kintone の応答を差し替える。アプリ ID ごとにレコードを返す */
function stubKintone(records: Record<string, unknown[]>) {
  return stubFetch((url) => {
    if (url.host !== KINTONE_DOMAIN || url.pathname !== '/k/v1/records.json') {
      return undefined;
    }
    const app = url.searchParams.get('app') ?? '';
    return json({ records: records[app] ?? [] });
  });
}

describe('事務員の確認', () => {
  it('トークンが無ければ 401', async () => {
    const response = await office.fetch(request('/office/me'), env);
    expect(response.status).toBe(401);
  });

  it('別の鍵で署名したトークンは 401', async () => {
    const token = await makeToken({ clerk: true }, 'another-secret');
    const response = await office.fetch(request('/office/me', token), env);
    expect(response.status).toBe(401);
  });

  it('事務員でない（clerk がない）なら 403。管理者でも 403', async () => {
    const member = await makeToken();
    expect((await office.fetch(request('/office/me', member), env)).status).toBe(403);
    const admin = await makeToken({ admin: true });
    expect((await office.fetch(request('/office/me', admin), env)).status).toBe(403);
  });

  it('利用者を識別できなかったトークンは、clerk があっても 403', async () => {
    const token = await makeToken({ sub: 'kintone-user', clerk: true });
    const response = await office.fetch(request('/office/me', token), env);
    expect(response.status).toBe(403);
  });

  it('事務員なら、本人の名前を返す（キャッシュさせない）', async () => {
    const token = await makeToken({ clerk: true, name: '事務 佐藤', sub: 'clerk-sato' });
    const response = await office.fetch(request('/office/me', token), env);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ code: 'clerk-sato', name: '事務 佐藤' });
  });

  it('設定が足りなければ 500（kintone には問い合わせない）', async () => {
    const calls = stubKintone({});
    const token = await makeToken({ clerk: true });
    const response = await office.fetch(request('/office/units', token), {
      ...env,
      KINTONE_APP_ID_OWNERSHIP: '',
    });
    expect(response.status).toBe(500);
    expect(calls).toHaveLength(0);
  });

  it('知らないパスは 404', async () => {
    const token = await makeToken({ clerk: true });
    const response = await office.fetch(request('/office/unknown', token), env);
    expect(response.status).toBe(404);
  });
});

describe('住戸の一覧（GET /office/units）', () => {
  it('M_物件と所有状況を API トークンで読み、今日所有中の組合員を付けて返す', async () => {
    const today = todayJst();
    const calls = stubKintone({
      '133': [
        property('2', '01-102', '1', '102'),
        property('1', '01-101', '1', '101'),
      ],
      '132': [
        ownership('10', '01-101', '01-101 山田', '2020-04-01', null),
        // 終わった所有は付けない
        ownership('11', '01-102', '01-102 前の人', '2010-01-01', '2020-03-31'),
      ],
    });
    const token = await makeToken({ clerk: true });
    const response = await office.fetch(request('/office/units', token), env);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      date: string;
      units: { name: string; owner: { display: string } | null }[];
    };
    expect(body.date).toBe(today);
    expect(body.units.map((u) => u.name)).toEqual(['01-101', '01-102']);
    expect(body.units[0].owner?.display).toBe('01-101 山田');
    expect(body.units[1].owner).toBeNull();
    // トークンはヘッダーで送り、URL には入れない
    expect(calls.length).toBe(2);
    for (const call of calls) {
      expect(new Headers(call.init?.headers).get('X-Cybozu-API-Token')).toBe(
        'token-property,token-ownership'
      );
      expect(call.url.toString()).not.toContain('token-');
    }
  });

  it('kintone が失敗したら 500 を返し、応答の中身はログに出さない', async () => {
    stubFetch(() => json({ message: '01-101 山田 の個人情報を含むエラー' }, 520));
    const token = await makeToken({ clerk: true });
    const response = await office.fetch(request('/office/units', token), env);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
  });
});

describe('buildUnits（所有中の判定と並べ方）', () => {
  const properties = [
    property('3', '02-101', '2', '101'),
    property('2', '01-110', '1', '110'),
    property('1', '01-102', '1', '102'),
  ];

  it('物件名の順（数字として）に並べる', () => {
    const units = buildUnits(properties, [], '2026-12-01');
    expect(units.map((u) => u.name)).toEqual(['01-102', '01-110', '02-101']);
  });

  it('開始日〜終了日に入っている日だけ所有中とみなす（両端を含む）', () => {
    const owners = [ownership('1', '01-102', '旧', '2020-01-01', '2026-11-30')];
    expect(buildUnits(properties, owners, '2026-11-30')[0].owner?.display).toBe('旧');
    expect(buildUnits(properties, owners, '2026-12-01')[0].owner).toBeNull();
    expect(buildUnits(properties, owners, '2019-12-31')[0].owner).toBeNull();
  });

  it('名義変更の境目では、旧組合員と新組合員が重ならない', () => {
    const owners = [
      ownership('1', '01-102', '旧', '2020-01-01', '2026-11-15', 'old'),
      ownership('2', '01-102', '新', '2026-11-16', null, 'new'),
    ];
    expect(buildUnits(properties, owners, '2026-11-15')[0].owner?.userCode).toBe('old');
    const after = buildUnits(properties, owners, '2026-11-16')[0];
    expect(after.owner?.userCode).toBe('new');
    expect(after.ownerConflict).toBe(false);
  });

  it('同じ日に所有中が 2 件あれば ownerConflict を立てる（台帳の誤りを画面で知らせる）', () => {
    const owners = [
      ownership('1', '01-102', 'A', '2020-01-01', null),
      ownership('2', '01-102', 'B', '2021-01-01', null),
    ];
    expect(buildUnits(properties, owners, '2026-12-01')[0].ownerConflict).toBe(true);
  });
});

describe('todayJst', () => {
  it('日本時間の日付にする（UTC の 15:00 は翌日）', () => {
    expect(todayJst(Date.parse('2026-11-23T14:59:00Z'))).toBe('2026-11-23');
    expect(todayJst(Date.parse('2026-11-23T15:00:00Z'))).toBe('2026-11-24');
  });
});
