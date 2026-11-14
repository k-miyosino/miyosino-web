/**
 * Cloudflare Workers - 組合員専用チャットボット API
 *
 * 組合員専用ページのチャットから質問を受け取り、Claude API で答えを返します。
 *
 * エンドポイント:
 * - POST /chat - 会話の履歴を受け取り、答えを返す
 * - GET /chat/usage - 今日の利用回数と上限を返す
 * - GET /chat/status - チャットがオンか、質問ログと評価がオンか、保存期間を返す（画面はオフならボタンを出さない）
 * - POST /chat/feedback - 答えへの評価（わかった／少しわかった／わからなかった）を保存する（回数には数えない）
 * - 定期実行（wrangler.chat.toml の [triggers]）: 保存期間を過ぎた質問ログ・評価・回数を消す
 *
 * 設定: D1 の chat_settings に置く（デプロイなしで変えられ、デプロイし直しても戻らない）
 * - enabled: '1' でオン。workers/ で npm run chat:on / chat:off で切り替える。
 *   オフのときは /chat と /chat/usage が 503（error: 'disabled'）を返す
 * - limit_per_user / limit_total: 1人1日の上限と、全員合計の1日の上限（日本時間で区切る）。
 *   workers/ で npm run chat:limits -- <1人の上限> <全員の上限> で変える
 * - log_enabled / log_retention_days: 質問ログを残すか（'1' でオン）と、残す日数。npm run chat:log / chat:log-days
 * - feedback_enabled: 答えの下に評価のボタンを出すか（'1' でオン）。npm run chat:rating
 * 今の設定は npm run chat:status で見られる。行がないときや値が読めないときは既定値を使う
 * 質問ログと評価には、だれのものかを保存しない（_chatlog.ts）
 *
 * 認証: JWTトークンで組合員認証を確認
 * 回数は D1（バインディング DB）で数える。テーブルは migrations/chat/ を参照
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeReply, runChat } from './_chat-core';
import { createWorkerFetchers, getPageContent } from './_chat-knowledge';
import { verifyJWT } from './_jwt';
import {
  CHAT_RATINGS,
  ChatRating,
  cleanupChatData,
  insertChatLog,
  isValidConversationId,
  sanitizePage,
  upsertChatFeedback,
} from './_chatlog';

interface Env {
  ANTHROPIC_API_KEY: string;
  JWT_SECRET: string;
  DB: D1Database;
  CHAT_MODEL?: string;
  // 公開ページの中身を読むため（_chat-knowledge.ts）。組合員専用ページは読まない
  SITE_URL?: string;
  CONTENTS?: Fetcher;
  PLACES?: Fetcher;
  HISTORY?: Fetcher;
}

interface ChatSettings {
  enabled: boolean;
  limits: { perUser: number; total: number };
  logging: boolean;
  retentionDays: number;
  feedback: boolean;
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

// D1 に上限の設定がないとき・読めないときの値
const DEFAULT_LIMIT_PER_USER = 20;
const DEFAULT_LIMIT_TOTAL = 300;
const DEFAULT_RETENTION_DAYS = 180;
// 送ってよい会話の長さ（費用と悪用を抑える）
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_ASSISTANT_LENGTH = 4000;
// 認証Workerが利用者を識別できなかったときの sub（workers/api/auth.ts と同じ値）
const UNIDENTIFIED_USER_ID = 'kintone-user';


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

// 0 以上の整数として読めなければ既定値にする
function parseLimit(value: string | undefined, fallback: number): number {
  if (value === undefined || !/^\d+$/.test(value.trim())) return fallback;
  return Number.parseInt(value, 10);
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

// 設定をまとめて読む。enabled の行がなければオンとみなす
async function getChatSettings(db: D1Database): Promise<ChatSettings> {
  const { results } = await db
    .prepare('SELECT key, value FROM chat_settings')
    .all<{ key: string; value: string }>();
  const values = new Map(results.map((row) => [row.key, row.value]));
  const enabled = values.get('enabled');
  return {
    enabled: enabled === undefined || enabled === '1',
    limits: {
      perUser: parseLimit(values.get('limit_per_user'), DEFAULT_LIMIT_PER_USER),
      total: parseLimit(values.get('limit_total'), DEFAULT_LIMIT_TOTAL),
    },
    // ログと評価は、設定がなければオフ（オンにするのは告知の準備ができてから）
    logging: values.get('log_enabled') === '1',
    retentionDays: Math.max(
      1,
      parseLimit(values.get('log_retention_days'), DEFAULT_RETENTION_DAYS)
    ),
    feedback: values.get('feedback_enabled') === '1',
  };
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

// 質問ログを保存する。失敗しても答えは返す
async function saveLog(
  env: Env,
  body: unknown,
  messages: ChatMessage[],
  result: ClaudeReply,
  turn: number
): Promise<void> {
  const { conversationId, page } = (body ?? {}) as {
    conversationId?: unknown;
    page?: unknown;
  };
  try {
    await insertChatLog(env.DB, {
      conversationId: isValidConversationId(conversationId) ? conversationId : '',
      turn,
      page: sanitizePage(page),
      question: messages[messages.length - 1].content,
      answer: result.reply,
      outcome: result.outcome,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
  } catch (error) {
    console.error('[Chat] Failed to save log:', error);
  }
}

async function handleChat(
  request: Request,
  env: Env,
  userId: string,
  settings: ChatSettings,
  origin?: string
): Promise<Response> {
  const { limits } = settings;
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

  // 会話の中で何番目の質問か（評価をどの答えに付けるかに使う）
  const turn = messages.filter((m) => m.role === 'user').length;
  let result: ClaudeReply;
  try {
    const fetchers = createWorkerFetchers(env);
    result = await runChat({
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.CHAT_MODEL,
      messages,
      readPage: (path) => getPageContent(path, fetchers),
    });
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

  // 質問ログは、ログがオンで、利用者が「この会話を保存しない」を選んでいないときだけ
  const saveLogRequested = (body as { saveLog?: unknown }).saveLog !== false;
  if (settings.logging && saveLogRequested) {
    await saveLog(env, body, messages, result, turn);
  }
  const usage = await getUserUsage(env.DB, userId, date, limits.perUser);
  return jsonResponse({ reply: result.reply, usage, turn }, 200, origin);
}

// 答えへの評価を保存する（チャットの回数には数えない）
async function handleFeedback(
  request: Request,
  env: Env,
  origin?: string
): Promise<Response> {
  let body: { conversationId?: unknown; turn?: unknown; rating?: unknown; page?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400, origin);
  }
  const { conversationId, turn, rating } = body;
  if (
    !isValidConversationId(conversationId) ||
    conversationId === '' ||
    typeof turn !== 'number' ||
    !Number.isInteger(turn) ||
    turn < 1 ||
    turn > 1000 ||
    !CHAT_RATINGS.includes(rating as ChatRating)
  ) {
    return jsonResponse({ error: 'invalid_request' }, 400, origin);
  }
  await upsertChatFeedback(env.DB, {
    conversationId,
    turn,
    rating: rating as ChatRating,
    page: sanitizePage(body.page),
  });
  return jsonResponse({ ok: true }, 200, origin);
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
    try {
      // オン・オフは利用者の識別より先に答える（オフなら誰にもボタンを出さない）
      const settings = await getChatSettings(env.DB);
      const { enabled, limits } = settings;
      if (path === '/chat/status' && request.method === 'GET') {
        return jsonResponse(
          {
            enabled,
            logging: settings.logging,
            retentionDays: settings.retentionDays,
            feedback: settings.feedback,
          },
          200,
          origin
        );
      }
      if (!enabled) {
        return jsonResponse({ error: 'disabled' }, 503, origin);
      }

      // 利用者を識別できないと1人ごとに数えられないので使わせない（再ログインで識別される）
      if (!payload.sub || payload.sub === UNIDENTIFIED_USER_ID) {
        return jsonResponse({ error: 'unidentified' }, 403, origin);
      }

      if (path === '/chat' && request.method === 'POST') {
        return await handleChat(request, env, payload.sub, settings, origin);
      }
      if (path === '/chat/feedback' && request.method === 'POST') {
        if (!settings.feedback) {
          return jsonResponse({ error: 'feedback_disabled' }, 503, origin);
        }
        return await handleFeedback(request, env, origin);
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

  // 定期実行: 保存期間を過ぎた質問ログ・評価・回数を消す（wrangler.chat.toml の [triggers]）
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    if (!env.DB) return;
    const { retentionDays } = await getChatSettings(env.DB);
    await cleanupChatData(env.DB, retentionDays);
    console.log(`[Chat] Cleaned up data older than ${retentionDays} days`);
  },
};
