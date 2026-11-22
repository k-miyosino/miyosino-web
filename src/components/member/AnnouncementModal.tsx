'use client';

import { useModalTransition } from './useModalTransition';
import {
  Announcement,
  getPriorityBorderColor,
  getPriorityBadgeStyle,
  getPriorityText,
} from './data';

interface AnnouncementModalProps {
  announcement: Announcement | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AnnouncementModal({
  announcement,
  isOpen,
  onClose,
}: AnnouncementModalProps) {
  // アニメーション用の状態（閉じる時のアニメーションを完了させるため）
  // ESC キーで閉じる・背景のスクロールを止めることも、このフックで行う
  const { shouldRender, isVisible } = useModalTransition(
    isOpen && announcement !== null,
    isOpen,
    onClose
  );

  if (!announcement || !shouldRender) {
    return null;
  }

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${year}年${month}月${day}日`;
  };

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
        className={`relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border-l-4 ${getPriorityBorderColor(announcement.importance)} transition-all duration-300 ease-in-out ${
          isVisible
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex-1">
            <div className="mb-2">
              <span
                className={`px-2 py-1 ${getPriorityBadgeStyle(announcement.importance)} text-xs rounded whitespace-nowrap`}
              >
                {getPriorityText(announcement.importance)}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {announcement.title}
            </h2>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{formatDate(announcement.date)}</span>
              {announcement.destination && (
                <span className="text-gray-400">
                  通知先: {announcement.destination}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
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

        {/* 本文 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div
            className="prose prose-sm max-w-none [&_*]:text-gray-900 [&_a]:text-blue-600 [&_a]:underline [&_a]:font-medium"
            dangerouslySetInnerHTML={{ __html: announcement.description }}
          />
        </div>

        {/* 添付ファイル */}
        {announcement.attachment && announcement.attachment.length > 0 && (
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              添付ファイル
            </h3>
            <div className="space-y-2">
              {announcement.attachment.map((file, index) => {
                // プロキシエンドポイントのURLを構築
                const announcementsApiUrl =
                  process.env.NEXT_PUBLIC_ANNOUNCEMENTS_API_URL ||
                  'https://miyosino-announcements.anorimura-miyosino.workers.dev';
                const fileUrl = file.fileKey
                  ? `${announcementsApiUrl}/announcements/file?fileKey=${encodeURIComponent(file.fileKey)}`
                  : file.url || '#';

                return (
                  <a
                    key={index}
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 underline"
                    onClick={async (e) => {
                      // ファイルキーがある場合は、認証トークンを付与してダウンロード
                      if (file.fileKey) {
                        e.preventDefault();
                        const token = localStorage.getItem('auth_token');
                        if (!token) {
                          alert('認証が必要です');
                          return;
                        }

                        try {
                          const response = await fetch(fileUrl, {
                            headers: {
                              Authorization: `Bearer ${token}`,
                            },
                          });

                          if (!response.ok) {
                            throw new Error(
                              'ファイルのダウンロードに失敗しました'
                            );
                          }

                          // ファイルをダウンロード
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = file.name;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                        } catch (error) {
                          console.error('File download error:', error);
                          alert('ファイルのダウンロードに失敗しました');
                        }
                      }
                    }}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                      />
                    </svg>
                    {file.name}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* フッター */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
