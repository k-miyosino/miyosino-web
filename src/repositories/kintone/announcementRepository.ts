import { Announcement } from '@/components/member/data';
import { getToken, silentRefresh } from '@/shared/utils/auth';

const ANNOUNCEMENTS_API_ENDPOINT =
  process.env.NEXT_PUBLIC_ANNOUNCEMENTS_API_URL ||
  'https://miyosino-announcements.anorimura-miyosino.workers.dev';

export interface YearMonth {
  year: number;
  month: number;
}

interface AnnouncementsResponse {
  announcements: Announcement[];
}

interface YearMonthsResponse {
  yearMonths: YearMonth[];
}

async function authenticatedFetch(url: string): Promise<Response> {
  const token = getToken();
  if (!token) {
    throw new Error('認証トークンがありません');
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok && response.status === 401) {
    const refreshed = await silentRefresh();
    if (refreshed) {
      throw new Error('AUTH_REFRESH_NEEDED');
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_refresh_token');
    }
    throw new Error('認証に失敗しました');
  }

  return response;
}

export async function fetchAnnouncements(
  year?: number,
  month?: number
): Promise<Announcement[]> {
  const url = new URL(`${ANNOUNCEMENTS_API_ENDPOINT}/announcements`);
  if (year) url.searchParams.append('year', year.toString());
  if (month) url.searchParams.append('month', month.toString());

  const response = await authenticatedFetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `お知らせの取得に失敗しました: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as AnnouncementsResponse;
  return data.announcements.map((announcement) => ({
    ...announcement,
    date: new Date(announcement.date),
  }));
}

export async function fetchAnnouncementYearMonths(): Promise<YearMonth[]> {
  const url = new URL(`${ANNOUNCEMENTS_API_ENDPOINT}/announcements/years`);

  const response = await authenticatedFetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `年月一覧の取得に失敗しました: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as YearMonthsResponse;
  return data.yearMonths;
}
