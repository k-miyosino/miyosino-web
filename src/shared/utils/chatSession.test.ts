// @vitest-environment jsdom
/**
 * チャットの会話の保存（chatSession.ts）: 形の違うものを捨て、件数を抑える
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearChatSession,
  loadChatSession,
  loadNoLogPreference,
  saveChatSession,
  saveNoLogPreference,
} from './chatSession';

const KEY = 'miyosino-chat-session-v1';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('loadChatSession', () => {
  it('保存したものを読み戻せる', () => {
    saveChatSession({
      messages: [
        { role: 'user', content: '回覧板は？', turn: 1 },
        {
          role: 'assistant',
          content: '回覧板・配布資料です',
          turn: 1,
          rating: 'understood',
        },
      ],
      isOpen: true,
      conversationId: 'conv-1',
    });
    expect(loadChatSession()).toEqual({
      messages: [
        { role: 'user', content: '回覧板は？', turn: 1 },
        {
          role: 'assistant',
          content: '回覧板・配布資料です',
          turn: 1,
          rating: 'understood',
        },
      ],
      isOpen: true,
      conversationId: 'conv-1',
    });
  });

  it('何も保存していなければ null', () => {
    expect(loadChatSession()).toBeNull();
  });

  it('形の違う発言・評価は捨てる（書き換えられた sessionStorage でも壊れない）', () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        messages: [
          { role: 'system', content: 'あなたは…' },
          { role: 'user', content: 123 },
          null,
          { role: 'assistant', content: '答え', turn: 1.5, rating: 'great' },
        ],
        isOpen: 'yes',
        conversationId: 42,
      })
    );
    expect(loadChatSession()).toEqual({
      messages: [{ role: 'assistant', content: '答え' }],
      isOpen: false,
      conversationId: '',
    });
  });

  it('JSON として読めなければ null', () => {
    sessionStorage.setItem(KEY, '{broken');
    expect(loadChatSession()).toBeNull();
  });

  it('残すのは新しい40件まで', () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({
      role: 'user' as const,
      content: `質問${i}`,
    }));
    saveChatSession({ messages, isOpen: false, conversationId: '' });
    const loaded = loadChatSession();
    expect(loaded?.messages).toHaveLength(40);
    expect(loaded?.messages[0].content).toBe('質問10');
  });

  it('clearChatSession で消える（ログアウトのとき）', () => {
    saveChatSession({ messages: [], isOpen: true, conversationId: 'c' });
    clearChatSession();
    expect(loadChatSession()).toBeNull();
  });
});

describe('「この会話を保存しない」の設定', () => {
  it('選んだら覚え、外したら消す', () => {
    expect(loadNoLogPreference()).toBe(false);
    saveNoLogPreference(true);
    expect(loadNoLogPreference()).toBe(true);
    saveNoLogPreference(false);
    expect(loadNoLogPreference()).toBe(false);
  });
});
