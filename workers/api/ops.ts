/**
 * Cloudflare Workers - 運用ダッシュボード（/member/ops）の API
 *
 * 管理者（JWT の admin。auth.ts が kintone の「運用管理者」アプリのアクセス権で判定）にだけ答える。
 * 設定の手順は OPS.md。
 *
 * エンドポイント（すべて Authorization: Bearer <JWT> が必要）:
 * - GET  /ops/overview             定期タスク・秘密情報・リンク・Looker Studio の URL
 * - POST /ops/tasks/:id/done       タスクを対応した記録を残す（{ note?: string }）
 * - POST /ops/secrets/:id/rotated  秘密情報を入れ替えた記録を残す（{ note?: string }）
 * - GET  /ops/chat                 チャットの設定・質問ログ・評価・回数・利用料の目安
 *
 * D1: OPS_DB（miyosino-ops、記録）、CHAT_DB（miyosino-chat、読むだけ）
 */

import {
  OPS_SECRETS,
  OPS_SECRET_CATEGORIES,
  OPS_TASKS,
  OpsCadence,
  OpsTask,
  buildLinkGroups,
} from './_ops-catalog';
import { JWTPayload, verifyJWT } from './_jwt';

interface Env {
  JWT_SECRET: string;
  OPS_DB: D1Database;
  CHAT_DB?: D1Database;
  LOOKER_STUDIO_EMBED_URL?: string;
  CHAT_YEN_PER_REQUEST?: string;
  // リンク集に kintone を出すため（任意）
  KINTONE_DOMAIN?: string;
}

type TaskStatus = 'overdue' | 'soon' | 'ok' | 'done' | 'event';

interface LogRow {
  done_at: string;
  done_by: string;
  note: string;
}

const MAX_NOTE_LENGTH = 500;
const HISTORY_PER_ITEM = 5;
// 「もうすぐ」とみなす日数
const SOON_DAYS: Record<OpsCadence['type'], number> = {
  monthly: 7,
  yearly: 30,
  deadline: 90,
  event: 0,
};

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

// D1 の datetime('now')（UTC、'YYYY-MM-DD HH:MM:SS'）を日本時間の ISO 風の文字列にする
function toJst(utc: string): string {
  const date = new Date(`${utc.replace(' ', 'T')}Z`);
  return new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ');
}

function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addMonths(dateJst: string, months: number): string {
  const [y, m, d] = dateJst.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  // 月末を超える日（1/31 の1か月後など）はその月の末日にする
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

function daysBetween(fromJst: string, toJstDate: string): number {
  return Math.round(
    (Date.parse(`${toJstDate}T00:00:00Z`) - Date.parse(`${fromJst}T00:00:00Z`)) /
      86400000
  );
}

/** 最後に対応した日（日本時間）から、次の期限と状態を決める */
function taskSchedule(
  task: OpsTask,
  lastDoneJst: string | null
): { dueDate: string | null; status: TaskStatus } {
  const today = todayJst();
  const cadence = task.cadence;
  if (cadence.type === 'event') {
    return { dueDate: null, status: 'event' };
  }
  let dueDate: string;
  if (cadence.type === 'deadline') {
    if (lastDoneJst) return { dueDate: cadence.date, status: 'done' };
    dueDate = cadence.date;
  } else if (lastDoneJst) {
    const months = cadence.type === 'monthly' ? 1 : 12;
    dueDate = addMonths(lastDoneJst, months);
  } else {
    // 一度も対応していなければ、今日が期限
    dueDate = today;
  }
  const remaining = daysBetween(today, dueDate);
  if (remaining < 0 || (!lastDoneJst && cadence.type !== 'deadline')) {
    return { dueDate, status: 'overdue' };
  }
  if (remaining <= SOON_DAYS[cadence.type]) return { dueDate, status: 'soon' };
  return { dueDate, status: 'ok' };
}

/** id ごとに新しい順の記録をまとめる */
async function loadHistory(
  db: D1Database,
  table: 'ops_task_log' | 'ops_secret_log'
): Promise<Map<string, LogRow[]>> {
  const sql =
    table === 'ops_task_log'
      ? 'SELECT task_id AS id, done_at, done_by, note FROM ops_task_log ORDER BY done_at DESC, id DESC'
      : 'SELECT secret_id AS id, rotated_at AS done_at, done_by, note FROM ops_secret_log ORDER BY rotated_at DESC, id DESC';
  const { results } = await db
    .prepare(sql)
    .all<LogRow & { id: string }>();
  const map = new Map<string, LogRow[]>();
  for (const row of results) {
    const list = map.get(row.id) ?? [];
    if (list.length < HISTORY_PER_ITEM) {
      list.push({ done_at: toJst(row.done_at), done_by: row.done_by, note: row.note });
    }
    map.set(row.id, list);
  }
  return map;
}

async function handleOverview(env: Env, origin?: string): Promise<Response> {
  const [taskHistory, secretHistory] = await Promise.all([
    loadHistory(env.OPS_DB, 'ops_task_log'),
    loadHistory(env.OPS_DB, 'ops_secret_log'),
  ]);

  const order: Record<TaskStatus, number> = {
    overdue: 0,
    soon: 1,
    ok: 2,
    event: 3,
    done: 4,
  };
  const tasks = OPS_TASKS.map((task) => {
    const history = taskHistory.get(task.id) ?? [];
    const lastDoneJst = history[0]?.done_at.slice(0, 10) ?? null;
    return { ...task, ...taskSchedule(task, lastDoneJst), history };
  }).sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
  );

  const secrets = OPS_SECRETS.map((secret) => ({
    ...secret,
    history: secretHistory.get(secret.id) ?? [],
  }));

  return jsonResponse(
    {
      today: todayJst(),
      tasks,
      secrets,
      secretCategories: OPS_SECRET_CATEGORIES,
      linkGroups: buildLinkGroups(env.KINTONE_DOMAIN),
      lookerStudioEmbedUrl: env.LOOKER_STUDIO_EMBED_URL || null,
    },
    200,
    origin
  );
}

