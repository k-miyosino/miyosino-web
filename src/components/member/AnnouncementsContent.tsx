'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Announcement,
  getPriorityBorderColor,
  getPriorityBadgeStyle,
  getPriorityText,
} from './data';
import { fetchAnnouncements, fetchYearMonths } from '@/shared/utils/kintone';
import { redirectToLogin } from '@/shared/utils/auth';
import AnnouncementModal from './AnnouncementModal';
import { useMonthForYear } from './useMonthForYear';

interface AnnouncementsContentProps {
  announcements?: Announcement[];
}

interface YearMonth {
  year: number;
  month: number;
}

export default function AnnouncementsContent({
  announcements: propAnnouncements,
}: AnnouncementsContentProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [yearMonths, setYearMonths] = useState<YearMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 日付をフォーマットする関数
  const formatDate = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${year}年${month}月${day}日`;
  };

  // 年月をフォーマットする関数
  const formatYearMonth = (year: number, month: number) => {
    return `${year}年${month}月`;
  };

  // 現在月を取得
  const getCurrentYearMonth = (): YearMonth => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    };
  };

  // 選択された年（全期間は空文字列）
  const [selectedYear, setSelectedYear] = useState<string>('');

  // 選択された月（全月は空文字列）
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // モーダル用の状態
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 初期表示時に年月一覧を取得
  useEffect(() => {
    const loadYearMonths = async () => {
      try {
        setLoading(true);
        const yearMonthsData = await fetchYearMonths();

        // 未来の年月を除外（念のためフロントエンド側でもフィルタリング）
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const filteredYearMonths = yearMonthsData.filter((ym) => {
          // 現在の年月より未来の年月を除外
          if (ym.year > currentYear) {
            return false;
          }
          if (ym.year === currentYear && ym.month > currentMonth) {
            return false;
          }
          return true;
        });

        setYearMonths(filteredYearMonths);

        // デフォルトで現在月を選択（存在しない場合は最新の年月を選択）
        const currentYearMonth = getCurrentYearMonth();
        const hasCurrentMonth = filteredYearMonths.some(
          (ym) =>
            ym.year === currentYearMonth.year &&
            ym.month === currentYearMonth.month
        );

        if (hasCurrentMonth) {
          setSelectedYear(currentYearMonth.year.toString());
          setSelectedMonth(currentYearMonth.month.toString());
        } else if (filteredYearMonths.length > 0) {
          setSelectedYear(filteredYearMonths[0].year.toString());
          setSelectedMonth(filteredYearMonths[0].month.toString());
        }
      } catch (err) {
        console.error(
          '[AnnouncementsContent] Failed to load year months:',
          err
        );

        // 認証エラーの場合は即座にログインにリダイレクト
        if (err instanceof Error && err.message.includes('認証')) {
          // トークンを削除してからリダイレクト
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
          }
          redirectToLogin();
          return;
        }
        setError('年月一覧の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadYearMonths();
  }, []);

  // 年と月の一覧を取得
  const years = useMemo(() => {
    const yearSet = new Set<number>();
    yearMonths.forEach((ym) => {
      yearSet.add(ym.year);
    });
    return Array.from(yearSet).sort((a, b) => b - a); // 新しい順
  }, [yearMonths]);

  const months = useMemo(() => {
    if (!selectedYear) return [];
    const monthSet = new Set<number>();
    yearMonths
      .filter((ym) => ym.year.toString() === selectedYear)
      .forEach((ym) => {
        monthSet.add(ym.month);
      });
    return Array.from(monthSet).sort((a, b) => b - a); // 新しい順
  }, [yearMonths, selectedYear]);

  // 選択された年月が変更されたらデータを取得
  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        setLoading(true);
        setError(null);

        // 年と月の両方が選択されている場合は年月で絞り込み、それ以外は全データを取得
        let data: Announcement[];
        if (selectedYear && selectedMonth) {
          data = await fetchAnnouncements(
            parseInt(selectedYear),
            parseInt(selectedMonth)
          );
        } else {
          // 「すべて」が選択されている場合は全データを取得
          data = await fetchAnnouncements();
        }

        setAnnouncements(data);
      } catch (err) {
        console.error(
          '[AnnouncementsContent] Failed to load announcements:',
          err
        );

        // 認証エラーの場合は即座にログインにリダイレクト
        if (err instanceof Error && err.message.includes('認証')) {
          // トークンを削除してからリダイレクト
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
          }
          redirectToLogin();
          return;
        }
        setError(
          err instanceof Error ? err.message : 'お知らせの取得に失敗しました'
        );
        setAnnouncements([]);
      } finally {
        setLoading(false);
      }
    };

    loadAnnouncements();
  }, [selectedYear, selectedMonth]);

  // 年が変わって、その年にない月が選ばれていたら月を直す
  useMonthForYear(selectedYear, months, selectedMonth, setSelectedMonth);

  // 選択された年月のお知らせをフィルタリング（未来の日付と「準備中」を除外）してソート
  const filteredAnnouncements = useMemo(() => {
    const now = new Date();
    // 現在日時より未来の日付のお知らせと「準備中」のお知らせを除外
    return [...announcements]
      .filter((announcement) => {
        // 「公開」のみを表示対象とする（念のためフロントエンド側でもフィルタリング）
        if (announcement.publish && announcement.publish !== '公開') {
          return false;
        }

        const announcementDate = new Date(announcement.date);
        // 日付のみを比較（時刻は無視）
        announcementDate.setHours(0, 0, 0, 0);
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        return announcementDate <= today;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA; // 新しい順
      });
  }, [announcements]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <svg
            className="w-6 h-6 text-blue-600 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
            />
          </svg>
          お知らせ一覧
        </h2>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* フィルタ（左側） */}
          {!loading && !error && years.length > 0 && (
            <div className="lg:w-64 flex-shrink-0">
              <div className="bg-gray-50 rounded-lg p-4 sticky top-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  年月で絞り込み
                </h3>
                <div className="space-y-3">
                  {/* 年フィルター */}
                  <div>
                    <label
                      htmlFor="year-filter"
                      className="text-sm text-gray-700 mb-1 block"
                    >
                      年
                    </label>
                    <select
                      id="year-filter"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">すべて</option>
                      {years.map((year) => (
                        <option key={year} value={year.toString()}>
                          {year}年
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 月フィルター（年が選択されている場合のみ表示） */}
                  {selectedYear && (
                    <div>
                      <label
                        htmlFor="month-filter"
                        className="text-sm text-gray-700 mb-1 block"
                      >
                        月
                      </label>
                      <select
                        id="month-filter"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">すべて</option>
                        {months.map((month) => (
                          <option key={month} value={month.toString()}>
                            {month}月
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* お知らせ一覧（右側） */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-500 text-sm">読み込み中...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 rounded-lg p-8 text-center">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            ) : filteredAnnouncements.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-500 text-sm">
                  {selectedYear && selectedMonth
                    ? `${formatYearMonth(parseInt(selectedYear), parseInt(selectedMonth))}のお知らせはありません。`
                    : '現在、お知らせはありません。'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAnnouncements.map((announcement) => (
                  <button
                    key={announcement.id}
                    onClick={() => {
                      setSelectedAnnouncement(announcement);
                      setIsModalOpen(true);
                    }}
                    className={`w-full text-left border-l-4 ${getPriorityBorderColor(announcement.importance)} pl-4 py-3 bg-gray-50 rounded-r-lg hover:bg-gray-100 transition-colors cursor-pointer`}
                  >
                    <div className="mb-2">
                      <span
                        className={`px-2 py-1 ${getPriorityBadgeStyle(announcement.importance)} text-xs rounded whitespace-nowrap`}
                      >
                        {getPriorityText(announcement.importance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900">
                        {announcement.title}
                      </h3>
                      <span className="text-gray-500 text-xs">
                        {formatDate(announcement.date)}
                      </span>
                    </div>
                    {announcement.attachment &&
                      announcement.attachment.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">
                            添付ファイル: {announcement.attachment.length}件
                          </p>
                        </div>
                      )}
                    <div className="mt-2 text-xs text-blue-600">
                      クリックして詳細を表示
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* モーダル */}
      <AnnouncementModal
        announcement={selectedAnnouncement}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedAnnouncement(null);
        }}
      />
    </div>
  );
}
