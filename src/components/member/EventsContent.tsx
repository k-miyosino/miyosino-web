'use client';

import { useMemo, useState, useEffect } from 'react';
import { Event } from '@/types/events';
import EventModal from './EventModal';
import {
  ColorScheme,
  COLOR_SCHEMES,
  DEFAULT_COLOR,
  getCategoryColor,
} from './colorSchemes';
import { useMonthForYear } from './useMonthForYear';

interface EventsContentProps {
  upcomingEvents?: Event[];
  pastEvents?: Event[];
}

// 日時をフォーマットする関数
function formatDateTime(dateTimeString: string): string {
  const date = new Date(dateTimeString);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  const hours = date.getHours();
  const minutes = date.getMinutes();

  // 時刻が00:00の場合は時刻部分を省略
  if (hours === 0 && minutes === 0) {
    return `${year}年${month}月${day}日（${weekday}）`;
  }

  const hoursStr = hours.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  return `${year}年${month}月${day}日（${weekday}） ${hoursStr}:${minutesStr}`;
}

// 日時から時間のみを取得する関数（00:00の場合は空文字列を返す）
function formatTime(dateTimeString: string): string {
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
}

// 日時をフォーマットする関数（年を省略可能）
function formatDateTimeWithoutYear(dateTimeString: string): string {
  const date = new Date(dateTimeString);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  const hours = date.getHours();
  const minutes = date.getMinutes();

  // 時刻が00:00の場合は時刻部分を省略
  if (hours === 0 && minutes === 0) {
    return `${month}月${day}日（${weekday}）`;
  }

  const hoursStr = hours.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  return `${month}月${day}日（${weekday}） ${hoursStr}:${minutesStr}`;
}

// 日付のみを返す関数（時刻なし）
function formatDateOnly(dateTimeString: string): string {
  const date = new Date(dateTimeString);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  return `${year}年${month}月${day}日（${weekday}）`;
}

// 年を省略した日付のみを返す関数（時刻なし）
function formatDateOnlyWithoutYear(
  dateTimeString: string,
  startYear: number
): string {
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
}

// 日付と時間を統合した表示を生成する関数
function formatEventDateTime(event: Event): string {
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
}

// イベントの位置（開始日・中間日・終了日）を判定する関数
function getEventPosition(
  event: Event,
  currentDate: Date
): 'start' | 'middle' | 'end' | 'single' {
  const startDate = new Date(event.startDateTime);
  const startDateOnly = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const currentDateOnly = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  );

  // 終了日時がない場合は単一日
  if (!event.endDateTime) {
    return startDateOnly.getTime() === currentDateOnly.getTime()
      ? 'single'
      : 'middle';
  }

  const endDate = new Date(event.endDateTime);
  const endDateOnly = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  // 開始日と終了日が同じ場合は単一日
  if (startDateOnly.getTime() === endDateOnly.getTime()) {
    return 'single';
  }

  // 現在の日付が開始日の場合
  if (startDateOnly.getTime() === currentDateOnly.getTime()) {
    return 'start';
  }

  // 現在の日付が終了日の場合
  if (endDateOnly.getTime() === currentDateOnly.getTime()) {
    return 'end';
  }

  // それ以外は中間日
  return 'middle';
}

