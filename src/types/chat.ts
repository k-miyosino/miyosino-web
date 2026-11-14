/** 答えへの評価（わかった／少しわかった／わからなかった） */
export type ChatRating = 'understood' | 'partly' | 'not';

/** チャットボットの1件の発言 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** 答えのとき: 会話の中で何番目の質問への答えか（評価を付けるのに使う） */
  turn?: number;
  /** 答えのとき: 利用者が付けた評価 */
  rating?: ChatRating;
}

/** チャットの状態（/chat/status） */
export interface ChatStatus {
  enabled: boolean;
  /** 質問ログを保存しているか（画面に告知と「この会話を保存しない」を出す） */
  logging: boolean;
  /** 質問ログを残す日数 */
  retentionDays: number;
  /** 答えの下に評価のボタンを出すか */
  feedback: boolean;
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
 * - unauthorized: ログインの有効期限が切れている（もう一度ログインが必要）
 * - disabled: チャットがオフになっている
 * - failed: その他の失敗
 */
export type ChatErrorCode =
  | 'unauthorized'
  | 'disabled'
  | 'unidentified'
  | 'user_limit'
  | 'total_limit'
  | 'failed';
