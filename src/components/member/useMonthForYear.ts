'use client';

/**
 * 年を変えたとき、その年にない月が選ばれていたら月を直す（お知らせ・回覧板・会議情報・イベントの絞り込み）。
 * effect ではなく、描画の中で食い違いを見つけたときだけ直す（react-hooks/set-state-in-effect）。
 * - 月が「すべて」（空文字列）のときはそのまま
 * - 年が「すべて」のとき（月の一覧がないとき）は、月も「すべて」に戻す
 */
export function useMonthForYear(
  selectedYear: string,
  months: number[],
  selectedMonth: string,
  setSelectedMonth: (month: string) => void
): void {
  if (selectedYear && months.length > 0) {
    if (selectedMonth && !months.includes(Number.parseInt(selectedMonth))) {
      setSelectedMonth(months[0].toString());
    }
  } else if (selectedMonth !== '') {
    setSelectedMonth('');
  }
}
