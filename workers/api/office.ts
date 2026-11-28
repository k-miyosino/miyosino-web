/**
 * Cloudflare Workers - 事務員専用ページ（/member/office）の API
 *
 * 事務員（JWT の clerk。auth.ts が kintone の「事務員判定」アプリのアクセス権で判定）にだけ答える。
 * 設計と設定の手順は OFFICE.md（0 章が今の設計）。
 *
 * エンドポイント（すべて Authorization: Bearer <JWT> が必要）:
 * - GET  /office/me                       ログイン中の事務員（画面の表示の確認用）
 * - GET  /office/units                    住戸の一覧と、今日の時点で所有中の組合員
 * - POST /office/ledger/preview           名義変更・氏名の変更で、台帳がどう変わるか（書き込まない。確認画面用）
 * - POST /office/ledger                   名義変更・氏名の変更を台帳に反映する（1 回の bulkRequest。更新記録も残す）
 * - GET  /office/ledger/logs?date=        その日（既定は今日）の台帳の更新記録
 * - POST /office/ledger/logs/:id/cancel   その日の更新を取り消す
 *
 * kintone へは API トークン（KINTONE_API_TOKEN_OFFICE。アプリごとのトークンをカンマでつないだもの）で読み書きする。
 * 個人情報を含むので、応答はキャッシュしない。kintone のエラーの本文はログにも画面にも出さない。
 */

import {
  corsHeaders as sharedCorsHeaders,
  jsonResponse as sharedJsonResponse,
} from './_cors';
import { JWTPayload, verifyJWT } from './_jwt';
import { OwnershipRecord, PropertyRecord, buildUnits, todayJst } from './_office';
import {
  BulkRequest,
  LOG_FIELDS,
  LedgerApps,
  LedgerContext,
  LedgerInput,
  LedgerMember,
  LedgerOwnership,
  LedgerParking,
  LedgerPlan,
  LogRecord,
  Parsed,
  isValidDate,
  parseLedgerInput,
  planCancel,
  planRename,
  planTransfer,
  toLogView,
} from './_office-ledger';

interface Env {
  JWT_SECRET: string;
  KINTONE_DOMAIN: string;
  // アプリごとの API トークンをカンマでつないだもの（OFFICE.md 0-4）
  KINTONE_API_TOKEN_OFFICE: string;
  KINTONE_APP_ID_PROPERTY: string; // M_物件
  KINTONE_APP_ID_OWNERSHIP: string; // M_組合員物件所有状況
  // 台帳の更新（OFFICE.md 0 章）。どれかが未設定なら、台帳の更新の API は 500 を返す（住戸の一覧は使える）
  KINTONE_APP_ID_MEMBER?: string; // M_組合員
  KINTONE_APP_ID_LEDGER_LOG?: string; // 台帳の更新記録
  KINTONE_APP_ID_PARKING?: string; // M_組合員駐車場契約（任意。無ければ駐車場の契約を見ない・写し直さない）
}

// 利用者を識別できなかったときの sub（auth.ts と同じ）。だれが操作したかを残せないので受けない
const UNIDENTIFIED_USER_ID = 'kintone-user';
const PAGE_SIZE = 500;
const MAX_BODY_BYTES = 16 * 1024;
const METHODS = 'GET, POST, OPTIONS';

function corsHeaders(origin?: string): Record<string, string> {
  return sharedCorsHeaders(origin, METHODS);
}

function jsonResponse(body: unknown, status: number, origin?: string): Response {
  return sharedJsonResponse(body, status, origin, METHODS);
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

class KintoneError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    appId: string
  ) {
    super(`kintone ${status} ${code} (app ${appId})`);
  }
}

/** kintone のレコード番号（文字列か数）を文字列に。それ以外は空 */
function recordId(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

async function kintoneFailure(response: Response, appId: string): Promise<KintoneError> {
  // 本文には個人情報が入りうるので、エラーコードだけを取り出す（bulkRequest は results の中にある）
  const data = (await response.json().catch(() => ({}))) as {
    code?: unknown;
    results?: { code?: unknown }[];
  };
  const failed = Array.isArray(data.results) ? data.results.find((r) => r?.code) : undefined;
  const raw = failed?.code ?? data.code;
  const code = typeof raw === 'string' ? raw : '';
  return new KintoneError(response.status, /^[A-Z0-9_]{1,40}$/.test(code) ? code : '', appId);
}

/** アプリのレコードを条件に合うだけ読む（キャッシュしない） */
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
    if (!response.ok) throw await kintoneFailure(response, appId);
    const data = (await response.json()) as { records: T[] };
    all.push(...data.records);
    if (data.records.length < PAGE_SIZE) return all;
  }
}

