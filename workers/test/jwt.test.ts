import { describe, expect, it } from 'vitest';
import { verifyJWT } from '../api/_jwt';
import { TEST_SECRET, makeToken, silenceConsole } from './helpers';

silenceConsole();

describe('JWT（_jwt.ts）', () => {
  it('作った JWT を同じ鍵で確かめると、中身が戻る（日本語の名前も壊れない）', async () => {
    const token = await makeToken({ name: '組合員 太郎', admin: true });
    const payload = await verifyJWT(token, TEST_SECRET);
    expect(payload?.sub).toBe('user-a');
    expect(payload?.name).toBe('組合員 太郎');
    expect(payload?.admin).toBe(true);
  });

  it('違う鍵で署名された JWT は通さない', async () => {
    const token = await makeToken({}, 'another-secret');
    expect(await verifyJWT(token, TEST_SECRET)).toBeNull();
  });

  it('中身を書き換えた JWT は通さない（admin を足すなど）', async () => {
    const token = await makeToken();
    const [header, , signature] = token.split('.');
    const forged = btoa(
      JSON.stringify({
        sub: 'user-a',
        name: 'x',
        email: 'x',
        admin: true,
        iat: 0,
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    )
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    expect(
      await verifyJWT(`${header}.${forged}.${signature}`, TEST_SECRET)
    ).toBeNull();
  });

  it('期限が切れた JWT は通さない', async () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    const token = await makeToken({ iat: past - 3600, exp: past });
    expect(await verifyJWT(token, TEST_SECRET)).toBeNull();
  });

  it('形の崩れた文字列は通さない', async () => {
    expect(await verifyJWT('', TEST_SECRET)).toBeNull();
    expect(await verifyJWT('a.b', TEST_SECRET)).toBeNull();
    expect(await verifyJWT('a.b.c', TEST_SECRET)).toBeNull();
  });
});
