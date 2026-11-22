/**
 * チャットの見直しの一覧（運用ダッシュボードの「チャット」→「見直し」）
 *
 * 答えを直すきっかけになる質問を1つの一覧にまとめ、管理者が「直した」「対応不要」を記録できるようにする。
 * 一覧に入るのは次のどれかに当てはまる質問:
 * - 評価が「わからなかった」「少しわかった」
 * - 安全上の理由で断られた答え（outcome = refused）
 * - 案内文（chat-guide.ts）の「答えられないとき」の決まり文句を含む答え
 *
 * 質問と答えは CHAT_DB（miyosino-chat、読むだけ）、記録は OPS_DB（miyosino-ops）の ops_chat_review にある。
 * 2つのデータベースはまたいで結合できないので、Worker の中で突き合わせる。
 */

export type ChatReviewReason = 'not' | 'partly' | 'refused' | 'cannot' | 'offtopic';
export type ChatReviewStatus = 'fixed' | 'skipped' | 'open';
export const CHAT_REVIEW_STATUSES: readonly ChatReviewStatus[] = ['fixed', 'skipped', 'open'];

/**
 * 「答えられないとき」の決まり文句（chat-guide.ts の CHAT_SYSTEM_PROMPT と同じ言葉）。
 * 案内文を変えたらここも直す（workers/test/ops-chat-review.test.ts が、案内文に含まれているかを確かめる）
 */
export const CANNOT_ANSWER_PHRASE = 'このチャットではお答えできません';
export const OFF_TOPIC_PHRASE = '団地とホームページのことだけお答えしています';

const MAX_ITEMS = 200;
const MAX_NOTE_LENGTH = 500;

export interface ChatReviewRecord {
  status: ChatReviewStatus;
  note: string;
  done_by: string;
  done_at: string; // 日本時間 'YYYY-MM-DD HH:MM'
}

export interface ChatReviewItem {
  /** 「会話の番号:何番目の質問か」。記録と結びつける */
  key: string;
  at: string; // 日本時間 'YYYY-MM-DD HH:MM:SS'
  page: string;
  question: string | null;
  answer: string | null;
  reasons: ChatReviewReason[];
  /** いちばん新しい記録（無ければ未対応） */
  review: ChatReviewRecord | null;
}

interface CandidateRow {
  cid: string;
  turn: number;
  at: string;
  page: string;
  question: string | null;
  answer: string | null;
  outcome: string | null;
  rating: string | null;
}

export function reviewKey(conversationId: string, turn: number): string {
  return `${conversationId}:${turn}`;
}

/** 記録を受け付けてよいキーか（会話の番号は chat.ts の isValidConversationId と同じ形） */
export function isValidReviewKey(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9-]{1,64}:\d{1,4}$/.test(value);
}

function reasonsOf(row: CandidateRow): ChatReviewReason[] {
  const reasons: ChatReviewReason[] = [];
  if (row.rating === 'not' || row.rating === 'partly') reasons.push(row.rating);
  if (row.outcome === 'refused') reasons.push('refused');
  if (row.answer?.includes(CANNOT_ANSWER_PHRASE)) reasons.push('cannot');
  if (row.answer?.includes(OFF_TOPIC_PHRASE)) reasons.push('offtopic');
  return reasons;
}

// D1 の datetime('now')（UTC）を日本時間の 'YYYY-MM-DD HH:MM' にする
function toJstMinutes(utc: string): string {
  const date = new Date(`${utc.replace(' ', 'T')}Z`);
  return new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ');
}

/** 見直しの候補（新しい順）と、それぞれのいちばん新しい記録 */
export async function loadChatReview(
  chatDb: D1Database,
  opsDb: D1Database
): Promise<{ items: ChatReviewItem[]; openCount: number }> {
  const { results: rows } = await chatDb
    .prepare(
      `SELECT * FROM (
         SELECT l.conversation_id AS cid, l.turn, datetime(l.created_at, '+9 hours') AS at, l.page,
                l.question, l.answer, l.outcome, NULL AS rating
           FROM chat_logs l
          WHERE l.conversation_id <> ''
            AND (l.outcome = 'refused' OR instr(l.answer, ?1) > 0 OR instr(l.answer, ?2) > 0)
         UNION ALL
         SELECT f.conversation_id AS cid, f.turn, datetime(f.created_at, '+9 hours') AS at, f.page,
                l.question, l.answer, l.outcome, f.rating
           FROM chat_feedback f
           LEFT JOIN chat_logs l ON l.conversation_id = f.conversation_id AND l.turn = f.turn
          WHERE f.conversation_id <> '' AND f.rating IN ('not', 'partly')
       ) ORDER BY at DESC LIMIT ?3`
    )
    // LIKE は使わない（D1 は LIKE のパターンを 50 バイトまでに制限していて、日本語の決まり文句が収まらない）
    .bind(CANNOT_ANSWER_PHRASE, OFF_TOPIC_PHRASE, MAX_ITEMS)
    .all<CandidateRow>();

  // 同じ質問が評価と答えの両方で当てはまったら1件にまとめる
  const byKey = new Map<string, ChatReviewItem>();
  for (const row of rows) {
    const key = reviewKey(row.cid, row.turn);
    const item = byKey.get(key);
    const reasons = reasonsOf(row);
    if (item) {
      item.reasons = [...new Set([...item.reasons, ...reasons])];
      item.question ??= row.question;
      item.answer ??= row.answer;
    } else {
      byKey.set(key, {
        key,
        at: row.at,
        page: row.page,
        question: row.question,
        answer: row.answer,
        reasons,
        review: null,
      });
    }
  }

  const { results: records } = await opsDb
    .prepare(
      'SELECT item_key, status, note, done_by, done_at FROM ops_chat_review ORDER BY done_at DESC, id DESC'
    )
    .all<{ item_key: string } & ChatReviewRecord>();
  for (const record of records) {
    const item = byKey.get(record.item_key);
    if (item && !item.review) {
      item.review = {
        status: record.status,
        note: record.note,
        done_by: record.done_by,
        done_at: toJstMinutes(record.done_at),
      };
    }
  }

  const items = [...byKey.values()];
  const isOpen = (item: ChatReviewItem) => !item.review || item.review.status === 'open';
  return { items, openCount: items.filter(isOpen).length };
}

/** 見直しの記録を受け取って残す。中身が正しくなければ理由を返す */
export async function recordChatReview(
  opsDb: D1Database,
  body: unknown,
  doneBy: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { key, status, note } = (body ?? {}) as {
    key?: unknown;
    status?: unknown;
    note?: unknown;
  };
  if (!isValidReviewKey(key)) return { ok: false, error: 'Invalid key' };
  if (!CHAT_REVIEW_STATUSES.includes(status as ChatReviewStatus)) {
    return { ok: false, error: 'Invalid status' };
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    return { ok: false, error: 'Invalid note' };
  }
  await opsDb
    .prepare(
      'INSERT INTO ops_chat_review (item_key, status, done_by, note) VALUES (?1, ?2, ?3, ?4)'
    )
    .bind(key, status, doneBy, (note ?? '').trim().slice(0, MAX_NOTE_LENGTH))
    .run();
  return { ok: true };
}
