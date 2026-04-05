/**
 * Cloudflare Workers - Kintone OAuth 2.0 認証プロキシ
 *
 * このWorkerはKintone OAuth 2.0認証フローを実装し、
 * 組合員専用ページへのアクセスを制御します。
 *
 * エンドポイント:
 * - GET /login - OAuth認証フロー開始
 * - GET /callback - OAuth認証コールバック
 * - GET /verify - セッション検証
 * - GET /logout - ログアウト
 * - GET /user - ログインユーザー情報取得
 */

interface Env {
  KINTONE_DOMAIN: string; // 例: your-subdomain.cybozu.com
  KINTONE_CLIENT_ID: string;
  KINTONE_CLIENT_SECRET: string;
  JWT_SECRET: string;
}

interface KintoneTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

interface KintoneUserResponse {
  id: string;
  code: string;
  name: string;
  email: string;
  valid: boolean;
}

interface JWTPayload {
  sub: string; // ユーザーID
  name: string; // ユーザー名
  email: string;
  iat: number; // 発行時刻
  exp: number; // 有効期限
}

// JWT関連のヘルパー関数
async function generateJWT(
  payload: JWTPayload,
  secret: string
): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const data = `${encodedHeader}.${encodedPayload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const encodedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  )
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${encodedSignature}`;
}

async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(
      atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(data)
    );

    if (!valid) {
      return null;
    }

    const payload = JSON.parse(
      atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'))
    ) as JWTPayload;

    // 有効期限チェック
    if (payload.exp < Date.now() / 1000) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('[Auth] JWT verification error:', error);
    return null;
  }
}

// CORS ヘッダーを追加
function corsHeaders(origin?: string): Record<string, string> {
  // 本番環境では特定のオリジンのみ許可することを推奨
  const allowedOrigins = [
    'http://localhost:3000',
    'https://k-miyosino.github.io',
    // 本番環境ドメイン
    'https://www.k-miyosino.com',
  ];

  console.log('[CORS] Received origin:', origin);
  console.log('[CORS] Allowed origins:', allowedOrigins);
  console.log(
    '[CORS] Origin in allowed list:',
    origin && allowedOrigins.includes(origin)
  );

  const allowOrigin =
    origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  console.log('[CORS] Selected origin:', allowOrigin);

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || undefined;

    console.log('[Auth] Request:', request.method, url.pathname);
    console.log('[Auth] Origin header:', origin);

    // CORSプリフライトリクエストの処理
    if (request.method === 'OPTIONS') {
      console.log('[Auth] Handling OPTIONS preflight request');
      return new Response(null, {
        headers: corsHeaders(origin),
      });
    }

    // 環境変数チェック
    if (
      !env.KINTONE_DOMAIN ||
      !env.KINTONE_CLIENT_ID ||
      !env.KINTONE_CLIENT_SECRET ||
      !env.JWT_SECRET
    ) {
      console.error('[Auth] Required environment variables are not set');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        }
      );
    }

    const path = url.pathname;

    try {
      // ルーティング
      if (path === '/login') {
        return handleLogin(url, env, origin);
      } else if (path === '/callback') {
        return handleCallback(request, env, origin);
      } else if (path === '/verify') {
        return handleVerify(request, env, origin);
      } else if (path === '/refresh') {
        return handleRefresh(request, env, origin);
      } else if (path === '/logout') {
        return handleLogout(origin);
      } else if (path === '/user') {
        return handleGetUser(request, env, origin);
      } else {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        });
      }
    } catch (error) {
      console.error('[Auth] Error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        }
      );
    }
  },
};

