/**
 * Cloudflare Workers - 広報ページ（/member/koho）の API
 *
 * 広報委員（JWT の koho。auth.ts が kintone の「広報委員判定」アプリのアクセス権で判定）にだけ答える。
 * 設計と設定の手順は KOHO.md。
 *
 * エンドポイント（すべて Authorization: Bearer <JWT> が必要）:
 * - GET /koho/links  リンク集（kintone のアプリ・microCMS・「ここで直す」の早見表）
 *
 * 段階 1 では kintone・microCMS には問い合わせない（リンクを作って返すだけ）。
 */

import { JWTPayload, verifyJWT } from './_jwt';
import {
  KOHO_GUIDE,
  KohoCatalogEnv,
  buildKintoneApps,
  buildMicrocms,
} from './_koho-catalog';

interface Env extends KohoCatalogEnv {
  JWT_SECRET: string;
}

// 利用者を識別できなかったときの sub（auth.ts と同じ）
const UNIDENTIFIED_USER_ID = 'kintone-user';

// CORS とログイン後の画面として許可するオリジン（auth.ts と同じ）
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://k-miyosino.github.io',
  'https://k-miyosino.com',
  'https://www.k-miyosino.com',
];

function corsHeaders(origin?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin':
      origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[1],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(body: unknown, status: number, origin?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin),
    },
  });
}

/** 広報委員の JWT か確かめる。だめなら返す Response */
async function authenticateKoho(
  request: Request,
  env: Env,
  origin?: string
): Promise<JWTPayload | Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401, origin);
  }
  const payload = await verifyJWT(authHeader.substring(7), env.JWT_SECRET);
  if (!payload) {
    return jsonResponse({ error: 'Invalid token' }, 401, origin);
  }
  if (payload.koho !== true || payload.sub === UNIDENTIFIED_USER_ID) {
    return jsonResponse({ error: 'forbidden' }, 403, origin);
  }
  return payload;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname.replace(/\/$/, '');
    const origin = request.headers.get('Origin') || undefined;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (!env.JWT_SECRET || !env.KINTONE_DOMAIN) {
      console.error('[Koho] Required environment variables are not set');
      return jsonResponse({ error: 'Server configuration error' }, 500, origin);
    }

    const auth = await authenticateKoho(request, env, origin);
    if (auth instanceof Response) {
      return auth;
    }

    if (request.method === 'GET' && path === '/koho/links') {
      return jsonResponse(
        {
          me: { code: auth.sub, name: auth.name },
          kintone: buildKintoneApps(env),
          microcms: buildMicrocms(env),
          guide: KOHO_GUIDE,
        },
        200,
        origin
      );
    }
    return jsonResponse({ error: 'Not found' }, 404, origin);
  },
};
