/**
 * Cloudflare Workers - 組合員専用チャットボット API
 *
 * 組合員専用ページのチャットから質問を受け取り、Claude API で答えを返します。
 *
 * エンドポイント:
 * - POST /chat - 会話の履歴を受け取り、答えを返す
 * - GET /chat/usage - 今日の利用回数と上限を返す
 *
 * 認証: JWTトークンで組合員認証を確認
 * 回数制限: 1人1日 CHAT_DAILY_LIMIT_PER_USER 回、全員で1日 CHAT_DAILY_LIMIT_TOTAL 回（日本時間で区切る）。
 *   回数は D1（バインディング DB）で数える。テーブルは migrations/chat/ を参照
 */

import Anthropic from '@anthropic-ai/sdk';
import { CHAT_SYSTEM_PROMPT } from './chat-guide';

interface Env {
  ANTHROPIC_API_KEY: string;
  JWT_SECRET: string;
  DB: D1Database;
  CHAT_MODEL?: string;
  CHAT_DAILY_LIMIT_PER_USER?: string;
  CHAT_DAILY_LIMIT_TOTAL?: string;
}

interface JWTPayload {
  sub: string;
  name: string;
  email: string;
  iat: number;
  exp: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatUsage {
  used: number;
  limit: number;
  remaining: number;
}

const DEFAULT_MODEL = 'claude-opus-5-5';
const DEFAULT_LIMIT_PER_USER = 20;
const DEFAULT_LIMIT_TOTAL = 300;
// 1回の答えの上限。考える分のトークンも含む
const MAX_TOKENS = 8000;
// 送ってよい会話の長さ（費用と悪用を抑える）
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_ASSISTANT_LENGTH = 4000;
// 認証Workerが利用者を識別できなかったときの sub（workers/api/auth.ts と同じ値）
const UNIDENTIFIED_USER_ID = 'kintone-user';
// サーバー側の自動フォールバック（fallbacks: "default"）に対応しているモデル
const MODELS_WITH_SERVER_FALLBACK = new Set([
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
]);

const REFUSAL_REPLY =
  'すみません、この質問にはお答えできません。管理組合事務所かお問い合わせページ（/contact）にお問い合わせください。';

function corsHeaders(origin?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(
  body: unknown,
  status: number,
  origin?: string
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

// JWT検証関数
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

    // JWTのペイロードは UTF-8（表示名に日本語が入る）なので、バイト列として復号する
    const payloadBytes = Uint8Array.from(
      atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0)
    );
    const payload = JSON.parse(
      new TextDecoder().decode(payloadBytes)
    ) as JWTPayload;

    // 有効期限チェック
    if (payload.exp < Date.now() / 1000) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('[Chat] JWT verification error:', error);
    return null;
  }
}

function parseLimit(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

// 日本時間の日付（YYYY-MM-DD）
function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 回数を1つ増やす。上限に達していれば増やさずに false を返す。
 * 上限の確認と加算を1つのSQLで行うので、同時に送られても上限を超えない。
 */
async function reserveUserCount(
  db: D1Database,
  userId: string,
  date: string,
  limit: number
): Promise<boolean> {
  if (limit <= 0) return false;
  const row = await db
    .prepare(
      `INSERT INTO chat_usage (user_id, date_jst, count) VALUES (?1, ?2, 1)
       ON CONFLICT (user_id, date_jst) DO UPDATE SET count = count + 1 WHERE count < ?3
       RETURNING count`
    )
    .bind(userId, date, limit)
    .first<{ count: number }>();
  return row !== null;
}

async function reserveTotalCount(
  db: D1Database,
  date: string,
  limit: number
): Promise<boolean> {
  if (limit <= 0) return false;
  const row = await db
    .prepare(
      `INSERT INTO chat_usage_total (date_jst, count) VALUES (?1, 1)
       ON CONFLICT (date_jst) DO UPDATE SET count = count + 1 WHERE count < ?2
       RETURNING count`
    )
    .bind(date, limit)
    .first<{ count: number }>();
  return row !== null;
}

// 答えられなかったときに回数を戻す
async function releaseUserCount(
  db: D1Database,
  userId: string,
  date: string
): Promise<void> {
  await db
    .prepare(
      'UPDATE chat_usage SET count = count - 1 WHERE user_id = ?1 AND date_jst = ?2 AND count > 0'
    )
    .bind(userId, date)
    .run();
}

async function releaseTotalCount(db: D1Database, date: string): Promise<void> {
  await db
    .prepare(
      'UPDATE chat_usage_total SET count = count - 1 WHERE date_jst = ?1 AND count > 0'
    )
    .bind(date)
    .run();
}

async function getUserUsage(
  db: D1Database,
  userId: string,
  date: string,
  limit: number
): Promise<ChatUsage> {
  const row = await db
    .prepare(
      'SELECT count FROM chat_usage WHERE user_id = ?1 AND date_jst = ?2'
    )
    .bind(userId, date)
    .first<{ count: number }>();
  const used = row?.count ?? 0;
  return { used, limit, remaining: Math.max(limit - used, 0) };
}

// リクエストの会話を確かめる。不正なら null
function parseMessages(body: unknown): ChatMessage[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const messages = (body as { messages?: unknown }).messages;
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > MAX_MESSAGES
  ) {
    return null;
  }

  const parsed: ChatMessage[] = [];
  for (const message of messages) {
    if (typeof message !== 'object' || message === null) return null;
    const { role, content } = message as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') return null;
    if (typeof content !== 'string') return null;
    const trimmed = content.trim();
    if (trimmed.length === 0) return null;
    if (role === 'user') {
      if (trimmed.length > MAX_MESSAGE_LENGTH) return null;
      parsed.push({ role, content: trimmed });
    } else {
      // 以前の答えは長いことがあるので、拒否せずに切り詰める
      parsed.push({ role, content: trimmed.slice(0, MAX_ASSISTANT_LENGTH) });
    }
  }

  // 最初と最後は利用者の質問でなければならない
  if (parsed[0].role !== 'user' || parsed[parsed.length - 1].role !== 'user') {
    return null;
  }
  return parsed;
}