// OAuth認証フロー開始
async function handleLogin(
  url: URL,
  env: Env,
  origin?: string
): Promise<Response> {
  let redirectUri = url.searchParams.get('redirect_uri') || '/member/';

  // redirectUriが相対パスの場合、絶対URLに変換
  try {
    new URL(redirectUri);
    // 既に絶対URLの場合はそのまま
  } catch {
    // 相対パスの場合、originを使って絶対URLに変換
    const baseOrigin = origin || url.origin;
    redirectUri = new URL(redirectUri, baseOrigin).toString();
  }

  const nonce = crypto.randomUUID();

  // redirectUriをstateパラメータに埋め込む（Cookieが送信されない環境でも確実にリダイレクト先を保持する）
  // state = base64url({ nonce, redirect })
  const statePayload = JSON.stringify({ nonce, redirect: redirectUri });
  const state = btoa(statePayload)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  // Kintone OAuth認証URLを構築
  const authUrl = new URL(`https://${env.KINTONE_DOMAIN}/oauth2/authorization`);
  authUrl.searchParams.append('client_id', env.KINTONE_CLIENT_ID);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('redirect_uri', `${url.origin}/callback`);
  authUrl.searchParams.append('state', state);
  // ユーザー情報を取得するAPIが権限エラーになるため、
  // 最小限のスコープ（レコード閲覧）を指定し、
  // トークン取得の成功をもって認証成功とみなします。
  authUrl.searchParams.append('scope', 'k:app_record:read');
  // ログアウト後に再ログインする際、Kintone側のセッションが残っていても
  // 必ずID/PW入力画面を表示させる
  authUrl.searchParams.append('prompt', 'login');

  // nonceをCookieに保存（CSRF対策: stateのnonce部分と照合する）
  // redirectUriはstate自体に含まれるためCookieは不要
  const headers = new Headers({
    Location: authUrl.toString(),
    ...corsHeaders(origin),
  });

  // nonce Cookie（短期間のみ有効）
  headers.append(
    'Set-Cookie',
    `oauth_nonce=${nonce}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=600`
  );

  return new Response(null, {
    status: 302,
    headers,
  });
}

