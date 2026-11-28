/**
 * Cloudflare Workers - 事務員専用ページ（/member/office）の API
 *
 * 事務員（JWT の clerk。auth.ts が kintone の「事務員判定」アプリのアクセス権で判定）にだけ答える。
 * 設計と設定の手順は OFFICE.md。
 *
 * エンドポイント（すべて Authorization: Bearer <JWT> が必要）:
 * - GET /office/me     ログイン中の事務員（画面の表示の確認用）
 * - GET /office/units  住戸の一覧と、今日の時点で所有中の組合員（M_物件・M_組合員物件所有状況を読む）
 * - POST /office/applications/proxy  紙の組合員申請（名義変更・情報変更）を代理入力する
 * - GET  /office/applications?status=申請中  組合員申請の一覧（既定は申請中。新規申し込みリスト）
 * - GET  /office/applications/:id    組合員申請の詳細
 *
 * kintone へは API トークン（KINTONE_API_TOKEN_OFFICE。アプリごとのトークンをカンマでつないだもの）で読む。
 * 個人情報を含むので、応答はキャッシュしない。
 */

import { JWTPayload, verifyJWT } from './_jwt';
import {
  OwnershipRecord,
  PropertyRecord,
  buildUnits,
  isOwnedOn,
  todayJst,
} from './_office';
import {
  APPLICATION_FIELDS,
  APPLICATION_STATUSES,
  ApplicationRecord,
  fromKintoneRecord,
  parseApplicationInput,
  toKintoneRecord,
} from './_office-applications';

interface Env {
  JWT_SECRET: string;
  KINTONE_DOMAIN: string;
  // アプリごとの API トークンをカンマでつないだもの（閲覧だけ: M_物件・M_組合員物件所有状況。ルックアップの参照先の分も要る）
  KINTONE_API_TOKEN_OFFICE: string;
  KINTONE_APP_ID_PROPERTY: string; // M_物件
  KINTONE_APP_ID_OWNERSHIP: string; // M_組合員物件所有状況
  // 組合員申請（OFFICE.md 4-3-2）。未設定なら申請の API は 500 を返す（住戸の一覧は使える）
  KINTONE_APP_ID_MEMBER_APPLICATION?: string;
}

