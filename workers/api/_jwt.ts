/**
 * JWT（HS256）の作成と検証
 * 認証Worker（auth.ts）が発行し、各Workerが同じ JWT_SECRET で検証します。
 * ペイロードは UTF-8 で符号化します（表示名に日本語が入るため。btoa は日本語を扱えない）。
 */

export interface JWTPayload {
  sub: string; // ユーザーID（kintone のユーザーコード。識別できなかったときは 'kintone-user'）
  name: string; // ユーザー名
  email: string;
  // 運用ダッシュボードの管理者（kintone の「システム管理者判定」アプリを閲覧できる人＝「システム管理」グループ）。管理者でなければ付けない
  admin?: true;
  // 事務員専用ページの事務員（kintone の「事務員判定」アプリを閲覧できる人＝「事務員」グループ）。事務員でなければ付けない
  clerk?: true;
  // 広報ページの広報委員（kintone の「広報委員判定」アプリを閲覧できる人＝「広報」グループ）。広報委員でなければ付けない
  koho?: true;
  iat: number; // 発行時刻
  exp: number; // 有効期限
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value: string): Uint8Array {
  return Uint8Array.from(
    atob(value.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  );
}

function importHmacKey(
  secret: string,
  usage: 'sign' | 'verify'
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  );
}

export async function generateJWT(
  payload: JWTPayload,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const encodedHeader = base64UrlEncode(
    encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  );
  const encodedPayload = base64UrlEncode(
    encoder.encode(JSON.stringify(payload))
  );
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await importHmacKey(secret, 'sign');
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return `${data}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** 署名と有効期限を確かめてペイロードを返す。不正・期限切れなら null */
export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    const key = await importHmacKey(secret, 'verify');
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );
    if (!valid) {
      return null;
    }

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(encodedPayload))
    ) as JWTPayload;
    if (payload.exp < Date.now() / 1000) {
      return null;
    }
    return payload;
  } catch (error) {
    console.error('[JWT] verification error:', error);
    return null;
  }
}