async function askClaude(env: Env, messages: ChatMessage[]): Promise<string> {
  const model = env.CHAT_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });
  const useFallback = MODELS_WITH_SERVER_FALLBACK.has(model);

  const response = await client.beta.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    // 案内の質問は難しくないので、考える量を抑えて速さと費用を優先する
    output_config: { effort: 'low' },
    // 安全上の理由で断られたとき、サーバー側で別のモデルに答えさせる
    ...(useFallback
      ? {
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default' as const,
        }
      : {}),
    system: [
      {
        type: 'text',
        text: CHAT_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages,
  });

  if (response.stop_reason === 'refusal') {
    return REFUSAL_REPLY;
  }

  const reply = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('')
    .trim();
  if (!reply) {
    throw new Error(`Empty reply (stop_reason: ${response.stop_reason})`);
  }
  return reply;
}

async function handleChat(
  request: Request,
  env: Env,
  userId: string,
  limits: { perUser: number; total: number },
  origin?: string
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400, origin);
  }
  const messages = parseMessages(body);
  if (!messages) {
    return jsonResponse({ error: 'invalid_request' }, 400, origin);
  }

  const date = todayJst();
  if (!(await reserveUserCount(env.DB, userId, date, limits.perUser))) {
    return jsonResponse(
      {
        error: 'user_limit',
        usage: await getUserUsage(env.DB, userId, date, limits.perUser),
      },
      429,
      origin
    );
  }
  if (!(await reserveTotalCount(env.DB, date, limits.total))) {
    await releaseUserCount(env.DB, userId, date);
    return jsonResponse(
      {
        error: 'total_limit',
        usage: await getUserUsage(env.DB, userId, date, limits.perUser),
      },
      429,
      origin
    );
  }

  try {
    const reply = await askClaude(env, messages);
    const usage = await getUserUsage(env.DB, userId, date, limits.perUser);
    return jsonResponse({ reply, usage }, 200, origin);
  } catch (error) {
    // 答えられなかった分は数えない
    await releaseUserCount(env.DB, userId, date);
    await releaseTotalCount(env.DB, date);
    if (error instanceof Anthropic.APIError) {
      console.error('[Chat] Claude API error:', error.status, error.message);
    } else {
      console.error('[Chat] Failed to get reply:', error);
    }
    return jsonResponse({ error: 'chat_failed' }, 502, origin);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');
    const origin = request.headers.get('Origin') || undefined;

    // CORSプリフライトリクエストの処理
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (!env.ANTHROPIC_API_KEY || !env.JWT_SECRET || !env.DB) {
      console.error('[Chat] Required environment variables are not set');
      return jsonResponse({ error: 'Server configuration error' }, 500, origin);
    }

    // JWTトークンで認証確認
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401, origin);
    }
    const payload = await verifyJWT(authHeader.substring(7), env.JWT_SECRET);
    if (!payload) {
      return jsonResponse({ error: 'Invalid token' }, 401, origin);
    }
    // 利用者を識別できないと1人ごとに数えられないので使わせない（再ログインで識別される）
    if (!payload.sub || payload.sub === UNIDENTIFIED_USER_ID) {
      return jsonResponse({ error: 'unidentified' }, 403, origin);
    }

    const limits = {
      perUser: parseLimit(env.CHAT_DAILY_LIMIT_PER_USER, DEFAULT_LIMIT_PER_USER),
      total: parseLimit(env.CHAT_DAILY_LIMIT_TOTAL, DEFAULT_LIMIT_TOTAL),
    };

    try {
      if (path === '/chat' && request.method === 'POST') {
        return await handleChat(request, env, payload.sub, limits, origin);
      }
      if (path === '/chat/usage' && request.method === 'GET') {
        const usage = await getUserUsage(
          env.DB,
          payload.sub,
          todayJst(),
          limits.perUser
        );
        return jsonResponse({ usage }, 200, origin);
      }
      return jsonResponse({ error: 'Not found' }, 404, origin);
    } catch (error) {
      console.error('[Chat] Error:', error);
      return jsonResponse({ error: 'Internal server error' }, 500, origin);
    }
  },
};