// 利用者を識別できなかったときの sub（auth.ts と同じ）。だれが操作したかを残せないので受けない
const UNIDENTIFIED_USER_ID = 'kintone-user';
const PAGE_SIZE = 500;
const MAX_BODY_BYTES = 16 * 1024;

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
  fields: string[],
  condition = ''
): Promise<T[]> {
  const all: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = new URL(`https://${env.KINTONE_DOMAIN}/k/v1/records.json`);
    url.searchParams.set('app', appId);
    url.searchParams.set(
      'query',
      `${condition} order by $id asc limit ${PAGE_SIZE} offset ${offset}`.trim()
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

/** kintone の 1 件の取得・追加。失敗したら状態コードとアプリ ID だけのエラーを投げる */
async function kintoneRequest<T>(
  env: Env,
  method: 'GET' | 'POST',
  path: string,
  appId: string,
  body?: unknown,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`https://${env.KINTONE_DOMAIN}${path}`);
  const headers: Record<string, string> = {
    'X-Cybozu-API-Token': env.KINTONE_API_TOKEN_OFFICE,
  };
  if (method === 'GET') {
    url.searchParams.set('app', appId);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  } else {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(url.toString(), {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify({ app: appId, ...(body as object) }) : undefined,
  });
  if (!response.ok) {
    throw new KintoneError(response.status, appId);
  }
  return (await response.json()) as T;
}

class KintoneError extends Error {
  constructor(
    readonly status: number,
    appId: string
  ) {
    super(`kintone ${status} (app ${appId})`);
  }
}

/** 物件を今日所有中の組合員の表示。いない・2 件以上なら、画面に出すエラーを返す */
async function findCurrentOwner(
  env: Env,
  propertyName: string
): Promise<{ display: string } | { error: string }> {
  // propertyName は parseApplicationInput が「00-000」の形だけを通すので、クエリにそのまま入れてよい
  const ownerships = await fetchAllRecords<OwnershipRecord>(
    env,
    env.KINTONE_APP_ID_OWNERSHIP,
    ['$id', 'property', 'member', 'start_date', 'end_date', 'user'],
    `property = "${propertyName}"`
  );
  const owned = ownerships.filter((o) => isOwnedOn(o, todayJst()));
  if (owned.length === 0) {
    return { error: 'このお部屋には、いま所有している組合員が登録されていません。管理者に台帳の確認を頼んでください' };
  }
  if (owned.length > 1) {
    return { error: 'このお部屋は所有の記録が重なっています。管理者に台帳の確認を頼んでください' };
  }
  return { display: owned[0].member.value };
}

async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function handleProxyApplication(
  request: Request,
  env: Env,
  appId: string,
  payload: JWTPayload,
  origin?: string
): Promise<Response> {
  const parsed = parseApplicationInput(await readJsonBody(request), todayJst());
  if (!parsed.ok) {
    return jsonResponse({ error: 'invalid', messages: parsed.errors }, 400, origin);
  }
  const input = parsed.value;

  // 同じ送信キーの申請がすでにあれば、新しく作らずにその番号を返す（ボタンの二度押し・通信のやり直し）
  const existing = await fetchAllRecords<ApplicationRecord>(
    env,
    appId,
    ['$id'],
    `submit_key = "${input.submitKey}"`
  );
  if (existing.length > 0) {
    return jsonResponse(
      { id: String(existing[0].$id?.value ?? ''), duplicate: true },
      200,
      origin
    );
  }

  const owner = await findCurrentOwner(env, input.propertyName);
  if ('error' in owner) {
    return jsonResponse({ error: 'invalid', messages: [owner.error] }, 400, origin);
  }

  const enteredBy = `${payload.name}（${payload.sub}）`;
  try {
    const created = await kintoneRequest<{ id: string }>(
      env,
      'POST',
      '/k/v1/record.json',
      appId,
      { record: toKintoneRecord(input, owner.display, enteredBy) }
    );
    return jsonResponse({ id: created.id, duplicate: false }, 201, origin);
  } catch (error) {
    if (error instanceof KintoneError && error.status === 400) {
      // ルックアップの不一致・重複の禁止など。中身は個人情報を含みうるので返さない
      return jsonResponse(
        { error: 'kintone_rejected', messages: ['台帳に登録できませんでした。お部屋と組合員の登録を管理者に確かめてもらってください'] },
        502,
        origin
      );
    }
    throw error;
  }
}

async function handleListApplications(
  url: URL,
  env: Env,
  appId: string,
  origin?: string
): Promise<Response> {
  const status = url.searchParams.get('status') ?? '申請中';
  if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) {
    return jsonResponse({ error: 'invalid status' }, 400, origin);
  }
  const records = await fetchAllRecords<ApplicationRecord>(
    env,
    appId,
    APPLICATION_FIELDS,
    `status in ("${status}")`
  );
  return jsonResponse(
    { status, applications: records.map(fromKintoneRecord) },
    200,
    origin
  );
}

async function handleGetApplication(
  id: string,
  env: Env,
  appId: string,
  origin?: string
): Promise<Response> {
  try {
    const data = await kintoneRequest<{ record: ApplicationRecord }>(
      env,
      'GET',
      '/k/v1/record.json',
      appId,
      undefined,
      { id }
    );
    return jsonResponse({ application: fromKintoneRecord(data.record) }, 200, origin);
  } catch (error) {
    if (error instanceof KintoneError && (error.status === 404 || error.status === 400)) {
      return jsonResponse({ error: 'Not found' }, 404, origin);
    }
    throw error;
  }
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
  if (path.startsWith('/office/applications')) {
    const appId = env.KINTONE_APP_ID_MEMBER_APPLICATION;
    if (!appId) {
      console.error('[Office] KINTONE_APP_ID_MEMBER_APPLICATION is not set');
      return jsonResponse({ error: 'Server configuration error' }, 500, origin);
    }
    if (request.method === 'POST' && path === '/office/applications/proxy') {
      return handleProxyApplication(request, env, appId, payload, origin);
    }
    if (request.method === 'GET' && path === '/office/applications') {
      return handleListApplications(new URL(request.url), env, appId, origin);
    }
    const match = path.match(/^\/office\/applications\/(\d+)$/);
    if (request.method === 'GET' && match) {
      return handleGetApplication(match[1], env, appId, origin);
    }
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