// OAuth認証コールバック
async function handleCallback(
  request: Request,
  env: Env,
  origin?: string
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return new Response(JSON.stringify({ error: 'Invalid callback' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    });
  }

  // stateパラメータからnonceとredirectUriを復元
  let stateNonce: string;
  let redirectUri: string;
  try {
    const decoded = atob(state.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(decoded) as { nonce: string; redirect: string };
    stateNonce = parsed.nonce;
    redirectUri = parsed.redirect;
  } catch {
    // 旧形式（plain UUID）のstateへの後方互換: Cookieから取得
    const cookies = parseCookies(request.headers.get('Cookie') || '');
    stateNonce = state; // 旧形式ではstateそのものがnonce
    redirectUri = decodeURIComponent(cookies.oauth_redirect || '');
    console.warn('[Auth] Legacy state format detected, falling back to cookie');
  }

  // CSRF対策: Cookieのnonceとstateのnonceを照合
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const savedNonce = cookies.oauth_nonce || cookies.oauth_state; // 旧形式も考慮
  if (stateNonce !== savedNonce) {
    console.error('[Auth] State mismatch:', { stateNonce, savedNonce });
    return new Response(JSON.stringify({ error: 'Invalid state' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    });
  }

  // redirectUriが取得できなかった場合のフォールバック（既知の安全なURL）
  if (!redirectUri) {
    const allowedFallbacks: Record<string, string> = {
      'https://www.k-miyosino.com': 'https://www.k-miyosino.com/member/',
      'https://k-miyosino.github.io': 'https://k-miyosino.github.io/miyosino-web/member/',
      'http://localhost:3000': 'http://localhost:3000/member/',
    };
    const fallbackOrigin = origin || Object.keys(allowedFallbacks)[0];
    redirectUri = allowedFallbacks[fallbackOrigin] || 'https://www.k-miyosino.com/member/';
    console.warn('[Auth] redirectUri not found, using fallback:', redirectUri);
  }

  try {
    // アクセストークンを取得
    const tokenResponse = await fetch(
      `https://${env.KINTONE_DOMAIN}/oauth2/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: env.KINTONE_CLIENT_ID,
          client_secret: env.KINTONE_CLIENT_SECRET,
          redirect_uri: `${url.origin}/callback`,
        }),
      }
    );

    if (!tokenResponse.ok) {
      console.error(
        '[Auth] Token request failed:',
        tokenResponse.status,
        await tokenResponse.text()
      );
      return new Response(JSON.stringify({ error: 'Token request failed' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      });
    }

    const tokenData = (await tokenResponse.json()) as KintoneTokenResponse;

    // ユーザー情報を取得するAPI（/v1/users.json）は権限エラー（CB_OA01）になりやすいため、
    // アクセストークンの取得に成功した時点で「認証されたユーザー」とみなします。
    // KintoneのOAuthでは、標準で「現在のユーザー」を取得するAPIが提供されていないため、
    // このアプローチが最も確実です。

    const userData = {
      id: 'kintone-user',
      name: 'Kintone Member',
      email: 'member@example.com',
      valid: true,
    };

    // JWTを生成
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload: JWTPayload = {
      sub: userData.id,
      name: userData.name,
      email: userData.email,
      iat: now,
      exp: now + 60 * 60 * 24 * 7, // 7日間有効
    };

    const jwt = await generateJWT(jwtPayload, env.JWT_SECRET);

    // JWTとrefresh_tokenをURLパラメータとして渡す（クロスドメインCookie問題の回避）
    // redirectUriはstate由来なので既に絶対URL
    let redirectUrl: URL;
    try {
      redirectUrl = new URL(redirectUri);
    } catch {
      console.error('[Auth] Invalid redirectUri:', redirectUri);
      throw new Error(`Invalid redirect URI: ${redirectUri}`);
    }
    redirectUrl.searchParams.set('token', jwt);

    // Kintoneのrefresh_tokenが取得できた場合は渡す（クライアント側でサイレント更新に使用）
    if (tokenData.refresh_token) {
      redirectUrl.searchParams.set('refresh_token', tokenData.refresh_token);
      console.log('[Auth] refresh_token included in redirect');
    }

    console.log('[Auth] Redirecting to:', redirectUrl.origin + redirectUrl.pathname + '?[params]');

    const headers = new Headers({
      Location: redirectUrl.toString(),
      ...corsHeaders(origin),
    });

    // 一時的なCookieを削除
    headers.append(
      'Set-Cookie',
      'oauth_nonce=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0'
    );
    // 旧形式のCookieも削除
    headers.append(
      'Set-Cookie',
      'oauth_state=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0'
    );
    headers.append(
      'Set-Cookie',
      'oauth_redirect=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0'
    );

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (error) {
    console.error('[Auth] Callback error:', error);
    return new Response(
      JSON.stringify({
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      }
    );
  }
}

// セッション検証
async function handleVerify(
  request: Request,
  env: Env,
  origin?: string
): Promise<Response> {
  // Authorization ヘッダーからトークンを取得（localStorage方式）
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;

  if (!token) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    });
  }

  const payload = await verifyJWT(token, env.JWT_SECRET);

  if (!payload) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    });
  }

  return new Response(
    JSON.stringify({
      authenticated: true,
      user: {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    }
  );
}

// リフレッシュトークンを使用してJWTを更新
async function handleRefresh(
  request: Request,
  env: Env,
  origin?: string
): Promise<Response> {
  const url = new URL(request.url);
  const refreshToken = url.searchParams.get('refresh_token');

  if (!refreshToken) {
    return new Response(JSON.stringify({ error: 'refresh_token is required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    });
  }

  try {
    // KintoneのOAuth2トークンエンドポイントでリフレッシュ
    const tokenResponse = await fetch(
      `https://${env.KINTONE_DOMAIN}/oauth2/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: env.KINTONE_CLIENT_ID,
          client_secret: env.KINTONE_CLIENT_SECRET,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Auth] Refresh token request failed:', tokenResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'Refresh token expired or invalid' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      });
    }

    const tokenData = (await tokenResponse.json()) as KintoneTokenResponse;

    // 新しいJWTを生成
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload: JWTPayload = {
      sub: 'kintone-user',
      name: 'Kintone Member',
      email: 'member@example.com',
      iat: now,
      exp: now + 60 * 60 * 24 * 7, // 7日間有効
    };

    const jwt = await generateJWT(jwtPayload, env.JWT_SECRET);

    return new Response(
      JSON.stringify({
        token: jwt,
        refresh_token: tokenData.refresh_token || refreshToken, // 新しいrefresh_tokenがなければ既存のものを返す
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      }
    );
  } catch (error) {
    console.error('[Auth] Refresh error:', error);
    return new Response(
      JSON.stringify({
        error: 'Refresh failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      }
    );
  }
}

// ログアウト（localStorage方式ではクライアント側で削除）
async function handleLogout(origin?: string): Promise<Response> {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

// ログインユーザー情報取得
async function handleGetUser(
  request: Request,
  env: Env,
  origin?: string
): Promise<Response> {
  // Authorization ヘッダーからトークンを取得（localStorage方式）
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;

  if (!token) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    });
  }

  const payload = await verifyJWT(token, env.JWT_SECRET);

  if (!payload) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    });
  }

  return new Response(
    JSON.stringify({
      id: payload.sub,
      name: payload.name,
      email: payload.email,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    }
  );
}

// Cookie解析ヘルパー
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.split('=');
    if (name && rest.length > 0) {
      cookies[name.trim()] = rest.join('=').trim();
    }
  });
  return cookies;
}