async function kintoneSend<T>(
  env: Env,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  appId: string,
  body?: unknown,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`https://${env.KINTONE_DOMAIN}${path}`);
  const headers: Record<string, string> = { 'X-Cybozu-API-Token': env.KINTONE_API_TOKEN_OFFICE };
  for (const [key, v] of Object.entries(params)) url.searchParams.set(key, v);
  if (method !== 'GET') headers['Content-Type'] = 'application/json';
  const response = await fetch(url.toString(), {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw await kintoneFailure(response, appId);
  return (await response.json()) as T;
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
  return jsonResponse({ date, units: buildUnits(properties, ownerships, date) }, 200, origin);
}

const OWNERSHIP_FIELDS = [
  '$id',
  '$revision',
  'property',
  'member',
  'start_date',
  'end_date',
  'status',
  'user',
  'management_fee',
  'repair_reserve_fee',
];

/** 物件の今の台帳の状態を読む（物件名・ログイン名は parseLedgerInput が形を確かめたものだけをクエリに入れる） */
async function loadContext(env: Env, apps: LedgerApps, propertyName: string): Promise<LedgerContext> {
  const today = todayJst();
  const propertyOwnerships = await fetchAllRecords<LedgerOwnership>(
    env,
    apps.ownership,
    OWNERSHIP_FIELDS,
    `property = "${propertyName}"`
  );
  const owned = propertyOwnerships.filter((o) => {
    const start = o.start_date.value;
    const end = o.end_date.value;
    return (!start || start <= today) && (!end || today <= end);
  });
  // 新しい「表示」が重ならないよう、その物件名を含む M_組合員の表示を読む（like は部分一致なので、先頭で絞り直す）
  const takenDisplays = (
    await fetchAllRecords<{ display: { value: string } }>(env, apps.member, ['display'], `display like "${propertyName}"`)
  )
    .map((m) => m.display?.value ?? '')
    .filter((d) => d.startsWith(propertyName));
  const userCode = owned.length === 1 ? owned[0].user.value[0]?.code : undefined;
  if (!userCode || !/^[A-Za-z0-9._@-]{1,64}$/.test(userCode)) {
    return { today, propertyOwnerships, member: null, memberOwnerships: [], memberParkings: [], takenDisplays };
  }
  const byUser = `user in ("${userCode}")`;
  const [members, memberOwnerships, memberParkings] = await Promise.all([
    fetchAllRecords<LedgerMember>(env, apps.member, ['$id', '$revision', 'display', 'status', 'user'], byUser),
    fetchAllRecords<LedgerOwnership>(env, apps.ownership, OWNERSHIP_FIELDS, byUser),
    apps.parking
      ? fetchAllRecords<LedgerParking>(
          env,
          apps.parking,
          ['$id', '$revision', 'member', 'start_date', 'end_date'],
          byUser
        )
      : Promise.resolve([] as LedgerParking[]),
  ]);
  return {
    today,
    propertyOwnerships,
    member: members.length === 1 ? members[0] : null,
    memberOwnerships,
    memberParkings,
    takenDisplays,
  };
}

function plan(
  input: LedgerInput,
  ctx: LedgerContext,
  apps: LedgerApps,
  payload: JWTPayload
): Parsed<LedgerPlan> {
  const enteredBy = `${payload.name}（${payload.sub}）`;
  const enteredAt = new Date().toISOString();
  return input.type === '名義変更'
    ? planTransfer(input, ctx, apps, enteredBy, enteredAt)
    : planRename(input, ctx, apps, enteredBy, enteredAt);
}

function invalid(messages: string[], origin?: string): Response {
  return jsonResponse({ error: 'invalid', messages }, 400, origin);
}

/** kintone が書き込みを断ったときに、画面に出すことば */
function rejectedMessage(error: KintoneError): string {
  if (error.code === 'GAIA_CO02' || error.code === 'GAIA_CO04') {
    return 'ほかの人が先に台帳を変えました。画面を開き直して、もう一度入力してください';
  }
  if (error.code.startsWith('GAIA_LO')) {
    return '台帳のつながり（ルックアップ）が合わず、更新できませんでした。管理者に台帳の確認を頼んでください';
  }
  return '台帳を更新できませんでした。ログイン名のユーザーが cybozu.com にあるか、氏名が同じ組合員がいないかを確かめて、管理者に相談してください';
}

async function handlePreview(request: Request, env: Env, apps: LedgerApps, payload: JWTPayload, origin?: string) {
  const parsed = parseLedgerInput(await readJsonBody(request));
  if (!parsed.ok) return invalid(parsed.errors, origin);
  const planned = plan(parsed.value, await loadContext(env, apps, parsed.value.propertyName), apps, payload);
  if (!planned.ok) return invalid(planned.errors, origin);
  const { summary, warnings, notices, proration } = planned.value;
  return jsonResponse({ summary, warnings, notices, proration }, 200, origin);
}

async function handleApply(request: Request, env: Env, apps: LedgerApps, payload: JWTPayload, origin?: string) {
  const parsed = parseLedgerInput(await readJsonBody(request));
  if (!parsed.ok) return invalid(parsed.errors, origin);
  const input = parsed.value;

  // 同じ送信キーの記録がすでにあれば、新しく書き込まずにその番号を返す（ボタンの二度押し・通信のやり直し）
  const existing = await fetchAllRecords<LogRecord>(env, apps.log, ['$id'], `submit_key = "${input.submitKey}"`);
  if (existing.length > 0) {
    return jsonResponse({ logId: recordId(existing[0].$id?.value), duplicate: true }, 200, origin);
  }

  const planned = plan(input, await loadContext(env, apps, input.propertyName), apps, payload);
  if (!planned.ok) return invalid(planned.errors, origin);
  const { requests, logRecord, summary, notices } = planned.value;
  const all: BulkRequest[] = [
    ...requests,
    { method: 'POST', api: '/k/v1/record.json', payload: { app: apps.log, record: logRecord } },
  ];
  let results: { id?: string }[];
  try {
    const data = await kintoneSend<{ results: { id?: string }[] }>(env, 'POST', '/k/v1/bulkRequest.json', apps.log, {
      requests: all,
    });
    results = data.results;
  } catch (error) {
    if (error instanceof KintoneError && error.status === 400) {
      return jsonResponse({ error: 'kintone_rejected', messages: [rejectedMessage(error)] }, 409, origin);
    }
    throw error;
  }
  const logId = String(results.at(-1)?.id ?? '');

  // 名義変更は、取り消しに使うため、作った組合員と所有状況の番号を記録に足す（失敗しても台帳の更新は済んでいる）
  if (input.type === '名義変更') {
    const after = JSON.parse(logRecord.after.value) as Record<string, unknown>;
    after.ids = { member: String(results[2]?.id ?? ''), ownership: String(results[3]?.id ?? '') };
    try {
      await kintoneSend(env, 'PUT', '/k/v1/record.json', apps.log, {
        app: apps.log,
        id: logId,
        record: { after: { value: JSON.stringify(after) } },
      });
    } catch (error) {
      console.error('[Office] Failed to save created ids to the log:', error instanceof Error ? error.message : error);
    }
  }
  return jsonResponse({ logId, duplicate: false, summary, notices }, 201, origin);
}

async function handleLogs(url: URL, env: Env, apps: LedgerApps, origin?: string): Promise<Response> {
  const date = url.searchParams.get('date') ?? todayJst();
  if (!isValidDate(date)) return jsonResponse({ error: 'invalid date' }, 400, origin);
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const records = await fetchAllRecords<LogRecord>(
    env,
    apps.log,
    LOG_FIELDS,
    `entered_at >= "${date}T00:00:00+09:00" and entered_at < "${next.toISOString().slice(0, 10)}T00:00:00+09:00"`
  );
  return jsonResponse({ date, logs: records.map(toLogView) }, 200, origin);
}

async function handleCancel(id: string, env: Env, apps: LedgerApps, payload: JWTPayload, origin?: string) {
  let log: LogRecord;
  try {
    const data = await kintoneSend<{ record: LogRecord }>(env, 'GET', '/k/v1/record.json', apps.log, undefined, {
      app: apps.log,
      id,
    });
    log = data.record;
  } catch (error) {
    if (error instanceof KintoneError && (error.status === 404 || error.status === 400)) {
      return jsonResponse({ error: 'Not found' }, 404, origin);
    }
    throw error;
  }
  const planned = planCancel(log, apps, todayJst(), `${payload.name}（${payload.sub}）`, new Date().toISOString());
  if (!planned.ok) return invalid(planned.errors, origin);
  try {
    await kintoneSend(env, 'POST', '/k/v1/bulkRequest.json', apps.log, { requests: planned.value });
  } catch (error) {
    if (error instanceof KintoneError && error.status === 400) {
      return jsonResponse({ error: 'kintone_rejected', messages: [rejectedMessage(error)] }, 409, origin);
    }
    throw error;
  }
  return jsonResponse({ ok: true }, 200, origin);
}

function ledgerApps(env: Env): LedgerApps | null {
  if (!env.KINTONE_APP_ID_MEMBER || !env.KINTONE_APP_ID_LEDGER_LOG) return null;
  return {
    member: env.KINTONE_APP_ID_MEMBER,
    ownership: env.KINTONE_APP_ID_OWNERSHIP,
    parking: env.KINTONE_APP_ID_PARKING || undefined,
    log: env.KINTONE_APP_ID_LEDGER_LOG,
  };
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
  if (!path.startsWith('/office/ledger')) {
    return jsonResponse({ error: 'Not found' }, 404, origin);
  }
  const apps = ledgerApps(env);
  if (!apps) {
    console.error('[Office] KINTONE_APP_ID_MEMBER or KINTONE_APP_ID_LEDGER_LOG is not set');
    return jsonResponse({ error: 'Server configuration error' }, 500, origin);
  }
  if (request.method === 'POST' && path === '/office/ledger/preview') {
    return handlePreview(request, env, apps, payload, origin);
  }
  if (request.method === 'POST' && path === '/office/ledger') {
    return handleApply(request, env, apps, payload, origin);
  }
  if (request.method === 'GET' && path === '/office/ledger/logs') {
    return handleLogs(new URL(request.url), env, apps, origin);
  }
  const match = /^\/office\/ledger\/logs\/(\d{1,10})\/cancel$/.exec(path);
  if (request.method === 'POST' && match) {
    return handleCancel(match[1], env, apps, payload, origin);
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
