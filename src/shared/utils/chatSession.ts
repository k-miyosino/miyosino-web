import type { ChatMessage } from '@/types/chat';

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

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const { role, content } = value as { role?: unknown; content?: unknown };
  return (
    (role === 'user' || role === 'assistant') && typeof content === 'string'
  );
}

export function loadChatSession(): ChatSession | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<ChatSession>;
    const messages = Array.isArray(data.messages)
      ? data.messages.filter(isChatMessage).slice(-MAX_STORED_MESSAGES)
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
