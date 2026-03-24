/**
 * kintone API関連のユーティリティ関数
 *
 * 後方互換性のため、各リポジトリから関数を再エクスポートします。
 * 新しいコードでは src/repositories/kintone/ 配下の各ファイルを直接インポートしてください。
 */

export type { YearMonth } from '@/repositories/kintone/announcementRepository';
export type { Application } from '@/repositories/kintone/applicationRepository';

export {
  fetchAnnouncements,
  fetchAnnouncementYearMonths as fetchYearMonths,
} from '@/repositories/kintone/announcementRepository';

export { fetchGreenWellnessFiles } from '@/repositories/kintone/greenWellnessRepository';

export {
  fetchCirculars,
  fetchCircularYearMonths,
} from '@/repositories/kintone/circularRepository';

export {
  fetchMeetings,
  fetchMeetingYearMonths as fetchMeetingsYearMonths,
} from '@/repositories/kintone/minuteRepository';

export { fetchEvents } from '@/repositories/kintone/eventRepository';

export { fetchApplications } from '@/repositories/kintone/applicationRepository';