async function readNote(request: Request): Promise<string | null> {
  try {
    const text = await request.text();
    if (!text) return '';
    const body = JSON.parse(text) as { note?: unknown };
    if (body.note === undefined || body.note === null) return '';
    if (typeof body.note !== 'string') return null;
    return body.note.trim().slice(0, MAX_NOTE_LENGTH);
  } catch {
    return null;
  }
}

async function handleRecord(
  request: Request,
  env: Env,
  payload: JWTPayload,
  kind: 'task' | 'secret',
  id: string,
  origin?: string
): Promise<Response> {
  const known =
    kind === 'task'
      ? OPS_TASKS.some((task) => task.id === id)
      : OPS_SECRETS.some((secret) => secret.id === id);
  if (!known) {
    return jsonResponse({ error: 'Not found' }, 404, origin);
  }
  const note = await readNote(request);
  if (note === null) {
    return jsonResponse({ error: 'Invalid body' }, 400, origin);
  }
  const sql =
    kind === 'task'
      ? 'INSERT INTO ops_task_log (task_id, done_by, note) VALUES (?1, ?2, ?3)'
      : 'INSERT INTO ops_secret_log (secret_id, done_by, note) VALUES (?1, ?2, ?3)';
  await env.OPS_DB.prepare(sql).bind(id, payload.name, note).run();
  return jsonResponse({ ok: true }, 200, origin);
}

/** chat_settings を読む（chat.ts の getChatSettings と同じ既定値） */
async function readChatSettings(db: D1Database) {
  const { results } = await db
    .prepare('SELECT key, value FROM chat_settings')
    .all<{ key: string; value: string }>();
  const values = new Map(results.map((row) => [row.key, row.value]));
  const toInt = (value: string | undefined, fallback: number) =>
    value !== undefined && /^\d+$/.test(value.trim())
      ? Number.parseInt(value, 10)
      : fallback;
  const enabled = values.get('enabled');
  return {
    enabled: enabled === undefined || enabled === '1',
    logging: values.get('log_enabled') === '1',
    feedback: values.get('feedback_enabled') === '1',
    retentionDays: Math.max(1, toInt(values.get('log_retention_days'), 180)),
    limitPerUser: toInt(values.get('limit_per_user'), 20),
    limitTotal: toInt(values.get('limit_total'), 300),
  };
}

