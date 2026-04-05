/**
 * 認証関連のユーティリティ関数
 *
 * Kintone OAuth 2.0認証を使用した認証状態の管理
 * localStorage方式（クロスドメインCookie問題の回避）
 */

const AUTH_API_ENDPOINT =
  process.env.NEXT_PUBLIC_AUTH_API_URL ||
  'https://miyosino-auth.anorimura-miyosino.workers.dev';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user?: AuthUser;
}

/**
 * JWTペイロードをクライアント側でデコード（署名検証なし）
 * 有効期限チェックやペイロード参照のみに使用する
 */
function decodeJwtPayload(
  token: string
): { exp?: number; sub?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    return payload as { exp?: number; sub?: string };
  } catch {
    return null;
  }
}

/**
 * トークンが期限切れかどうかを確認（クライアント側、署名検証なし）
 * サーバー検証の代わりには使えないが、無駄なAPI呼び出しを減らすために使用
 */
function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  // 30秒のバッファを持たせる
  return payload.exp < Math.floor(Date.now() / 1000) + 30;
}

/**
 * URLからトークンを取得してlocalStorageに保存
 * 認証後のリダイレクト時に呼び出される
 * @returns トークンが保存された場合true、そうでない場合false
 */
export function handleAuthCallback(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const refreshToken = params.get('refresh_token');

    console.log('[Auth Debug] URL:', window.location.pathname);
    console.log('[Auth Debug] Token from URL:', token ? 'Found' : 'Not found');
    console.log(
      '[Auth Debug] Refresh token from URL:',
      refreshToken ? 'Found' : 'Not found'
    );

    if (token) {
      // トークンをlocalStorageに保存
      localStorage.setItem(TOKEN_KEY, token);

      // リフレッシュトークンが含まれていれば保存
      if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        console.log('[Auth Debug] Refresh token saved to localStorage');
      }

      // 保存されたことを確認
      const savedToken = localStorage.getItem(TOKEN_KEY);
      console.log(
        '[Auth Debug] Token verification:',
        savedToken === token ? 'OK' : 'FAILED'
      );

      // URLからトークンを削除（セキュリティ対策: ブラウザ履歴に残さない）
      params.delete('token');
      params.delete('refresh_token');
      const newUrl =
        window.location.pathname +
        (params.toString() ? '?' + params.toString() : '') +
        window.location.hash;
      window.history.replaceState({}, '', newUrl);
      console.log('[Auth Debug] URL cleaned:', newUrl);

      return true;
    }
    return false;
  } catch (error) {
    console.error('[Auth] handleAuthCallback error:', error);
    return false;
  }
}

/**
 * localStorageからJWTトークンを取得
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * localStorageからリフレッシュトークンを取得
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Kintoneのリフレッシュトークンを使用してJWTをサイレント更新
 * ユーザーに認可画面を再表示することなくセッションを延長する
 * @returns 更新成功の場合true
 */
export async function silentRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    console.log('[Auth] No refresh token available for silent refresh');
    return false;
  }

  try {
    console.log('[Auth] Attempting silent refresh...');
    const response = await fetch(
      `${AUTH_API_ENDPOINT}/refresh?refresh_token=${encodeURIComponent(refreshToken)}`
    );

    if (!response.ok) {
      console.log('[Auth] Silent refresh failed:', response.status);
      // リフレッシュトークンが無効ならクリア
      if (response.status === 401) {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
      return false;
    }

    const data = (await response.json()) as {
      token: string;
      refresh_token?: string;
    };

    if (!data.token) {
      console.error('[Auth] Silent refresh: no token in response');
      return false;
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    if (data.refresh_token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    }

    console.log('[Auth] Silent refresh successful');
    return true;
  } catch (error) {
    console.error('[Auth] Silent refresh error:', error);
    return false;
  }
}

/**
 * 認証状態を確認
 * 1. localStorageのJWTをチェック
 * 2. 期限切れならリフレッシュトークンでサイレント更新を試みる
 * 3. サーバー側でJWTを検証
 */
export async function checkAuthStatus(): Promise<AuthStatus> {
  try {
    let token = getToken();

    console.log(
      '[Auth Debug] Token from localStorage:',
      token ? 'Found' : 'Not found'
    );

    if (!token) {
      // JWTがない場合、リフレッシュトークンでサイレント更新を試みる
      const refreshed = await silentRefresh();
      if (!refreshed) {
        return { authenticated: false };
      }
      token = getToken();
      if (!token) {
        return { authenticated: false };
      }
    }

    // クライアント側で期限チェック（無駄なAPI呼び出しを減らす）
    if (isTokenExpired(token)) {
      console.log(
        '[Auth Debug] Token is expired, attempting silent refresh...'
      );
      localStorage.removeItem(TOKEN_KEY);
      const refreshed = await silentRefresh();
      if (!refreshed) {
        return { authenticated: false };
      }
      token = getToken();
      if (!token) {
        return { authenticated: false };
      }
    }

    // サーバー側でJWT署名と有効性を検証
    const response = await fetch(`${AUTH_API_ENDPOINT}/verify`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('[Auth Debug] Verify response status:', response.status);

    if (!response.ok) {
      // サーバーエラー（5xx）の場合はトークンを消さずにリトライ可能な状態にする
      if (response.status >= 500) {
        console.warn('[Auth] Server error during verify, keeping token');
        return { authenticated: false };
      }
      localStorage.removeItem(TOKEN_KEY);
      return { authenticated: false };
    }

    const data = (await response.json()) as AuthStatus;
    console.log(
      '[Auth Debug] Auth status:',
      data.authenticated ? 'authenticated' : 'not authenticated'
    );
    return data;
  } catch (error) {
    console.error('[Auth] Failed to check auth status:', error);
    // ネットワークエラー時はトークンを削除しない（一時的な障害の可能性）
    return { authenticated: false };
  }
}

/**
 * ログインページへリダイレクト
 */
export function redirectToLogin(redirectUri?: string): void {
  // リダイレクト先は絶対URLである必要がある
  const currentUrl = redirectUri
    ? new URL(redirectUri, window.location.origin).toString()
    : window.location.href;

  const loginUrl = `${AUTH_API_ENDPOINT}/login?redirect_uri=${encodeURIComponent(currentUrl)}`;
  window.location.href = loginUrl;
}

/**
 * ログアウト
 */
export async function logout(): Promise<void> {
  const token = getToken();
  const refreshToken = getRefreshToken();

  // 1. ローカルトークンを即座に削除
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);

  // 2. Workers経由でKintoneセッションをAPI終了（OAuthグラントは維持される）
  try {
    await fetch(`${AUTH_API_ENDPOINT}/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ refresh_token: refreshToken ?? undefined }),
    });
  } catch (error) {
    console.error('[Auth] Logout sync failed:', error);
  }

  // 3. 自社サイトのトップへリダイレクト
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  window.location.href = basePath + '/';
}

/**
 * ログインユーザー情報を取得
 */
export async function getUserInfo(): Promise<AuthUser | null> {
  try {
    const token = getToken();

    if (!token) {
      return null;
    }

    const response = await fetch(`${AUTH_API_ENDPOINT}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const user = (await response.json()) as AuthUser;
    return user;
  } catch (error) {
    console.error('[Auth] Failed to get user info:', error);
    return null;
  }
}
