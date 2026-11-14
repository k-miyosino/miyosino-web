/**
 * チャットボットの質問ログと、答えへの評価（D1）
 *
 * - だれの質問・評価かは保存しない（kintone のユーザーコードなどは渡さない・入れない）
 * - 質問と答えは、電話番号・メールアドレス・部屋番号らしい文字列を ＊＊＊ に置き換えてから保存する
 * - 保存期間を過ぎたものは、定期実行（cleanupChatData）で消す
 * テーブルは migrations/chat/0004_add_chat_logs_and_feedback.sql を参照。
 */

export type ChatRating = 'understood' | 'partly' | 'not';
export const CHAT_RATINGS: readonly ChatRating[] = ['understood', 'partly', 'not'];

export interface ChatLogEntry {
  conversationId: string;
  turn: number;
  page: string;
  question: string;
  answer: string;
  outcome: 'answered' | 'refused';
  model: string;
  inputTokens: number;
  outputTokens: number;
}

// 回数のテーブル（chat_usage、kintone のユーザーコードを含む）を残す日数。回数はその日の分しか使わない
const USAGE_RETENTION_DAYS = 7;

const MASK = '＊＊＊';
// 数字は半角・全角のどちらも当てる。量の指定はすべて上限付き（長い入力でも処理が増えすぎないように）
const DIGIT = '[0-9０-９]';
const MASK_PATTERNS: readonly RegExp[] = [
  // メールアドレス
  /[^\s@＠]{1,64}[@＠][^\s@＠]{1,255}/g,
  // 電話番号（090-1234-5678、03-1234-5678、09012345678 など。区切りはハイフン類か空白）
  new RegExp(`${DIGIT}{2,4}[-‐－ー\\s]?${DIGIT}{2,4}[-‐－ー\\s]?${DIGIT}{3,4}`, 'g'),
  // 部屋番号（3号棟201号室、201号室）
  new RegExp(`(?:${DIGIT}{1,4}号棟)?${DIGIT}{1,5}号室`, 'g'),
];

/** 個人情報らしい文字列を ＊＊＊ に置き換える */
export function maskPersonalInfo(text: string): string {
  return MASK_PATTERNS.reduce((masked, pattern) => masked.replace(pattern, MASK), text);
}

export async function insertChatLog(db: D1Database, entry: ChatLogEntry): Promise<void> {
  await db
    .prepare(
      `INSERT INTO chat_logs
         (conversation_id, turn, page, question, answer, outcome, model, input_tokens, output_tokens)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    )
    .bind(
      entry.conversationId,
      entry.turn,
      entry.page,
      maskPersonalInfo(entry.question),
      maskPersonalInfo(entry.answer),
      entry.outcome,
      entry.model,
      entry.inputTokens,
      entry.outputTokens
    )
    .run();
}

/** 評価を保存する。同じ答えへの評価は上書きする（選び直したとき） */
export async function upsertChatFeedback(
  db: D1Database,
  feedback: { conversationId: string; turn: number; rating: ChatRating; page: string }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO chat_feedback (conversation_id, turn, rating, page) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (conversation_id, turn) DO UPDATE SET rating = excluded.rating, created_at = datetime('now')`
    )
    .bind(feedback.conversationId, feedback.turn, feedback.rating, feedback.page)
    .run();
}

/**
 * 保存期間を過ぎたデータを消す（定期実行から呼ぶ）。
 * - 質問ログと評価: retentionDays 日より前のもの
 * - 回数（chat_usage）: USAGE_RETENTION_DAYS 日より前のもの（日本時間の日付で比べる）
 */
export async function cleanupChatData(db: D1Database, retentionDays: number): Promise<void> {
  const olderThan = `-${retentionDays} days`;
  await db.batch([
    db.prepare("DELETE FROM chat_logs WHERE created_at < datetime('now', ?1)").bind(olderThan),
    db.prepare("DELETE FROM chat_feedback WHERE created_at < datetime('now', ?1)").bind(olderThan),
    db
      .prepare("DELETE FROM chat_usage WHERE date_jst < date('now', '+9 hours', ?1)")
      .bind(`-${USAGE_RETENTION_DAYS} days`),
    db
      .prepare("DELETE FROM chat_usage_total WHERE date_jst < date('now', '+9 hours', ?1)")
      .bind(`-${retentionDays} days`),
  ]);
}

/** 会話の ID（画面が作るランダムな値）として受け付けてよいか */
export function isValidConversationId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && /^[A-Za-z0-9-]*$/.test(value);
}

/** 質問したページのパスとして受け付けてよい形に整える（そうでなければ空） */
export function sanitizePage(value: unknown): string {
  if (typeof value !== 'string' || value.length > 100) return '';
  return /^\/[A-Za-z0-9/_-]*$/.test(value) ? value : '';
}
