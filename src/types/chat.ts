/** チャットボットの1件の発言 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** 今日の利用回数（日本時間で区切る） */
export interface ChatUsage {
  used: number;
  limit: number;
  remaining: number;
}

/**
 * チャットAPIのエラーの種類
 * - unidentified: 利用者を識別できない（再ログインが必要）
 * - user_limit: 1人1日の上限に達した
 * - total_limit: 全員合計の1日の上限に達した
 * - failed: その他の失敗
 */
export type ChatErrorCode =
  | 'unidentified'
  | 'user_limit'
  | 'total_limit'
  | 'failed';