// 期間表示を生成する関数（後方互換性のため残す）
function formatEventPeriod(event: Event): { label: string; value: string } {
  const startDate = new Date(event.startDateTime);

  // 終了日時が空の場合
  if (!event.endDateTime) {
    const startTime = formatTime(event.startDateTime);
    // 時刻が00:00の場合は表示しない
    if (!startTime) {
      return {
        label: '',
        value: '',
      };
    }
    return {
      label: '開始時刻',
      value: startTime,
    };
  }

  const endDate = new Date(event.endDateTime);
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

  // 開始日時と終了日時が同じ日付の場合
  if (startDateOnly.getTime() === endDateOnly.getTime()) {
    const startTime = formatTime(event.startDateTime);
    const endTime = formatTime(event.endDateTime);

    // 両方とも00:00の場合は表示しない
    if (!startTime && !endTime) {
      return {
        label: '',
        value: '',
      };
    }

    // 開始時刻のみ00:00の場合
    if (!startTime) {
      return {
        label: '終了時刻',
        value: endTime,
      };
    }

    // 終了時刻のみ00:00の場合
    if (!endTime) {
      return {
        label: '開始時刻',
        value: startTime,
      };
    }

    return {
      label: '時間',
      value: `${startTime}～${endTime}`,
    };
  }

  // 開始日時より終了日時が後日の場合
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  if (startYear === endYear) {
    // 年が同じなら終了日時の年を省略
    return {
      label: '期間',
      value: `${formatDateTime(event.startDateTime)}～${formatDateTimeWithoutYear(event.endDateTime)}`,
    };
  } else {
    // 年が異なる場合は両方に年を含める
    return {
      label: '期間',
      value: `${formatDateTime(event.startDateTime)}～${formatDateTime(event.endDateTime)}`,
    };
  }
}

// 過去のイベントを一度に表示する件数（「さらに表示」で増やす件数も同じ）
const PAST_EVENTS_PAGE_SIZE = 10;