async function handleChat(env: Env, origin?: string): Promise<Response> {
  if (!env.CHAT_DB) {
    return jsonResponse({ available: false }, 200, origin);
  }
  const db = env.CHAT_DB;
  const settings = await readChatSettings(db);

  // 回数は chat_usage_total に日ごとにある（チャット Worker が7日で消すので、直近7日分だけ）
  const { results: daily } = await db
    .prepare(
      'SELECT date_jst AS date, count FROM chat_usage_total ORDER BY date_jst DESC LIMIT 7'
    )
    .all<{ date: string; count: number }>();

  // 質問ログ（保存しているときだけ）。だれのものかは保存していない
  const { results: logs } = await db
    .prepare(
      `SELECT datetime(created_at, '+9 hours') AS at, page, question, answer, outcome
         FROM chat_logs ORDER BY id DESC LIMIT 20`
    )
    .all<{ at: string; page: string; question: string; answer: string; outcome: string }>();

  // 今月（日本時間）の質問ログの件数とトークン数
  const monthStart = `${todayJst().slice(0, 7)}-01`;
  const monthTotals = await db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(input_tokens), 0) AS input, COALESCE(SUM(output_tokens), 0) AS output
         FROM chat_logs WHERE date(created_at, '+9 hours') >= ?1`
    )
    .bind(monthStart)
    .first<{ n: number; input: number; output: number }>();

  // 直近30日の評価の集計と「わからなかった」の質問と答え（chat-admin.mjs の ratings と同じ）
  const { results: ratingCounts } = await db
    .prepare(
      `SELECT rating, COUNT(*) AS n FROM chat_feedback
        WHERE created_at >= datetime('now', '-30 days') GROUP BY rating`
    )
    .all<{ rating: string; n: number }>();
  const { results: notUnderstood } = await db
    .prepare(
      `SELECT datetime(f.created_at, '+9 hours') AS at, f.page, l.question, l.answer
         FROM chat_feedback f
         LEFT JOIN chat_logs l ON l.conversation_id = f.conversation_id AND l.turn = f.turn
        WHERE f.rating = 'not' AND f.created_at >= datetime('now', '-30 days')
        ORDER BY f.id DESC LIMIT 20`
    )
    .all<{ at: string; page: string; question: string | null; answer: string | null }>();

  const yenPerRequest = Number.parseFloat(env.CHAT_YEN_PER_REQUEST ?? '0.1') || 0;
  const weekCount = daily.reduce((sum, row) => sum + row.count, 0);
  return jsonResponse(
    {
      available: true,
      settings,
      daily: daily.reverse(),
      // 直近7日の回数から1か月（30日）分を見積もる（使われなかった日は行がないので、日数は常に7で割る）
      estimate: {
        yenPerRequest,
        weekCount,
        monthlyYen: Math.round((weekCount / 7) * 30 * yenPerRequest * 10) / 10,
      },
      month: {
        from: monthStart,
        loggedCount: monthTotals?.n ?? 0,
        inputTokens: monthTotals?.input ?? 0,
        outputTokens: monthTotals?.output ?? 0,
      },
      logs,
      ratings: Object.fromEntries(ratingCounts.map((row) => [row.rating, row.n])),
      notUnderstood,
    },
    200,
    origin
  );
}

/** 管理者の JWT なら中身を返す。そうでなければ返すべきエラーの Response */
async function authenticateAdmin(
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
  if (payload.admin !== true) {
    return jsonResponse({ error: 'forbidden' }, 403, origin);
  }
  return payload;
}

const RECORD_ROUTES: Record<string, { kind: 'task' | 'secret'; action: string }> = {
  tasks: { kind: 'task', action: 'done' },
  secrets: { kind: 'secret', action: 'rotated' },
};

async function route(
  request: Request,
  env: Env,
  payload: JWTPayload,
  path: string,
  origin?: string
): Promise<Response> {
  if (request.method === 'GET' && path === '/ops/overview') {
    return handleOverview(env, origin);
  }
  if (request.method === 'GET' && path === '/ops/chat') {
    return handleChat(env, origin);
  }
  const record = /^\/ops\/(tasks|secrets)\/([a-z0-9-]+)\/(done|rotated)$/.exec(path);
  if (request.method === 'POST' && record) {
    const [, group, id, action] = record;
    const target = RECORD_ROUTES[group];
    if (target.action === action) {
      return handleRecord(request, env, payload, target.kind, id, origin);
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
    if (!env.JWT_SECRET || !env.OPS_DB) {
      console.error('[Ops] Required environment variables are not set');
      return jsonResponse({ error: 'Server configuration error' }, 500, origin);
    }

    const auth = await authenticateAdmin(request, env, origin);
    if (auth instanceof Response) {
      return auth;
    }
    try {
      return await route(request, env, auth, path, origin);
    } catch (error) {
      console.error('[Ops] Error:', error);
      return jsonResponse({ error: 'Internal server error' }, 500, origin);
    }
  },
};
