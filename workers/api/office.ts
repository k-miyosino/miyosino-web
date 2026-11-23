/**
 * Cloudflare Workers - 事務員専用ページ（/member/office）の API
 *
 * 事務員（JWT の clerk。auth.ts が kintone の「事務員」アプリのアクセス権で判定）にだけ答える。
 * 設計と設定の手順は OFFICE.md。
 *
 * エンドポイント（すべて Authorization: Bearer <JWT> が必要）:
 * - GET /office/me     ログイン中の事務員（画面の表示の確認用）
 * - GET /office/units  住戸の一覧と、今日の時点で所有中の組合員（M_物件・M_組合員物件所有状況を読む）
 *
 * kintone へは API トークン（KINTONE_API_TOKEN_OFFICE。アプリごとのトークンをカンマでつないだもの）で読む。
 * 個人情報を含むので、応答はキャッシュしない。
 */

import { JWTPayload, verifyJWT } from './_jwt';
import {
  OwnershipRecord,
  PropertyRecord,
  buildUnits,
  todayJst,
} from './_office';

interface Env {
  JWT_SECRET: string;
  KINTONE_DOMAIN: string;
  // アプリごとの API トークンをカンマでつないだもの（閲覧だけ: M_物件・M_組合員物件所有状況。ルックアップの参照先の分も要る）
  KINTONE_API_TOKEN_OFFICE: string;
  KINTONE_APP_ID_PROPERTY: string; // M_物件
  KINTONE_APP_ID_OWNERSHIP: string; // M_組合員物件所有状況
}

// 利用者を識別できなかったときの sub（auth.ts と同じ）。だれが操作したかを残せないので受けない
const UNIDENTIFIED_USER_ID = 'kintone-user';
const PAGE_SIZE = 500;

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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

/** 事務員の JWT か確かめる。だめなら返す Response */
async function authenticateClerk(
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
  if (payload.clerk !== true || payload.sub === UNIDENTIFIED_USER_ID) {
    return jsonResponse({ error: 'forbidden' }, 403, origin);
  }
  return payload;
}

/** アプリのレコードをすべて読む（キャッシュしない） */
async function fetchAllRecords<T>(
  env: Env,
  appId: string,
  fields: string[]
): Promise<T[]> {
  const all: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = new URL(`https://${env.KINTONE_DOMAIN}/k/v1/records.json`);
    url.searchParams.set('app', appId);
    url.searchParams.set(
      'query',
      `order by $id asc limit ${PAGE_SIZE} offset ${offset}`
    );
    fields.forEach((field, i) => url.searchParams.set(`fields[${i}]`, field));
    const response = await fetch(url.toString(), {
      headers: { 'X-Cybozu-API-Token': env.KINTONE_API_TOKEN_OFFICE },
    });
    if (!response.ok) {
      // 応答の本文には個人情報が入りうるので、ログには状態コードとアプリ ID だけを出す
      throw new Error(`kintone ${response.status} (app ${appId})`);
    }
    const data = (await response.json()) as { records: T[] };
    all.push(...data.records);
    if (data.records.length < PAGE_SIZE) return all;
  }
}

async function handleUnits(env: Env, origin?: string): Promise<Response> {
  const [properties, ownerships] = await Promise.all([
    fetchAllRecords<PropertyRecord>(env, env.KINTONE_APP_ID_PROPERTY, [
      '$id',
      'property_name',
      'building',
      'room_number',
    ]),
    fetchAllRecords<OwnershipRecord>(env, env.KINTONE_APP_ID_OWNERSHIP, [
      '$id',
      'property',
      'member',
      'start_date',
      'end_date',
      'user',
    ]),
  ]);
  const date = todayJst();
  return jsonResponse(
    { date, units: buildUnits(properties, ownerships, date) },
    200,
    origin
  );
}

async function route(
  request: Request,
  env: Env,
  payload: JWTPayload,
  path: string,
  origin?: string
): Promise<Response> {
  if (request.method === 'GET' && path === '/office/me') {
    return jsonResponse({ code: payload.sub, name: payload.name }, 200, origin);
  }
  if (request.method === 'GET' && path === '/office/units') {
    return handleUnits(env, origin);
  }
  return jsonResponse({ error: 'Not found' }, 404, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname.replace(/\/$/, '');
    const origin = request.headers.get('Origin') || undefined;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (
      !env.JWT_SECRET ||
      !env.KINTONE_DOMAIN ||
      !env.KINTONE_API_TOKEN_OFFICE ||
      !env.KINTONE_APP_ID_PROPERTY ||
      !env.KINTONE_APP_ID_OWNERSHIP
    ) {
      console.error('[Office] Required environment variables are not set');
      return jsonResponse({ error: 'Server configuration error' }, 500, origin);
    }

    const auth = await authenticateClerk(request, env, origin);
    if (auth instanceof Response) {
      return auth;
    }
    try {
      return await route(request, env, auth, path, origin);
    } catch (error) {
      console.error('[Office] Error:', error instanceof Error ? error.message : error);
      return jsonResponse({ error: 'Internal server error' }, 500, origin);
    }
  },
};
