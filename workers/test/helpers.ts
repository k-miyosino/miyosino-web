/**
 * テストの共通部品。
 * Worker は Node.js（Vitest）の上でそのまま動かす。外への通信（kintone・Cloudflare）は fetch を差し替えて返す。
 */

import { afterEach, beforeEach, vi } from 'vitest';
import { JWTPayload, generateJWT } from '../api/_jwt';

// テストだけで使う署名の鍵（本番の JWT_SECRET とは関係ない）
export const TEST_SECRET = 'test-secret-for-vitest-only';

/** Worker のログを黙らせる（失敗したテストの読みやすさのため） */
export function silenceConsole(): void {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
}

/** 有効期限つきの JWT を作る。overrides で中身を変えられる */
export function makeToken(
  overrides: Partial<JWTPayload> = {},
  secret = TEST_SECRET
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return generateJWT(
    {
      sub: 'user-a',
      name: '組合員 太郎',
      email: 'member@example.com',
      iat: now,
      exp: now + 3600,
      ...overrides,
    },
    secret
  );
}

/** JSON を返す Response */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Route = (url: URL, init: RequestInit | undefined) => Response | undefined;

/**
 * fetch を差し替える。routes を順に試し、最初に Response を返したものを使う。
 * どれにも当たらない通信はテストの失敗にする（思わぬ外部への通信に気づくため）
 */
export function stubFetch(...routes: Route[]) {
  const calls: { url: URL; init: RequestInit | undefined }[] = [];
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push({ url, init });
    for (const route of routes) {
      const response = route(url, init);
      if (response) return response;
    }
    throw new Error(`想定していない通信: ${url}`);
  });
  vi.stubGlobal('fetch', mock);
  return calls;
}
