'use client';

import { useEffect, useState, useMemo } from 'react';
import { Meeting } from '@/types/minutes';
import {
  fetchMeetings,
  fetchMeetingsYearMonths,
  YearMonth,
} from '@/shared/utils/kintone';
import { getToken } from '@/shared/utils/auth';
import { downloadFile as downloadFileUtil } from '@/shared/utils/fileDownload';
import FileDownloadButton from '@/components/shared/FileDownloadButton';
import FilePreviewModal from '@/components/shared/FilePreviewModal';

// 音声プレーヤーコンポーネント
function AudioPlayer({
  fileKey,
  fileName,
  hideDownloadButton = false,
}: {
  fileKey: string;
  fileName: string;
  hideDownloadButton?: boolean;
}) {
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // ユーザーが再生ボタンを押した時だけ音声ファイルを読み込む
  const handleLoadAudio = async () => {
    if (audioUrl || loading) return; // 既に読み込み済み、または読み込み中なら何もしない

    setLoading(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('認証トークンがありません');
      }

      const apiEndpoint =
        process.env.NEXT_PUBLIC_MINUTES_API_URL ||
        'https://miyosino-minutes.anorimura-miyosino.workers.dev';
      const url = `${apiEndpoint}/minutes/file?fileKey=${encodeURIComponent(fileKey)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
          }
          throw new Error('認証に失敗しました');
        }
        throw new Error('音声ファイルの取得に失敗しました');
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      setAudioUrl(blobUrl);
    } catch (err) {
      console.error('[AudioPlayer] loadAudio error:', err);
      setError(
        err instanceof Error
          ? err.message
          : '音声ファイルの読み込みに失敗しました'
      );
    } finally {
      setLoading(false);
    }
  };

  // 音声ファイルをダウンロード
  const handleDownload = async () => {
    if (downloading) return;

    setDownloading(true);
    try {
      await downloadFileUtil(fileKey, fileName, 'minutes');
    } catch (err) {
      console.error('[AudioPlayer] download error:', err);
      alert(
        err instanceof Error
          ? err.message
          : '音声ファイルのダウンロードに失敗しました'
      );
    } finally {
      setDownloading(false);
    }
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (audioUrl) {
        window.URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <div className="space-y-3">
      {/* ファイル名とダウンロードボタン（関連資料・議事録と同じスタイル） */}
      {!hideDownloadButton && (
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full text-left px-3 py-2 bg-white rounded-md border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-sm text-gray-700 group-hover:text-indigo-700 truncate">
            {downloading ? 'ダウンロード中...' : fileName}
          </span>
          {downloading ? (
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 flex-shrink-0 ml-2"></div>
          ) : (
            <svg
              className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 flex-shrink-0 ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          )}
        </button>
      )}

      {/* 再生コントロール */}
      {!audioUrl && !loading && !error && (
        <button
          onClick={handleLoadAudio}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm transition-colors flex items-center justify-center gap-3 border-2 border-blue-500"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          <span className="font-medium">音声プレーヤーを開く</span>
        </button>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 rounded-md">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600">読み込み中...</p>
        </div>
      )}

      {error && (
        <div className="space-y-2">
          <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button
            onClick={handleLoadAudio}
            className="w-full px-4 py-2.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm transition-colors"
          >
            再試行
          </button>
        </div>
      )}

      {audioUrl && (
        <div className="bg-white rounded-md border border-gray-200 p-3">
          <audio controls className="w-full" src={audioUrl} preload="none">
            お使いのブラウザは音声再生に対応していません。
          </audio>
        </div>
      )}
    </div>
  );
}

// 日時をフォーマットする関数
function formatDateTime(dateTimeString: string): {
  date: string;
  time: string;
} {
  const date = new Date(dateTimeString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return {
    date: `${year}年${month}月${day}日`,
    time: `${hours}:${minutes}`,
  };
}

export default function MinutesContent() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [yearMonths, setYearMonths] = useState<YearMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // 選択されたカテゴリ（全カテゴリは空文字列）
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const [previewFile, setPreviewFile] = useState<{
    fileKey: string;
    fileName: string;
  } | null>(null);

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
    meetings.forEach((meeting) => {
      if (meeting.category) {
        categorySet.add(meeting.category);
      }
    });
    return Array.from(categorySet).sort();
  }, [meetings]);

  // フィルタリングされた会議情報
  const filteredMeetings = useMemo(() => {
    return meetings.filter((meeting) => {
      // 年でフィルタリング
      if (selectedYear) {
        const meetingDate = new Date(meeting.StartDateTime);
        const meetingYear = meetingDate.getFullYear();
        if (meetingYear.toString() !== selectedYear) {
          return false;
        }
      }

      // 月でフィルタリング
      if (selectedMonth) {
        const meetingDate = new Date(meeting.StartDateTime);
        const meetingMonth = meetingDate.getMonth() + 1;
        if (meetingMonth.toString() !== selectedMonth) {
          return false;
        }
      }

      // カテゴリでフィルタリング
      if (selectedCategory && meeting.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [meetings, selectedYear, selectedMonth, selectedCategory]);

  // 年月一覧と会議情報一覧を取得
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [meetingsData, yearMonthsData] = await Promise.all([
          fetchMeetings(), // 全件取得
          fetchMeetingsYearMonths(),
        ]);

        // 現在の年月より未来の年月を除外
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const filteredYearMonths = yearMonthsData.filter((ym: YearMonth) => {
          if (ym.year > currentYear) {
            return false;
          }
          if (ym.year === currentYear && ym.month > currentMonth) {
            return false;
          }
          return true;
        });

        setMeetings(meetingsData);
        setYearMonths(filteredYearMonths);

        // デフォルトで現在月を選択（存在しない場合は最新の年月を選択）
        const currentYearMonth = getCurrentYearMonth();
        const hasCurrentMonth = filteredYearMonths.some(
          (ym: YearMonth) =>
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
        console.error('[MinutesContent] loadData error:', err);
        setError(
          err instanceof Error ? err.message : '会議情報の取得に失敗しました'
        );
        setMeetings([]);
        setYearMonths([]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

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
          endpoint="minutes"
          onClose={() => setPreviewFile(null)}
        />
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">会議一覧</h2>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* フィルタ（左側） */}
            {(yearMonths.length > 0 || categories.length > 0) && (
              <div className="lg:w-64 flex-shrink-0">
                <div className="bg-gray-50 rounded-lg p-4 sticky top-4 space-y-6">
                  {/* カテゴリフィルタ */}
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
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

                  {/* 年月フィルタ */}
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
                  )}
                </div>
              </div>
            )}

            {/* 会議情報一覧（右側） */}
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
              ) : filteredMeetings.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <p className="text-gray-500 text-sm">
                    {selectedYear && selectedMonth
                      ? `${selectedYear}年${selectedMonth}月の会議情報はありません。`
                      : '現在、会議情報はありません。'}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredMeetings.map((meeting) => {
                    const minutesTitleId = `minutes-title-${meeting.id}`;
                    const audioTitleId = `audio-title-${meeting.id}`;

                    return (
                      <div
                        key={meeting.id}
                        className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors"
                      >
                        <div className="mb-4">
                          {meeting.category && (
                            <div className="mb-2">
                              <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded">
                                {meeting.category}
                              </span>
                            </div>
                          )}
                          <h3 className="text-xl font-semibold text-gray-900">
                            {meeting.title}
                          </h3>
                        </div>

                        {/* 会議情報 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-gray-600 mb-1">日時</p>
                            <p className="text-gray-900 font-medium">
                              {formatDateTime(meeting.StartDateTime).date}{' '}
                              {formatDateTime(meeting.StartDateTime).time}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 mb-1">場所</p>
                            <p className="text-gray-900 font-medium">
                              {meeting.venue}
                            </p>
                          </div>
                        </div>

                        {/* 資料・議事録・音声ファイル */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="grid grid-cols-1 gap-4">
                            {/* 資料 */}
                            {meeting.materials &&
                              Array.isArray(meeting.materials) &&
                              meeting.materials.length > 0 && (
                                <div className="bg-gray-100 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <svg
                                      className="w-5 h-5 text-gray-600"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                      />
                                    </svg>
                                    <h4 className="text-sm font-semibold text-gray-700">
                                      資料
                                    </h4>
                                    <span className="text-xs text-gray-500">
                                      ({meeting.materials.length}件)
                                    </span>
                                  </div>
                                  <div className="space-y-2">
                                    {meeting.materials.map(
                                      (
                                        material: {
                                          fileKey: string;
                                          name: string;
                                          title?: string;
                                          size?: string;
                                        },
                                        index: number
                                      ) => {
                                        const materialTitleId = `material-title-${meeting.id}-${index}`;
                                        return (
                                          <div
                                            key={index}
                                            className="flex flex-col md:flex-row md:items-center md:justify-between rounded-md px-3 py-2 transition-colors hover:bg-gray-200 focus-within:bg-gray-200"
                                          >
                                            <h3
                                              id={materialTitleId}
                                              className="font-semibold text-gray-900 flex-1"
                                            >
                                              {material.title || material.name}
                                            </h3>
                                            <div className="flex gap-2 mt-4 md:mt-0 flex-shrink-0">
                                              <button
                                                onClick={() =>
                                                  setPreviewFile({
                                                    fileKey: material.fileKey,
                                                    fileName: material.name,
                                                  })
                                                }
                                                className="hidden md:block px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 transition-colors whitespace-nowrap"
                                              >
                                                閲覧
                                              </button>
                                              <div className="w-full md:w-48">
                                                <FileDownloadButton
                                                  fileKey={material.fileKey}
                                                  fileName={material.name}
                                                  endpoint="minutes"
                                                  fileSize={material.size}
                                                  ariaDescribedby={
                                                    materialTitleId
                                                  }
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      }
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* 議事録 */}
                            {meeting.minutes && (
                              <div className="bg-gray-100 rounded-lg p-4 transition-colors hover:bg-gray-200 focus-within:bg-gray-200">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                  <div className="flex items-center gap-2">
                                    <svg
                                      className="w-5 h-5 text-gray-600"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                      />
                                    </svg>
                                    <h4
                                      id={minutesTitleId}
                                      className="text-sm font-semibold text-gray-700"
                                    >
                                      議事録
                                    </h4>
                                  </div>
                                  <div className="flex gap-2 mt-4 md:mt-0 flex-shrink-0">
                                    <button
                                      onClick={() =>
                                        setPreviewFile({
                                          fileKey: meeting.minutes!.fileKey,
                                          fileName: meeting.minutes!.name,
                                        })
                                      }
                                      className="hidden md:block px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 transition-colors whitespace-nowrap"
                                    >
                                      閲覧
                                    </button>
                                    <div className="w-full md:w-48">
                                      <FileDownloadButton
                                        fileKey={meeting.minutes.fileKey}
                                        fileName={meeting.minutes.name}
                                        endpoint="minutes"
                                        fileSize={meeting.minutes.size}
                                        ariaDescribedby={minutesTitleId}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 音声ファイル */}
                            {meeting.audio && (
                              <div className="bg-gray-100 rounded-lg p-4 transition-colors hover:bg-gray-200 focus-within:bg-gray-200">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <svg
                                      className="w-5 h-5 text-gray-600"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                                      />
                                    </svg>
                                    <h4
                                      id={audioTitleId}
                                      className="text-sm font-semibold text-gray-700"
                                    >
                                      音声ファイル
                                    </h4>
                                  </div>
                                  <div className="w-full md:w-64 mt-4 md:mt-0">
                                    <FileDownloadButton
                                      fileKey={meeting.audio.fileKey}
                                      fileName={meeting.audio.name}
                                      endpoint="minutes"
                                      fileSize={meeting.audio.size}
                                      ariaDescribedby={audioTitleId}
                                    />
                                  </div>
                                </div>
                                <AudioPlayer
                                  fileKey={meeting.audio.fileKey}
                                  fileName={meeting.audio.name}
                                  hideDownloadButton={true}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
