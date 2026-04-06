'use client';

import { useEffect, useState } from 'react';
import { Event } from '@/types/events';
import { ColorScheme, DEFAULT_COLOR } from './colorSchemes';

interface EventModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  categoryColorMap?: Record<string, ColorScheme>;
}

export default function EventModal({
  event,
  isOpen,
  onClose,
  categoryColorMap,
}: EventModalProps) {
  // アニメーション用の状態（閉じる時のアニメーションを完了させるため）
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // モーダルの開閉アニメーション制御
  useEffect(() => {
    if (isOpen && event) {
      // モーダルを表示
      setShouldRender(true);
      // DOMの更新を待ってからアニメーションを開始
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 10);
      return () => clearTimeout(timer);
    } else if (!isOpen) {
      // 閉じる時はアニメーションを開始
      setIsVisible(false);
      // アニメーション完了後にDOMから削除
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // duration-300に合わせる
      return () => clearTimeout(timer);
    }
  }, [isOpen, event]);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    // モーダルが開いている時は背景のスクロールを無効化
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // モーダルが閉じられた時にスクロールを復元
  useEffect(() => {
    if (!isOpen) {
      // アニメーション完了後にスクロールを復元
      const timer = setTimeout(() => {
        document.body.style.overflow = 'unset';
      }, 300); // duration-300に合わせる
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 日時から時間のみを取得する関数（00:00の場合は空文字列を返す）
  const formatTime = (dateTimeString: string): string => {
    const date = new Date(dateTimeString);
    const hours = date.getHours();
    const minutes = date.getMinutes();

    // 時刻が00:00の場合は空文字列を返す
    if (hours === 0 && minutes === 0) {
      return '';
    }

    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    return `${hoursStr}:${minutesStr}`;
  };

  // 日付のみを返す関数（時刻なし）
  const formatDateOnly = (dateTimeString: string): string => {
    const date = new Date(dateTimeString);
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];
    return `${year}年${month}月${day}日（${weekday}）`;
  };

  // 年を省略した日付のみを返す関数（時刻なし）
  const formatDateOnlyWithoutYear = (
    dateTimeString: string,
    startYear: number
  ): string => {
    const date = new Date(dateTimeString);
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];

    // 年が同じなら年を省略
    if (year === startYear) {
      return `${month}月${day}日（${weekday}）`;
    }
    // 年が異なる場合は年を含める
    return `${year}年${month}月${day}日（${weekday}）`;
  };

  // 日付と時間を統合した表示を生成する関数
  const formatEventDateTime = (event: Event): string => {
    const startDate = new Date(event.startDateTime);
    const startTime = formatTime(event.startDateTime); // 00:00の場合は空文字列
    const startDateStr = formatDateOnly(event.startDateTime); // 日付のみ（時刻なし）

    // 終了日時なし
    if (!event.endDateTime) {
      return startTime ? `${startDateStr} ${startTime}` : startDateStr;
    }

    const endDate = new Date(event.endDateTime);
    const endTime = formatTime(event.endDateTime);
    const startDateOnly = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate()
    );
    const endDateOnly = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate()
    );

    // 同じ日付
    if (startDateOnly.getTime() === endDateOnly.getTime()) {
      if (!startTime && !endTime) return startDateStr;
      if (!startTime) return `${startDateStr} ～${endTime}`;
      if (!endTime) return `${startDateStr} ${startTime}～`;
      return `${startDateStr} ${startTime}～${endTime}`;
    }

    // 異なる日付
    const endDateStr = formatDateOnlyWithoutYear(
      event.endDateTime,
      startDate.getFullYear()
    );
    if (!startTime && !endTime) return `${startDateStr} ～ ${endDateStr}`;
    if (!startTime) return `${startDateStr} ～ ${endDateStr} ${endTime}`;
    if (!endTime) return `${startDateStr} ${startTime} ～ ${endDateStr}`;
    return `${startDateStr} ${startTime} ～ ${endDateStr} ${endTime}`;
  };

  if (!event || !shouldRender) {
    return null;
  }

  // 今後のイベントかどうかを判定
  const isUpcoming = new Date(event.startDateTime) >= new Date();
  const categoryColor = event.category
    ? categoryColorMap?.[event.category] || DEFAULT_COLOR
    : DEFAULT_COLOR;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      {/* 背景オーバーレイ */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ease-in-out ${
          isVisible ? 'opacity-50' : 'opacity-0'
        }`}
      />

      {/* モーダルコンテンツ */}
      <div
        className={`relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border-l-4 transition-all duration-300 ease-in-out ${
          isUpcoming ? 'border-purple-500' : 'border-gray-300'
        } ${
          isVisible
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex-1">
            <div className="text-base font-semibold text-gray-900 mb-3">
              {formatEventDateTime(event)}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{event.title}</h2>
          </div>
          <div className="flex items-start gap-2 ml-4">
            {event.category && (
              <span
                className={`px-2 py-1 text-xs rounded whitespace-nowrap ${categoryColor.bg} ${categoryColor.text}`}
              >
                {event.category}
              </span>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="閉じる"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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

        {/* 本文 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* イベント情報 */}
          <div className="mb-6 space-y-3">
            {event.venue && (
              <div>
                <p className="text-sm text-gray-600 mb-1">場所</p>
                <p className="text-gray-900 font-medium">{event.venue}</p>
              </div>
            )}
            {event.owner && (
              <div>
                <p className="text-sm text-gray-600 mb-1">主催</p>
                <p className="text-gray-900 font-medium">{event.owner}</p>
              </div>
            )}
          </div>

          {/* 説明 */}
          {event.description && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">説明</h3>
              <div
                className="prose prose-sm max-w-none [&_*]:text-gray-900 [&_a]:text-blue-600 [&_a]:underline [&_a]:font-medium"
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
