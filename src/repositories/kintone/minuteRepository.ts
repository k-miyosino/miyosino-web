import { Meeting } from '@/types/minutes';
import { getToken } from '@/shared/utils/auth';
import { YearMonth } from './announcementRepository';

const MINUTES_API_ENDPOINT =
  process.env.NEXT_PUBLIC_MINUTES_API_URL ||
  'https://miyosino-minutes.anorimura-miyosino.workers.dev';

interface MeetingsResponse {
  meetings: Meeting[];
}

interface YearMonthsResponse {
  yearMonths: YearMonth[];
}

export async function fetchMeetings(
  year?: number,
  month?: number
): Promise<Meeting[]> {
  const token = getToken();
  if (!token) {
    throw new Error('認証トークンがありません');
  }

  const url = new URL(`${MINUTES_API_ENDPOINT}/minutes`);
  if (year) url.searchParams.append('year', year.toString());
  if (month) url.searchParams.append('month', month.toString());

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
      }
      throw new Error('認証に失敗しました');
    }
    throw new Error(
      `会議情報の取得に失敗しました: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as MeetingsResponse;
  return data.meetings.map((meeting) => ({
    ...meeting,
    createdAt: new Date(meeting.createdAt),
    updatedAt: new Date(meeting.updatedAt),
  }));
}

export async function fetchMeetingYearMonths(): Promise<YearMonth[]> {
  const token = getToken();
  if (!token) {
    throw new Error('認証トークンがありません');
  }

  const url = new URL(`${MINUTES_API_ENDPOINT}/minutes/years`);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
      }
      throw new Error('認証に失敗しました');
    }
    throw new Error(
      `年月一覧の取得に失敗しました: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as YearMonthsResponse;
  return data.yearMonths;
}
