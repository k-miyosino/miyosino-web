import { OfficeMe, OfficeUnits } from '@/types/office';
import { getToken } from '@/shared/utils/auth';

const OFFICE_API_ENDPOINT =
  process.env.NEXT_PUBLIC_OFFICE_API_URL ||
  'https://miyosino-office.anorimura-miyosino.workers.dev';

/** 事務員でないとき（office Worker が 403 を返したとき）に投げる */
export class OfficeForbiddenError extends Error {
  constructor() {
    super('このページは事務員だけが使えます');
    this.name = 'OfficeForbiddenError';
  }
}

async function requestOfficeApi<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = getToken();
  if (!token) {
    throw new Error('認証トークンがありません');
  }
  const response = await fetch(`${OFFICE_API_ENDPOINT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  if (response.status === 403) {
    throw new OfficeForbiddenError();
  }
  if (!response.ok) {
    throw new Error(`読み込みに失敗しました（${response.status}）`);
  }
  return (await response.json()) as T;
}

export function fetchOfficeMe(): Promise<OfficeMe> {
  return requestOfficeApi<OfficeMe>('/office/me');
}

export function fetchOfficeUnits(): Promise<OfficeUnits> {
  return requestOfficeApi<OfficeUnits>('/office/units');
}
