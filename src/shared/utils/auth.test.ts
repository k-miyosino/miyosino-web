// @vitest-environment jsdom
/**
 * ログインのトークンの扱い（auth.ts）: ログイン後の URL から取り出して保存し、URL から消す
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_CHANGE_EVENT,
  getRefreshToken,
  getToken,
  handleAuthCallback,
  hasValidToken,
  isOpsAdmin,
} from './auth';

/** 署名なしの JWT（画面の側は署名を確かめないので、中身だけあればよい） */
function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    return btoa(String.fromCharCode(...bytes))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  };
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

const now = () => Math.floor(Date.now() / 1000);

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/member/');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleAuthCallback（ログインの戻り）', () => {
  it('# のトークンを保存し、URL からトークンだけを消す', () => {
    const token = fakeJwt({ sub: 'user-a', exp: now() + 3600 });
    window.history.replaceState(
      {},
      '',
      `/member/?tab=1#token=${token}&refresh_token=refresh-1&section=top`
    );
    const changed = vi.fn();
    window.addEventListener(AUTH_CHANGE_EVENT, changed);

    expect(handleAuthCallback()).toBe(true);
    expect(getToken()).toBe(token);
    expect(getRefreshToken()).toBe('refresh-1');
    // ブラウザの履歴にトークンを残さない（ほかの値は残す）
    expect(window.location.search).toBe('?tab=1');
    expect(window.location.hash).toBe('#section=top');
    expect(changed).toHaveBeenCalledOnce();
    window.removeEventListener(AUTH_CHANGE_EVENT, changed);
  });

  it('古い Worker の ?token= にも対応する', () => {
    const token = fakeJwt({ sub: 'user-a', exp: now() + 3600 });
    window.history.replaceState({}, '', `/member/?token=${token}`);
    expect(handleAuthCallback()).toBe(true);
    expect(getToken()).toBe(token);
    expect(window.location.search).toBe('');
  });

  it('トークンが無ければ何もしない', () => {
    window.history.replaceState({}, '', '/member/#events');
    expect(handleAuthCallback()).toBe(false);
    expect(getToken()).toBeNull();
    expect(window.location.hash).toBe('#events');
  });
});

describe('hasValidToken・isOpsAdmin（画面の表示の切り替え）', () => {
  it('期限内のトークンがあれば true', () => {
    localStorage.setItem('auth_token', fakeJwt({ exp: now() + 3600 }));
    expect(hasValidToken()).toBe(true);
  });

  it('期限切れ（30秒の余裕を含む）なら false', () => {
    localStorage.setItem('auth_token', fakeJwt({ exp: now() + 10 }));
    expect(hasValidToken()).toBe(false);
  });

  it('形の崩れたトークンは false', () => {
    localStorage.setItem('auth_token', 'not-a-jwt');
    expect(hasValidToken()).toBe(false);
    expect(isOpsAdmin()).toBe(false);
  });

  it('admin が true のときだけ管理者とみなす（日本語の名前があっても読める）', () => {
    localStorage.setItem(
      'auth_token',
      fakeJwt({ name: '管理 花子', admin: true, exp: now() + 3600 })
    );
    expect(isOpsAdmin()).toBe(true);
    localStorage.setItem(
      'auth_token',
      fakeJwt({ name: '組合員 太郎', exp: now() + 3600 })
    );
    expect(isOpsAdmin()).toBe(false);
  });

  it('管理者のトークンでも、期限切れなら管理者とみなさない', () => {
    localStorage.setItem(
      'auth_token',
      fakeJwt({ admin: true, exp: now() - 60 })
    );
    expect(isOpsAdmin()).toBe(false);
  });
});