export default function EventsContent({
  upcomingEvents = [],
  pastEvents = [],
}: EventsContentProps) {
  // タブの状態（'list' | 'calendar'）
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');

  // モーダルの状態
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // カレンダー表示用の現在の年月
  const [calendarYear, setCalendarYear] = useState<number>(
    new Date().getFullYear()
  );
  const [calendarMonth, setCalendarMonth] = useState<number>(
    new Date().getMonth() + 1
  );

  // 年月選択UIの表示状態
  const [showYearMonthPicker, setShowYearMonthPicker] = useState(false);

  // イベントをクリックしたときのハンドラ
  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  // モーダルを閉じる
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  // すべてのイベントを結合
  const allEvents = useMemo(() => {
    return [...upcomingEvents, ...pastEvents];
  }, [upcomingEvents, pastEvents]);

  // 選択された年（全期間は空文字列）
  const [selectedYear, setSelectedYear] = useState<string>('');

  // 選択された月（全月は空文字列）
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // 選択されたカテゴリ（全カテゴリは空文字列）
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // 選択された主催者（全主催者は空文字列）
  const [selectedOwner, setSelectedOwner] = useState<string>('');

  // 過去のイベントの表示件数制限（どの絞り込みのときに増やしたかといっしょに持つ）
  const [pastEventsLimitState, setPastEventsLimitState] = useState({
    filterKey: '',
    limit: PAST_EVENTS_PAGE_SIZE,
  });

  // 年と月の一覧を取得
  const years = useMemo(() => {
    const yearSet = new Set<number>();
    allEvents.forEach((event) => {
      const eventDate = new Date(event.startDateTime);
      yearSet.add(eventDate.getFullYear());
    });
    return Array.from(yearSet).sort((a, b) => b - a); // 新しい順
  }, [allEvents]);

  const months = useMemo(() => {
    if (!selectedYear) return [];
    const monthSet = new Set<number>();
    allEvents
      .filter((event) => {
        const eventDate = new Date(event.startDateTime);
        return eventDate.getFullYear().toString() === selectedYear;
      })
      .forEach((event) => {
        const eventDate = new Date(event.startDateTime);
        monthSet.add(eventDate.getMonth() + 1);
      });
    return Array.from(monthSet).sort((a, b) => b - a); // 新しい順
  }, [allEvents, selectedYear]);

  // カテゴリの一覧を取得
  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    allEvents.forEach((event) => {
      if (event.category) {
        categorySet.add(event.category);
      }
    });
    return Array.from(categorySet).sort();
  }, [allEvents]);

  // 主催者の一覧を取得
  const owners = useMemo(() => {
    const ownerSet = new Set<string>();
    allEvents.forEach((event) => {
      if (event.owner) {
        ownerSet.add(event.owner);
      }
    });
    return Array.from(ownerSet).sort();
  }, [allEvents]);

  // カテゴリごとの色を決定（カテゴリ数が配色数を超えたら循環）
  const categoryColorMap = useMemo(() => {
    const map: Record<string, ColorScheme> = {};
    categories.forEach((category, index) => {
      map[category] = COLOR_SCHEMES[index % COLOR_SCHEMES.length];
    });
    return map;
  }, [categories]);

  // フィルタリングされたイベント
  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      // 年でフィルタリング
      if (selectedYear) {
        const eventDate = new Date(event.startDateTime);
        const eventYear = eventDate.getFullYear();
        if (eventYear.toString() !== selectedYear) {
          return false;
        }
      }

      // 月でフィルタリング
      if (selectedMonth) {
        const eventDate = new Date(event.startDateTime);
        const eventMonth = eventDate.getMonth() + 1;
        if (eventMonth.toString() !== selectedMonth) {
          return false;
        }
      }

      // カテゴリでフィルタリング
      if (selectedCategory && event.category !== selectedCategory) {
        return false;
      }

      // 主催者でフィルタリング
      if (selectedOwner && event.owner !== selectedOwner) {
        return false;
      }

      return true;
    });
  }, [allEvents, selectedYear, selectedMonth, selectedCategory, selectedOwner]);

  // フィルタリングされたイベントを今後のイベントと過去のイベントに分離
  const filteredUpcomingEvents = useMemo(() => {
    const now = new Date();
    return filteredEvents
      .filter((event) => {
        const eventDate = new Date(event.startDateTime);
        return eventDate >= now;
      })
      .sort((a, b) => {
        const dateA = new Date(a.startDateTime);
        const dateB = new Date(b.startDateTime);
        return dateA.getTime() - dateB.getTime();
      });
  }, [filteredEvents]);

  const filteredPastEvents = useMemo(() => {
    const now = new Date();
    return filteredEvents
      .filter((event) => {
        const eventDate = new Date(event.startDateTime);
        return eventDate < now;
      })
      .sort((a, b) => {
        const dateA = new Date(a.startDateTime);
        const dateB = new Date(b.startDateTime);
        return dateB.getTime() - dateA.getTime();
      });
  }, [filteredEvents]);

  // 年が変わって、その年にない月が選ばれていたら月を直す
  useMonthForYear(selectedYear, months, selectedMonth, setSelectedMonth);

  // 絞り込みが変わったら、過去のイベントの表示件数を最初の件数に戻す
  // （増やしたときの絞り込みと今の絞り込みが違えば、最初の件数として計算する）
  const filterKey = [
    selectedYear,
    selectedMonth,
    selectedCategory,
    selectedOwner,
  ].join('\u0000');
  const pastEventsDisplayLimit =
    pastEventsLimitState.filterKey === filterKey
      ? pastEventsLimitState.limit
      : PAST_EVENTS_PAGE_SIZE;

  // カレンダー用: 日付をキーとしてイベントをグループ化
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, Event[]> = {};
    filteredEvents.forEach((event) => {
      const startDate = new Date(event.startDateTime);
      const startDateOnly = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
      );

      // 終了日時がない場合は開始日のみ
      if (!event.endDateTime) {
        const dateKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(event);
        return;
      }

      // 終了日時がある場合は開始日から終了日までのすべての日付に追加
      const endDate = new Date(event.endDateTime);
      const endDateOnly = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate()
      );

      // 開始日から終了日まで1日ずつループ
      const currentDate = new Date(startDateOnly);
      while (currentDate <= endDateOnly) {
        const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(event);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    return grouped;
  }, [filteredEvents]);

  // カレンダー用: 指定された年月のカレンダーグリッドを生成
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth - 1, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // 週の最初の日（日曜日）

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      events: Event[];
    }> = [];

    const currentDate = new Date(startDate);
    for (let i = 0; i < 42; i++) {
      // 6週間分
      const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      days.push({
        date: new Date(currentDate),
        isCurrentMonth:
          currentDate.getMonth() === calendarMonth - 1 &&
          currentDate.getFullYear() === calendarYear,
        events: eventsByDate[dateKey] || [],
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  }, [calendarYear, calendarMonth, eventsByDate]);

  // カレンダーの前月・次月に移動
  const goToPreviousMonth = () => {
    if (calendarMonth === 1) {
      setCalendarYear(calendarYear - 1);
      setCalendarMonth(12);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarYear(calendarYear + 1);
      setCalendarMonth(1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  // カレンダーの前年・次年に移動
  const goToPreviousYear = () => {
    setCalendarYear(calendarYear - 1);
  };

  const goToNextYear = () => {
    setCalendarYear(calendarYear + 1);
  };

  // カレンダー用の年と月の一覧を取得（イベントが存在する年月の範囲）
  const calendarYears = useMemo(() => {
    if (allEvents.length === 0) {
      // イベントがない場合は現在年から前後5年
      const currentYear = new Date().getFullYear();
      return Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
    }
    const yearSet = new Set<number>();
    allEvents.forEach((event) => {
      const eventDate = new Date(event.startDateTime);
      yearSet.add(eventDate.getFullYear());
    });
    const yearList = Array.from(yearSet).sort((a, b) => b - a);
    // 最小年から最大年まで、前後1年分を追加
    if (yearList.length > 0) {
      const minYear = Math.min(...yearList);
      const maxYear = Math.max(...yearList);
      const years: number[] = [];
      for (let y = minYear - 1; y <= maxYear + 1; y++) {
        years.push(y);
      }
      return years.sort((a, b) => b - a);
    }
    return [new Date().getFullYear()];
  }, [allEvents]);

  const calendarMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {activeTab === 'list' ? 'イベント一覧' : 'イベントカレンダー'}
          </h2>
          {/* タブ切り替え */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'list'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              一覧
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'calendar'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              カレンダー
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* フィルタ（左側） - 一覧表示時のみ表示 */}
          {activeTab === 'list' &&
            (categories.length > 0 ||
              years.length > 0 ||
              owners.length > 0) && (
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
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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

                  {/* 主催者フィルタ */}
                  {owners.length > 0 && (
                    <div>
                      <label
                        htmlFor="owner-filter"
                        className="text-sm font-semibold text-gray-700 mb-2 block"
                      >
                        主催者で絞り込み
                      </label>
                      <select
                        id="owner-filter"
                        value={selectedOwner}
                        onChange={(e) => setSelectedOwner(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">すべて</option>
                        {owners.map((owner) => (
                          <option key={owner} value={owner}>
                            {owner}
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
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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

          {/* コンテンツエリア */}
          <div className="flex-1 min-w-0">
            {activeTab === 'list' ? (
              /* 一覧表示 */
              <>
                {/* 今後のイベント */}
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    今後のイベント
                  </h3>
                  <div className="space-y-4">
                    {filteredUpcomingEvents.length > 0 ? (
                      filteredUpcomingEvents.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className="w-full text-left border-l-4 border-purple-500 pl-4 py-2 hover:bg-gray-100 transition-colors rounded-r-lg cursor-pointer"
                        >
                          {event.category && (
                            <div className="mb-2">
                              {(() => {
                                const color =
                                  categoryColorMap[event.category] ||
                                  DEFAULT_COLOR;
                                return (
                                  <span
                                    className={`px-2 py-1 text-xs rounded whitespace-nowrap ${color.bg} ${color.text}`}
                                  >
                                    {event.category}
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                          <div className="text-sm text-gray-500 mb-1">
                            {formatEventDateTime(event)}
                          </div>
                          <h3 className="font-semibold text-gray-900 text-lg">
                            {event.title}
                          </h3>
                          <p className="text-gray-600 text-sm mt-1">
                            {event.venue && `場所: ${event.venue}`}
                            {event.venue && event.owner && ' / '}
                            {event.owner && `主催: ${event.owner}`}
                          </p>
                        </button>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">
                        今後のイベントはありません
                      </p>
                    )}
                  </div>
                </div>

                {/* 過去のイベント */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    過去のイベント
                  </h3>
                  <div className="space-y-4">
                    {filteredPastEvents.length > 0 ? (
                      <>
                        {filteredPastEvents
                          .slice(0, pastEventsDisplayLimit)
                          .map((event) => (
                            <button
                              key={event.id}
                              onClick={() => handleEventClick(event)}
                              className="w-full text-left border-l-4 border-gray-300 pl-4 py-2 hover:bg-gray-100 transition-colors rounded-r-lg cursor-pointer"
                            >
                              {event.category && (
                                <div className="mb-2">
                                  {(() => {
                                    const color =
                                      categoryColorMap[event.category] ||
                                      DEFAULT_COLOR;
                                    return (
                                      <span
                                        className={`px-2 py-1 text-xs rounded whitespace-nowrap ${color.bg} ${color.text}`}
                                      >
                                        {event.category}
                                      </span>
                                    );
                                  })()}
                                </div>
                              )}
                              <div className="text-sm text-gray-500 mb-1">
                                {formatEventDateTime(event)}
                              </div>
                              <h3 className="font-semibold text-gray-900 text-lg">
                                {event.title}
                              </h3>
                              <p className="text-gray-600 text-sm mt-1">
                                {event.venue && `場所: ${event.venue}`}
                                {event.venue && event.owner && ' / '}
                                {event.owner && `主催: ${event.owner}`}
                              </p>
                            </button>
                          ))}
                        {filteredPastEvents.length > pastEventsDisplayLimit && (
                          <div className="flex justify-center mt-6">
                            <button
                              onClick={() =>
                                setPastEventsLimitState({
                                  filterKey,
                                  limit:
                                    pastEventsDisplayLimit +
                                    PAST_EVENTS_PAGE_SIZE,
                                })
                              }
                              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                            >
                              もっと見る
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-500 text-sm">
                        過去のイベントはありません
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* カレンダー表示 */
              <div>
                {/* カテゴリフィルタ（カレンダー上部） */}
                {(categories.length > 0 || owners.length > 0) && (
                  <div className="mb-4 flex gap-4">
                    {categories.length > 0 && (
                      <div>
                        <label
                          htmlFor="category-filter-calendar"
                          className="text-sm font-semibold text-gray-700 mb-2 block"
                        >
                          カテゴリで絞り込み
                        </label>
                        <select
                          id="category-filter-calendar"
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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

                    {/* 主催者フィルタ（カレンダー上部） */}
                    {owners.length > 0 && (
                      <div>
                        <label
                          htmlFor="owner-filter-calendar"
                          className="text-sm font-semibold text-gray-700 mb-2 block"
                        >
                          主催者で絞り込み
                        </label>
                        <select
                          id="owner-filter-calendar"
                          value={selectedOwner}
                          onChange={(e) => setSelectedOwner(e.target.value)}
                          className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="">すべて</option>
                          {owners.map((owner) => (
                            <option key={owner} value={owner}>
                              {owner}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* カレンダーヘッダー */}
                <div className="flex items-center justify-between mb-4 relative">
                  <button
                    onClick={goToPreviousMonth}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="前の月"
                  >
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
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowYearMonthPicker(!showYearMonthPicker)}
                    className="px-4 py-2 text-xl font-bold text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                  >
                    {calendarYear}年{calendarMonth}月
                    <svg
                      className="w-4 h-4 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={goToNextMonth}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="次の月"
                  >
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
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>

                  {/* 年月選択ドロップダウン */}
                  {showYearMonthPicker && (
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-10 min-w-[300px]">
                      <div className="space-y-4">
                        {/* 年の選択 */}
                        <div>
                          <label className="text-sm font-semibold text-gray-700 mb-2 block">
                            年
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={goToPreviousYear}
                              className="px-3 py-2 text-sm rounded-lg transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
                              aria-label="前の年"
                            >
                              ←
                            </button>
                            <select
                              value={calendarYear}
                              onChange={(e) =>
                                setCalendarYear(parseInt(e.target.value))
                              }
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            >
                              {calendarYears.map((year) => (
                                <option key={year} value={year}>
                                  {year}年
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={goToNextYear}
                              className="px-3 py-2 text-sm rounded-lg transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
                              aria-label="次の年"
                            >
                              →
                            </button>
                          </div>
                        </div>

                        {/* 月の選択（12か月すべて表示） */}
                        <div>
                          <label className="text-sm font-semibold text-gray-700 mb-2 block">
                            月
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            {calendarMonths.map((month) => (
                              <button
                                key={month}
                                onClick={() => {
                                  setCalendarMonth(month);
                                  setShowYearMonthPicker(false);
                                }}
                                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                                  calendarMonth === month
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {month}月
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* カレンダーグリッド */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* 曜日ヘッダー */}
                  <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                    {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
                      <div
                        key={day}
                        className="p-2 text-center text-sm font-semibold text-gray-700"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* カレンダー日付 */}
                  <div className="grid grid-cols-7">
                    {calendarDays.map((day, index) => {
                      // 今日の日付かどうかを判定
                      const today = new Date();
                      const isToday =
                        day.date.getFullYear() === today.getFullYear() &&
                        day.date.getMonth() === today.getMonth() &&
                        day.date.getDate() === today.getDate();

                      return (
                        <div
                          key={index}
                          className={`min-h-[100px] border-r border-b border-gray-200 p-2 ${
                            day.isCurrentMonth
                              ? 'bg-white'
                              : 'bg-gray-50 text-gray-400'
                          } ${day.date.getDay() === 0 ? 'text-red-600' : ''} ${
                            day.date.getDay() === 6 ? 'text-blue-600' : ''
                          }`}
                        >
                          <div
                            className={`text-sm font-medium h-7 flex items-center ${
                              isToday
                                ? 'bg-purple-600 text-white rounded-full w-7 justify-center'
                                : ''
                            }`}
                          >
                            {day.date.getDate()}
                          </div>
                          <div className="space-y-1">
                            {day.events.slice(0, 3).map((event) => {
                              const position = getEventPosition(
                                event,
                                day.date
                              );
                              const color = getCategoryColor(
                                event.category,
                                categoryColorMap
                              );
                              let className = `w-full text-left text-xs px-1 py-0.5 rounded truncate transition-colors cursor-pointer ${color.bg} ${color.text} ${color.hover}`;
                              let displayText = '';

                              // 位置に応じてスタイルとテキストを変更
                              if (position === 'start') {
                                className += ` border-l-4 ${color.borderStrong}`;
                                const startTime = formatTime(
                                  event.startDateTime
                                );
                                displayText = startTime
                                  ? `${startTime} ${event.title}`
                                  : event.title;
                              } else if (position === 'end') {
                                className += ` border-r-4 ${color.borderStrong}`;
                                const endTime = event.endDateTime
                                  ? formatTime(event.endDateTime)
                                  : '';
                                displayText = endTime
                                  ? `${event.title} ${endTime}`
                                  : event.title;
                              } else if (position === 'middle') {
                                className += ` border-l-2 ${color.borderSoft} opacity-90`;
                                displayText = event.title;
                              } else {
                                // single
                                const startTime = formatTime(
                                  event.startDateTime
                                );
                                displayText = startTime
                                  ? `${startTime} ${event.title}`
                                  : event.title;
                              }

                              return (
                                <button
                                  key={event.id}
                                  onClick={() => handleEventClick(event)}
                                  className={className}
                                  title={event.title}
                                >
                                  {displayText}
                                </button>
                              );
                            })}
                            {day.events.length > 3 && (
                              <div className="text-xs text-gray-500">
                                +{day.events.length - 3}件
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* イベント詳細モーダル */}
      <EventModal
        event={selectedEvent}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        categoryColorMap={categoryColorMap}
      />
    </div>
  );
}
