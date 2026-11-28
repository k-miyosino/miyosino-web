/**
 * 認証 Worker（auth.ts）: ログイン後の行き先の検証と、管理者・事務員の判定
 */

import { describe, expect, it } from 'vitest';
import auth from '../api/auth';
import { verifyJWT } from '../api/_jwt';
import { TEST_SECRET, json, silenceConsole, stubFetch } from './helpers';

silenceConsole();

const KINTONE_DOMAIN = 'example.cybozu.com';
const WORKER = 'https://miyosino-auth.example.workers.dev';
const SITE = 'https://k-miyosino.com';

const env = {
  KINTONE_DOMAIN,
  KINTONE_CLIENT_ID: 'client-id',
  KINTONE_CLIENT_SECRET: 'client-secret',
  JWT_SECRET: TEST_SECRET,
  KINTONE_LOGIN_LOG_APP_ID: '200',
  KINTONE_OPS_ADMIN_APP_ID: '141',
  KINTONE_OFFICE_CLERK_APP_ID: '142',
};

function login(redirectUri: string): Promise<Response> {
  const url = new URL(`${WORKER}/login`);
  url.searchParams.set('redirect_uri', redirectUri);
  return auth.fetch(new Request(url), env);
}

function makeState(nonce: string, redirect: string): string {
  return btoa(JSON.stringify({ nonce, redirect }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function callback(
  state: string,
  cookieNonce: string,
  testEnv: typeof env = env
): Promise<Response> {
  const url = new URL(`${WORKER}/callback`);
  url.searchParams.set('code', 'auth-code');
  url.searchParams.set('state', state);
  return auth.fetch(
    new Request(url, { headers: { Cookie: `oauth_nonce=${cookieNonce}` } }),
    testEnv
  );
}

/**
 * kintone の応答を差し替える。
 * - トークンの取得は成功させる
 * - 「ログイン記録」アプリにレコードを足すと、作成者が user-a のレコードを返す
 * - 「システム管理者判定」アプリが読めるかは opsAdminStatus（200 なら管理者、403 なら管理者でない）
 * - 「事務員判定」アプリが読めるかは clerkStatus（200 なら事務員、403 なら事務員でない）
 */
function stubKintone(opsAdminStatus: number, clerkStatus = 403) {
  return stubFetch((url, init) => {
    if (url.host !== KINTONE_DOMAIN) return undefined;
    if (url.pathname === '/oauth2/token') {
      return json({
        access_token: 'access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'k:app_record:read',
        refresh_token: 'refresh-token',
      });
    }
    if (url.pathname === '/k/v1/record.json' && init?.method === 'POST') {
      return json({ id: '1', revision: '1' });
    }
    if (url.pathname === '/k/v1/record.json') {
      return json({
        record: {
          作成者: {
            type: 'CREATOR',
            value: { code: 'user-a', name: '組合員 太郎' },
          },
        },
      });
    }
    if (url.pathname === '/k/v1/records.json') {
      const app = url.searchParams.get('app');
      const readable =
        (app === '141' && opsAdminStatus === 200) ||
        (app === '142' && clerkStatus === 200);
      return readable
        ? json({ records: [] })
        : json({ message: 'no permission' }, 403);
    }
    return undefined;
  });
}

/** ログイン後の行き先（Location）の # から JWT を取り出して確かめる */
async function tokenFromRedirect(response: Response) {
  const location = new URL(response.headers.get('Location') ?? '');
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  return {
    location,
    payload: token ? await verifyJWT(token, TEST_SECRET) : null,
  };
}

describe('ログインの開始（/login）', () => {
  it('許可したサイトへの行き先なら、kintone のログイン画面へ送る', async () => {
    const response = await login(`${SITE}/member/`);
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('Location') ?? '');
    expect(location.host).toBe(KINTONE_DOMAIN);
    expect(location.pathname).toBe('/oauth2/authorization');
    // 行き先は state に入れて持ち回る
    const state = location.searchParams.get('state') ?? '';
    const decoded = JSON.parse(
      atob(state.replace(/-/g, '+').replace(/_/g, '/'))
    ) as { nonce: string; redirect: string };
    expect(decoded.redirect).toBe(`${SITE}/member/`);
    expect(response.headers.get('Set-Cookie')).toContain(
      `oauth_nonce=${decoded.nonce}`
    );
  });

  it.each([
    'https://evil.example/member/',
    // 許可したドメインに見せかけたもの
    'https://k-miyosino.com.evil.example/member/',
    'https://evil.example/?https://k-miyosino.com/',
    'javascript:alert(1)',
    '//evil.example/member/',
  ])('許可していない行き先（%s）は断る', async (redirectUri) => {
    const response = await login(redirectUri);
    expect(response.status).toBe(400);
    expect(response.headers.get('Location')).toBeNull();
  });
});

describe('ログインの戻り（/callback）', () => {
  it('state の nonce と Cookie が合わなければ断る（CSRF 対策）', async () => {
    stubKintone(200);
    const response = await callback(
      makeState('nonce-1', `${SITE}/member/`),
      'nonce-2'
    );
    expect(response.status).toBe(400);
  });

  it('state の行き先が許可していないサイトなら、トークンを渡さずに断る', async () => {
    const calls = stubKintone(200);
    const response = await callback(
      makeState('nonce-1', 'https://evil.example/'),
      'nonce-1'
    );
    expect(response.status).toBe(400);
    expect(response.headers.get('Location')).toBeNull();
    // kintone のトークンも取りに行かない
    expect(calls).toHaveLength(0);
  });

  it('「システム管理者判定」アプリが読める人は、JWT に admin が入る', async () => {
    stubKintone(200);
    const response = await callback(
      makeState('nonce-1', `${SITE}/member/`),
      'nonce-1'
    );
    expect(response.status).toBe(302);
    const { location, payload } = await tokenFromRedirect(response);
    expect(location.origin).toBe(SITE);
    expect(location.search).toBe(''); // トークンはクエリではなく # で渡す
    expect(payload?.sub).toBe('user-a');
    expect(payload?.admin).toBe(true);
  });

  it('「システム管理者判定」アプリが読めない（403）人は、admin が入らない', async () => {
    stubKintone(403);
    const response = await callback(
      makeState('nonce-1', `${SITE}/member/`),
      'nonce-1'
    );
    const { payload } = await tokenFromRedirect(response);
    expect(payload?.sub).toBe('user-a');
    expect(payload?.admin).toBeUndefined();
  });

  it('KINTONE_OPS_ADMIN_APP_ID が無ければ、だれも管理者にしない', async () => {
    stubKintone(200);
    const response = await callback(
      makeState('nonce-1', `${SITE}/member/`),
      'nonce-1',
      { ...env, KINTONE_OPS_ADMIN_APP_ID: undefined } as unknown as typeof env
    );
    const { payload } = await tokenFromRedirect(response);
    expect(payload?.admin).toBeUndefined();
  });

  it('利用者を識別できなかった人は、アプリが読めても管理者にしない', async () => {
    stubKintone(200);
    const response = await callback(
      makeState('nonce-1', `${SITE}/member/`),
      'nonce-1',
      { ...env, KINTONE_LOGIN_LOG_APP_ID: undefined } as unknown as typeof env
    );
    const { payload } = await tokenFromRedirect(response);
    expect(payload?.sub).toBe('kintone-user');
    expect(payload?.admin).toBeUndefined();
  });
});

describe('事務員の判定（/callback）', () => {
  const SEVEN_DAYS = 60 * 60 * 24 * 7;
  const TWELVE_HOURS = 60 * 60 * 12;

  it('「事務員判定」アプリが読める人は、JWT に clerk が入り、有効期限が12時間になる', async () => {
    stubKintone(403, 200);
    const response = await callback(
      makeState('nonce-1', `${SITE}/member/`),
      'nonce-1'
    );
    const { payload } = await tokenFromRedirect(response);
    expect(payload?.sub).toBe('user-a');
    expect(payload?.clerk).toBe(true);
    expect(payload?.admin).toBeUndefined();
    expect((payload?.exp ?? 0) - (payload?.iat ?? 0)).toBe(TWELVE_HOURS);
  });

  it('「事務員判定」アプリが読めない（403）人は、clerk が入らず、有効期限は7日のまま', async () => {
    stubKintone(403, 403);
    const response = await callback(
      makeState('nonce-1', `${SITE}/member/`),
      'nonce-1'
    );
    const { payload } = await tokenFromRedirect(response);
    expect(payload?.clerk).toBeUndefined();
    expect((payload?.exp ?? 0) - (payload?.iat ?? 0)).toBe(SEVEN_DAYS);
  });

  it('管理者と事務員の両方のアプリが読める人は、admin と clerk の両方が入る（有効期限は事務員の12時間）', async () => {
    stubKintone(200, 200);
    const response = await callback(
      makeState('nonce-1', `${SITE}/member/`),
      'nonce-1'
    );
    const { payload } = await tokenFromRedirect(response);
    expect(payload?.admin).toBe(true);
    expect(payload?.clerk).toBe(true);
    expect((payload?.exp ?? 0) - (payload?.iat ?? 0)).toBe(TWELVE_HOURS);
  });

  it('KINTONE_OFFICE_CLERK_APP_ID が無ければ、だれも事務員にしない', async () => {
    stubKintone(403, 200);
    const response = await callback(
      makeState('nonce-1', `${SITE}/member/`),
      'nonce-1',
      { ...env, KINTONE_OFFICE_CLERK_APP_ID: undefined } as unknown as typeof env
    );
    const { payload } = await tokenFromRedirect(response);
    expect(payload?.clerk).toBeUndefined();
  });

  it('利用者を識別できなかった人は、アプリが読めても事務員にしない', async () => {
    stubKintone(403, 200);
    const response = await callback(
      makeState('nonce-1', `${SITE}/member/`),
      'nonce-1',
      { ...env, KINTONE_LOGIN_LOG_APP_ID: undefined } as unknown as typeof env
    );
    const { payload } = await tokenFromRedirect(response);
    expect(payload?.sub).toBe('kintone-user');
    expect(payload?.clerk).toBeUndefined();
    expect((payload?.exp ?? 0) - (payload?.iat ?? 0)).toBe(SEVEN_DAYS);
  });
});

describe('トークンの更新（/refresh）', () => {
  it('更新のたびに管理者を判定し直す（外された人は admin が消える）', async () => {
    stubKintone(403);
    const response = await auth.fetch(
      new Request(`${WORKER}/refresh?refresh_token=refresh-token`),
      env
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { token: string };
    const payload = await verifyJWT(body.token, TEST_SECRET);
    expect(payload?.sub).toBe('user-a');
    expect(payload?.admin).toBeUndefined();
  });

  it('更新のたびに事務員を判定し直す（外された人は clerk が消える）', async () => {
    stubKintone(403, 403);
    const response = await auth.fetch(
      new Request(`${WORKER}/refresh?refresh_token=refresh-token`),
      env
    );
    const body = (await response.json()) as { token: string };
    const payload = await verifyJWT(body.token, TEST_SECRET);
    expect(payload?.clerk).toBeUndefined();
  });

  it('更新でも、事務員なら clerk が入る', async () => {
    stubKintone(403, 200);
    const response = await auth.fetch(
      new Request(`${WORKER}/refresh?refresh_token=refresh-token`),
      env
    );
    const body = (await response.json()) as { token: string };
    const payload = await verifyJWT(body.token, TEST_SECRET);
    expect(payload?.clerk).toBe(true);
  });
});
