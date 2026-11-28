/**
 * 広報ページの Worker（koho.ts）: 広報委員だけに答えること、リンク集の中身
 */

import { describe, expect, it } from 'vitest';
import koho from '../api/koho';
import { KOHO_GUIDE, buildKintoneApps, buildMicrocms } from '../api/_koho-catalog';
import { TEST_SECRET, makeToken, silenceConsole, stubFetch } from './helpers';

silenceConsole();

const WORKER = 'https://miyosino-koho.example.workers.dev';
const env = { JWT_SECRET: TEST_SECRET, KINTONE_DOMAIN: 'example.cybozu.com' };

function request(token?: string, path = '/koho/links'): Request {
  return new Request(`${WORKER}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe('広報委員の確認', () => {
  it('トークンが無ければ 401、別の鍵の署名も 401', async () => {
    expect((await koho.fetch(request(), env)).status).toBe(401);
    const forged = await makeToken({ koho: true }, 'another-secret');
    expect((await koho.fetch(request(forged), env)).status).toBe(401);
  });

  it('広報委員でなければ 403（管理者・事務員でも 403）', async () => {
    for (const overrides of [{}, { admin: true as const }, { clerk: true as const }]) {
      const token = await makeToken(overrides);
      expect((await koho.fetch(request(token), env)).status).toBe(403);
    }
  });

  it('利用者を識別できなかったトークンは、koho があっても 403', async () => {
    const token = await makeToken({ sub: 'kintone-user', koho: true });
    expect((await koho.fetch(request(token), env)).status).toBe(403);
  });

  it('設定が足りなければ 500', async () => {
    const token = await makeToken({ koho: true });
    const response = await koho.fetch(request(token), { ...env, KINTONE_DOMAIN: '' });
    expect(response.status).toBe(500);
  });

  it('知らないパスは 404', async () => {
    const token = await makeToken({ koho: true });
    expect((await koho.fetch(request(token, '/koho/unknown'), env)).status).toBe(404);
  });
});

describe('リンク集（GET /koho/links）', () => {
  it('広報委員には、リンク集を返す（外には問い合わせない。キャッシュさせない）', async () => {
    const calls = stubFetch(() => undefined);
    const token = await makeToken({ koho: true, name: '広報 花子', sub: 'koho-hanako' });
    const response = await koho.fetch(request(token), env);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = (await response.json()) as {
      me: { name: string };
      kintone: { key: string; listUrl: string; addUrl: string }[];
      microcms: { url: string };
      guide: unknown[];
    };
    expect(body.me.name).toBe('広報 花子');
    expect(body.kintone.find((a) => a.key === 'announcements')).toMatchObject({
      listUrl: 'https://example.cybozu.com/k/53/',
      addUrl: 'https://example.cybozu.com/k/53/edit',
    });
    expect(body.microcms.url).toBe('https://k-miyoshino.microcms.io/apis/contents');
    expect(body.guide).toHaveLength(KOHO_GUIDE.length);
    expect(calls).toHaveLength(0);
  });
});

describe('buildKintoneApps', () => {
  it('ホームページの Worker が読んでいるアプリ ID と同じ', () => {
    const ids = Object.fromEntries(buildKintoneApps(env).map((a) => [a.key, a.appId]));
    expect(ids).toMatchObject({
      announcements: '53',
      circulars: '54',
      events: '49',
      greenwellness: '51',
      minutes: '48',
      applications: '56',
    });
  });

  it('歴史・周辺施設は、アプリ ID が設定されているときだけ出す（数字でなければ出さない）', () => {
    expect(buildKintoneApps(env).map((a) => a.key)).not.toContain('history');
    const withIds = buildKintoneApps({
      ...env,
      KINTONE_APP_ID_HISTORY: '60',
      KINTONE_APP_ID_PLACES: 'abc',
    });
    expect(withIds.find((a) => a.key === 'history')?.addUrl).toBe(
      'https://example.cybozu.com/k/60/edit'
    );
    expect(withIds.map((a) => a.key)).not.toContain('places');
  });

  it('公開の切り替えがあるアプリには、その注意を付ける', () => {
    const apps = Object.fromEntries(buildKintoneApps(env).map((a) => [a.key, a]));
    expect(apps.announcements.note).toContain('公開');
    expect(apps.applications.note).toContain('非公開');
  });
});

describe('buildMicrocms・早見表', () => {
  it('microCMS のサービスのドメインを変えられる', () => {
    expect(buildMicrocms({ ...env, MICROCMS_SERVICE_DOMAIN: 'other' }).url).toBe(
      'https://other.microcms.io/apis/contents'
    );
  });

  it('早見表は kintone・microCMS・ソースのどれかで直す', () => {
    for (const row of KOHO_GUIDE) {
      expect(['kintone', 'microCMS', 'ソース']).toContain(row.editIn);
    }
  });
});
