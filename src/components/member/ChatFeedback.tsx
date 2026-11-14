'use client';

import Link from 'next/link';
import { ChatRating } from '@/types/chat';

const RATING_OPTIONS: readonly { rating: ChatRating; label: string }[] = [
  { rating: 'understood', label: 'わかった' },
  { rating: 'partly', label: '少しわかった' },
  { rating: 'not', label: 'わからなかった' },
];

interface ChatFeedbackProps {
  /** すでに付けた評価（あれば、ボタンの代わりにお礼を出す） */
  rating?: ChatRating;
  onRate: (rating: ChatRating) => void;
  /** 「わからなかった」の案内のリンクを押したとき */
  onNavigate?: () => void;
}

/**
 * 最新の答えの下に出す評価のボタン（押さなくても次の質問はできる）。
 * 「わからなかった」を選んだ人には、事務所とお問い合わせページを案内する。
 */
export default function ChatFeedback({
  rating,
  onRate,
  onNavigate,
}: Readonly<ChatFeedbackProps>) {
  if (rating === 'not') {
    return (
      <p className="mt-1 text-xs text-gray-600">
        管理組合事務所か、
        <Link
          href="/contact"
          onClick={onNavigate}
          className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
        >
          お問い合わせページ
        </Link>
        でもご案内しています。
      </p>
    );
  }
  if (rating) {
    return (
      <p className="mt-1 text-xs text-gray-500">
        教えていただき、ありがとうございます。
      </p>
    );
  }
  return (
    <div className="mt-1" role="group" aria-label="この答えはわかりましたか">
      <p className="mb-1 text-xs text-gray-500">この答えはわかりましたか？</p>
      <div className="flex flex-wrap gap-1">
        {RATING_OPTIONS.map((option) => (
          <button
            key={option.rating}
            type="button"
            onClick={() => onRate(option.rating)}
            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:border-blue-400 hover:bg-blue-50"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
