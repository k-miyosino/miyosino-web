import type { ChatMessage, ChatRating } from '@/types/chat';

/**
 * チャットの会話をブラウザの sessionStorage に残す（ページを移動しても会話が続くように）。
 * sessionStorage はタブを閉じると消えるので、共用の端末でも次の人に会話が残らない。
 * ログアウトしたときも clearChatSession で消す。
 * 使えない環境（プライベートブラウズの制限など）では何もしない。
 */

const STORAGE_KEY = 'miyosino-chat-session-v1';
// 残す会話の上限（画面に出す分。送る分は chatRepository の上限で切り出す）
const MAX_STORED_MESSAGES = 40;

export interface ChatSession {
  messages: ChatMessage[];
  isOpen: boolean;
  /** 会話をまとめるためのランダムな ID（だれかとは結びつかない）。まだ質問していなければ空 */
  conversationId: string;
}

const RATINGS: readonly ChatRating[] = ['understood', 'partly', 'not'];

// 保存しておいた発言を確かめて取り出す（形が違うものは捨てる）
function toChatMessage(value: unknown): ChatMessage | null {
  if (typeof value !== 'object' || value === null) return null;
  const { role, content, turn, rating } = value as Record<string, unknown>;
  if (
    (role !== 'user' && role !== 'assistant') ||
    typeof content !== 'string'
  ) {
    return null;
  }
  const message: ChatMessage = { role, content };
  if (typeof turn === 'number' && Number.isInteger(turn)) message.turn = turn;
  if (RATINGS.includes(rating as ChatRating))
    message.rating = rating as ChatRating;
  return message;
}

export function loadChatSession(): ChatSession | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<ChatSession>;
    const messages = Array.isArray(data.messages)
      ? data.messages
          .map(toChatMessage)
          .filter((m): m is ChatMessage => m !== null)
          .slice(-MAX_STORED_MESSAGES)
      : [];
    return {
      messages,
      isOpen: data.isOpen === true,
      conversationId:
        typeof data.conversationId === 'string' ? data.conversationId : '',
    };
  } catch {
    return null;
  }
}

export function saveChatSession(session: ChatSession): void {
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...session,
        messages: session.messages.slice(-MAX_STORED_MESSAGES),
      })
    );
  } catch {
    // 保存できなくてもチャットは使える
  }
}

export function clearChatSession(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 消せなくても続ける
  }
}

/**
 * 会話の ID を作る。crypto.randomUUID が使えない古いブラウザでは crypto.getRandomValues で作る。
 * どちらも使えなければ空にする（ID がなくてもチャットは使える。Math.random は予測できるので使わない）
 */
export function createConversationId(): string {
  try {
    if (typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

const NO_LOG_KEY = 'miyosino-chat-no-log';

/** 「この会話を保存しない」を選んでいるか（その端末に覚えておく） */
export function loadNoLogPreference(): boolean {
  try {
    return window.localStorage.getItem(NO_LOG_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveNoLogPreference(noLog: boolean): void {
  try {
    if (noLog) window.localStorage.setItem(NO_LOG_KEY, '1');
    else window.localStorage.removeItem(NO_LOG_KEY);
  } catch {
    // 覚えられなくてもチャットは使える
  }
}
