import { Circular } from '@/types/circulars';
import { getToken } from '@/shared/utils/auth';
import { YearMonth } from './announcementRepository';
import { handleUnauthorized, parseKintoneError } from './utils';

const CIRCULARS_API_ENDPOINT =
  process.env.NEXT_PUBLIC_CIRCULARS_API_URL ||
  'https://miyosino-circulars.anorimura-miyosino.workers.dev';

interface CircularsResponse {
  circulars: Circular[];
}

interface YearMonthsResponse {
  yearMonths: YearMonth[];
}

export async function fetchCirculars(): Promise<Circular[]> {
  const token = getToken();
  if (!token) {
    throw new Error('認証トークンがありません');
  }

  const url = new URL(`${CIRCULARS_API_ENDPOINT}/circulars`);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 401) handleUnauthorized();
    const errorMessage = await parseKintoneError(
      response,
      '配布資料の取得に失敗しました'
    );
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as CircularsResponse;
  return data.circulars;
}

export async function fetchCircularYearMonths(): Promise<YearMonth[]> {
  const token = getToken();
  if (!token) {
    throw new Error('認証トークンがありません');
  }

  const url = new URL(`${CIRCULARS_API_ENDPOINT}/circulars/years`);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 401) handleUnauthorized();
    const errorMessage = await parseKintoneError(
      response,
      '年月一覧の取得に失敗しました'
    );
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as YearMonthsResponse;
  return data.yearMonths;
}
