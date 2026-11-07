import { ChatErrorCode, ChatMessage, ChatUsage } from '@/types/chat';
import { getToken } from '@/shared/utils/auth';
import { handleUnauthorized } from '../kintone/utils';

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
  if (response.status === 401) handleUnauthorized();

  let data: ChatErrorResponse = {};
  try {
    data = (await response.json()) as ChatErrorResponse;
  } catch {
    // 本文がJSONでなければ種類は「その他」とする
  }
  const code: ChatErrorCode =
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

/** 今日の利用回数を取得する */
export async function fetchChatUsage(): Promise<ChatUsage> {
  const data = await requestChatApi<{ usage: ChatUsage }>('/chat/usage', {
    method: 'GET',
  });
  return data.usage;
}

/** 会話を送って答えを受け取る。最後の発言は利用者の質問であること */
export async function sendChatMessages(
  messages: ChatMessage[]
): Promise<{ reply: string; usage: ChatUsage }> {
  return requestChatApi<{ reply: string; usage: ChatUsage }>('/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
}
