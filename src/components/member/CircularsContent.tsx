'use client';

import { useEffect, useState, useMemo } from 'react';
import { Circular } from '@/types/circulars';
import {
  fetchCirculars,
  fetchCircularYearMonths,
  YearMonth,
} from '@/shared/utils/kintone';
import { getToken, redirectToLogin } from '@/shared/utils/auth';
import FileDownloadButton from '@/components/shared/FileDownloadButton';
import FilePreviewModal from '@/components/shared/FilePreviewModal';

// 日付をフォーマットする関数
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export default function CircularsContent() {
  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [yearMonths, setYearMonths] = useState<YearMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    fileKey: string;
    fileName: string;
    contentType?: string;
  } | null>(null);

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

  // 選択されたカテゴリ（全カテゴリは空文字列）
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // 年月一覧と資料一覧を取得
  useEffect(() => {
    async function loadData() {
      try {
        // トークンの確認
        const token = getToken();
        if (!token) {
          console.error(
            '[CircularsContent] No token found, redirecting to login'
          );
          redirectToLogin();
          return;
        }

        setLoading(true);
        setError(null);
        const [circularsData, yearMonthsData] = await Promise.all([
          fetchCirculars(),
          fetchCircularYearMonths(),
        ]);

        setCirculars(circularsData);
        setYearMonths(yearMonthsData);

        // デフォルトで現在月を選択（存在しない場合は最新の年月を選択）
        const currentYearMonth = getCurrentYearMonth();
        const hasCurrentMonth = yearMonthsData.some(
          (ym: YearMonth) =>
            ym.year === currentYearMonth.year &&
            ym.month === currentYearMonth.month
        );

        if (hasCurrentMonth) {
          setSelectedYear(currentYearMonth.year.toString());
          setSelectedMonth(currentYearMonth.month.toString());
        } else if (yearMonthsData.length > 0) {
          setSelectedYear(yearMonthsData[0].year.toString());
          setSelectedMonth(yearMonthsData[0].month.toString());
        }
      } catch (err) {
        console.error('[CircularsContent] loadData error:', err);

        // 認証エラーの場合はログインページへリダイレクト
        if (err instanceof Error) {
          if (err.message.includes('認証') || err.message.includes('401')) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('auth_token');
            }
            redirectToLogin();
            return;
          }
          setError(err.message);
        } else {
          setError('資料の取得に失敗しました');
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
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

  // カテゴリの一覧を取得
  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    circulars.forEach((circular) => {
      if (circular.category) {
        categorySet.add(circular.category);
      }
    });
    return Array.from(categorySet).sort();
  }, [circulars]);

  // フィルタリングされた資料一覧
  const filteredCirculars = useMemo(() => {
    return circulars.filter((circular) => {
      // 年でフィルタリング
      if (selectedYear) {
        const circularDate = new Date(circular.distributionDate);
        const circularYear = circularDate.getFullYear();
        if (circularYear.toString() !== selectedYear) {
          return false;
        }
      }

      // 月でフィルタリング
      if (selectedMonth) {
        const circularDate = new Date(circular.distributionDate);
        const circularMonth = circularDate.getMonth() + 1;
        if (circularMonth.toString() !== selectedMonth) {
          return false;
        }
      }

      // カテゴリでフィルタリング
      if (selectedCategory && circular.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [circulars, selectedYear, selectedMonth, selectedCategory]);

  // 年が変更されたら月をリセット
  useEffect(() => {
    if (selectedYear && months.length > 0) {
      // 選択された年に対応する月が存在する場合、最初の月を選択
      if (selectedMonth && !months.includes(Number.parseInt(selectedMonth))) {
        setSelectedMonth(months[0].toString());
      }
    } else {
      setSelectedMonth('');
    }
  }, [selectedYear, months, selectedMonth]);

  return (
    <>
      {previewFile && (
        <FilePreviewModal
          fileKey={previewFile.fileKey}
          fileName={previewFile.fileName}
          endpoint="circulars"
          contentType={previewFile.contentType}
          onClose={() => setPreviewFile(null)}
        />
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">資料一覧</h2>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* フィルタ（左側） */}
            {!loading &&
              !error &&
              (categories.length > 0 || years.length > 0) && (
                <div className="lg:w-64 flex-shrink-0">
                  <div className="bg-gray-50 rounded-lg p-4 sticky top-4 space-y-6">
                    {/* カテゴリフィルタ（上） */}
                    {categories.length > 0 && (
                      <div>
                        <label
                          htmlFor="category-filter"
                          className="text-sm font-semibold text-gray-700 mb-2 block"
                        >
                          カテゴリで絞り込み
                        </label>
                        <select
                          id="category-filter"
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        >
                          <option value="">すべて</option>
                          {categories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* 年月フィルタ（下） */}
                    {years.length > 0 && (
                      <div>
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
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                                onChange={(e) =>
                                  setSelectedMonth(e.target.value)
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                    )}
                  </div>
                </div>
              )}

            {/* 資料一覧（右側） */}
            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mb-4"></div>
                  <p className="text-gray-500 text-sm">読み込み中...</p>
                </div>
              ) : error ? (
                <div className="bg-red-50 rounded-lg p-8 text-center">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              ) : filteredCirculars.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <p className="text-gray-500 text-sm">
                    該当する資料がありません
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredCirculars.map((circular) => (
                    <div
                      key={circular.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      {/* 一列目: カテゴリ、配布日、配布元 */}
                      <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
                        {circular.category && (
                          <span className="px-2 py-1 bg-teal-100 text-teal-800 text-xs rounded whitespace-nowrap">
                            {circular.category}
                          </span>
                        )}
                        <span>
                          配布日: {formatDate(circular.distributionDate)}
                        </span>
                        <span>配布元: {circular.distributor}</span>
                      </div>

                      {/* 二列目: タイトルとダウンロードボタン */}
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                        <h3 className="font-semibold text-gray-900 flex-1">
                          {circular.title}
                        </h3>
                        {circular.file?.fileKey ? (
                          <div className="flex gap-2 mt-4 md:mt-0 md:ml-4 flex-shrink-0">
                            <button
                              onClick={() =>
                                setPreviewFile({
                                  fileKey: circular.file!.fileKey!,
                                  fileName: circular.file!.name || 'ファイル',
                                  contentType: circular.file!.contentType,
                                })
                              }
                              className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white text-sm rounded-md hover:bg-teal-700 transition-colors whitespace-nowrap"
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
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                              閲覧
                            </button>
                            <div className="w-56">
                              <FileDownloadButton
                                fileKey={circular.file.fileKey}
                                fileName={circular.file.name || 'download'}
                                endpoint="circulars"
                                fileSize={
                                  circular.file.size
                                    ? circular.file.size.toString()
                                    : undefined
                                }
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
