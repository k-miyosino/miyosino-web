import {
  ChatErrorCode,
  ChatMessage,
  ChatRating,
  ChatStatus,
  ChatUsage,
} from '@/types/chat';
import { getToken } from '@/shared/utils/auth';

const CHAT_API_ENDPOINT =
  process.env.NEXT_PUBLIC_CHAT_API_URL ||
  'https://miyosino-chat.anorimura-miyosino.workers.dev';

/** チャットWorkerが送れる会話の長さ（workers/api/chat.ts と合わせる） */
export const CHAT_MAX_MESSAGES = 20;
export const CHAT_MAX_MESSAGE_LENGTH = 1000;

export class ChatApiError extends Error {
  constructor(
    message: string,
    public readonly code: ChatErrorCode,
    public readonly usage?: ChatUsage
  ) {
    super(message);
    this.name = 'ChatApiError';
  }
}

interface ChatErrorResponse {
  error?: string;
  usage?: ChatUsage;
}

async function requestChatApi<T>(path: string, init: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) {
    throw new Error('認証トークンがありません');
  }

  const response = await fetch(`${CHAT_API_ENDPOINT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (response.ok) {
    return (await response.json()) as T;
  }
  // ログインの期限切れなど。公開ページを見ているだけの人を知らないうちにログアウトさせないよう、
  // 保存されたログインの情報は消さずに知らせるだけにする（組合員専用ページは各ページの認証の確認で扱う）
  if (response.status === 401) {
    throw new ChatApiError('ログインの有効期限が切れました', 'unauthorized');
  }

  let data: ChatErrorResponse = {};
  try {
    data = (await response.json()) as ChatErrorResponse;
  } catch {
    // 本文がJSONでなければ種類は「その他」とする
  }
  const code: ChatErrorCode =
    data.error === 'disabled' ||
    data.error === 'unidentified' ||
    data.error === 'user_limit' ||
    data.error === 'total_limit'
      ? data.error
      : 'failed';
  throw new ChatApiError(
    `チャットAPIの呼び出しに失敗しました: ${response.status}`,
    code,
    data.usage
  );
}

/** チャットの状態（オンか、質問ログと評価がオンか、保存期間）を取得する */
export async function fetchChatStatus(): Promise<ChatStatus> {
  const data = await requestChatApi<Partial<ChatStatus>>('/chat/status', {
    method: 'GET',
  });
  return {
    enabled: data.enabled === true,
    logging: data.logging === true,
    retentionDays:
      typeof data.retentionDays === 'number' ? data.retentionDays : 0,
    feedback: data.feedback === true,
  };
}

/** 今日の利用回数を取得する */
export async function fetchChatUsage(): Promise<ChatUsage> {
  const data = await requestChatApi<{ usage: ChatUsage }>('/chat/usage', {
    method: 'GET',
  });
  return data.usage;
}

export interface SendChatOptions {
  /** 会話をまとめるためのランダムな ID（だれかとは結びつかない） */
  conversationId: string;
  /** 質問したページのパス */
  page: string;
  /** false なら、質問ログに保存しない（「この会話を保存しない」） */
  saveLog: boolean;
}

/** 会話を送って答えを受け取る。最後の発言は利用者の質問であること */
export async function sendChatMessages(
  messages: ChatMessage[],
  options: SendChatOptions
): Promise<{ reply: string; usage: ChatUsage; turn: number }> {
  return requestChatApi<{ reply: string; usage: ChatUsage; turn: number }>(
    '/chat',
    {
      method: 'POST',
      // 送るのは役割と文章だけ（評価などの画面用の項目は送らない）
      body: JSON.stringify({
        messages: messages.map(({ role, content }) => ({ role, content })),
        ...options,
      }),
    }
  );
}

/** 答えへの評価を送る（チャットの回数には数えない） */
export async function sendChatFeedback(feedback: {
  conversationId: string;
  turn: number;
  rating: ChatRating;
  page: string;
}): Promise<void> {
  await requestChatApi<{ ok: boolean }>('/chat/feedback', {
    method: 'POST',
    body: JSON.stringify(feedback),
  });
}
