'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ChatErrorCode, ChatMessage, ChatUsage } from '@/types/chat';
import {
  CHAT_MAX_MESSAGE_LENGTH,
  CHAT_MAX_MESSAGES,
  ChatApiError,
  fetchChatUsage,
  sendChatMessages,
} from '@/repositories/chat/chatRepository';
import { logout } from '@/shared/utils/auth';

const ERROR_MESSAGES: Record<ChatErrorCode, string> = {
  unidentified:
    '利用者を確認できませんでした。いったんログアウトして、もう一度ログインしてください。',
  user_limit:
    '今日の利用回数の上限に達しました。明日（日本時間の0時以降）にまたご利用ください。',
  total_limit:
    '今日はチャットの利用が混み合っているため、受付を終了しました。明日またご利用ください。',
  failed:
    '答えを受け取れませんでした。しばらくしてからもう一度お試しください。',
};

const SUGGESTED_QUESTIONS = [
  '回覧板はどこで見られますか？',
  '申請書はどうやって出せばいいですか？',
  'イベントの予定はどこで確認できますか？',
];

/** 送る会話を Worker の上限に合わせて切り出す（先頭は利用者の質問にする） */
function toRequestMessages(history: ChatMessage[]): ChatMessage[] {
  const recent = history.slice(-CHAT_MAX_MESSAGES);
  while (recent.length > 0 && recent[0].role !== 'user') {
    recent.shift();
  }
  return recent;
}

function toErrorCode(error: unknown): ChatErrorCode {
  return error instanceof ChatApiError ? error.code : 'failed';
}

/**
 * 組合員専用ページの右下に出すチャットボット。
 * 認証済みのときだけ描画すること（MemberAuthWrapper と組合員専用トップから使う）。
 * 会話はこのコンポーネントの中にだけ持ち、ページを移動すると消える。
 */
export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [usage, setUsage] = useState<ChatUsage | null>(null);
  const [errorCode, setErrorCode] = useState<ChatErrorCode | null>(null);
  const hasLoadedUsage = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 初めて開いたときに今日の残り回数を取得する（識別できない利用者もここでわかる）
  useEffect(() => {
    if (!isOpen || hasLoadedUsage.current) return;
    hasLoadedUsage.current = true;
    fetchChatUsage()
      .then(setUsage)
      .catch((error: unknown) => {
        // 残り回数が取れなくても質問はできるので、識別できない場合だけ知らせる
        if (toErrorCode(error) === 'unidentified') setErrorCode('unidentified');
      });
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, errorCode]);

  useEffect(() => {
    // スマートフォンでは急にキーボードが出ないよう、広い画面のときだけ入力欄にカーソルを置く
    if (isOpen && window.matchMedia('(min-width: 640px)').matches) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const isBlocked =
    errorCode === 'unidentified' ||
    errorCode === 'user_limit' ||
    errorCode === 'total_limit' ||
    usage?.remaining === 0;

  async function send(text: string) {
    const question = text.trim();
    if (!question || isSending || isBlocked) return;

    const history: ChatMessage[] = [
      ...messages,
      { role: 'user', content: question },
    ];
    setMessages(history);
    setInput('');
    setErrorCode(null);
    setIsSending(true);
    try {
      const result = await sendChatMessages(toRequestMessages(history));
      setMessages([...history, { role: 'assistant', content: result.reply }]);
      setUsage(result.usage);
    } catch (error) {
      setErrorCode(toErrorCode(error));
      if (error instanceof ChatApiError && error.usage) setUsage(error.usage);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter で送信、Shift+Enter で改行。日本語の変換中の Enter では送らない
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void send(input);
    }
  }

  function handleReset() {
    setMessages([]);
    if (errorCode === 'failed') setErrorCode(null);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-white shadow-lg transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        aria-label="サイト案内チャットを開く"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
        <span className="font-medium">質問する</span>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="サイト案内チャット"
      className="fixed inset-x-2 bottom-2 z-40 flex max-h-[85vh] flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-gray-900/10 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:h-[36rem] sm:w-96"
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white">
        <div>
          <h2 className="font-bold">サイト案内チャット</h2>
          <p className="text-xs text-blue-100">
            {usage
              ? `今日の残り ${usage.remaining} / ${usage.limit} 回`
              : 'ホームページの使い方をお答えします'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              disabled={isSending}
              className="rounded px-2 py-1 text-xs text-blue-100 hover:bg-blue-700 hover:text-white disabled:opacity-50"
            >
              最初から
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded p-1 hover:bg-blue-700"
            aria-label="チャットを閉じる"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 会話 */}
      <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              ホームページの使い方や、どのページに何が載っているかをお答えします。
              お知らせや資料の中身は、それぞれのページでご確認ください。
            </p>
            {!isBlocked && (
              <div className="space-y-2">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void send(question)}
                    disabled={isSending}
                    className="block w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === 'user'
                ? 'flex justify-end'
                : 'flex justify-start'
            }
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-900 ring-1 ring-gray-200'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-white px-3 py-2 text-sm text-gray-500 ring-1 ring-gray-200">
              考えています…
            </div>
          </div>
        )}

        {errorCode && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{ERROR_MESSAGES[errorCode]}</p>
            {errorCode === 'unidentified' && (
              <button
                type="button"
                onClick={() => void logout()}
                className="mt-2 rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700"
              >
                ログアウトする
              </button>
            )}
          </div>
        )}
        {!errorCode && usage?.remaining === 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            {ERROR_MESSAGES.user_limit}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力欄 */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-200 bg-white p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={CHAT_MAX_MESSAGE_LENGTH}
            rows={2}
            disabled={isBlocked}
            placeholder={
              isBlocked ? '今は質問できません' : '質問を入力（Enterで送信）'
            }
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            aria-label="質問"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending || isBlocked}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            送信
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          個人情報（住所・電話番号など）は入力しないでください
        </p>
      </form>
    </div>
  );
}
