import { KohoLinks } from '@/types/koho';
import { getToken } from '@/shared/utils/auth';

const KOHO_API_ENDPOINT =
  process.env.NEXT_PUBLIC_KOHO_API_URL ||
  'https://miyosino-koho.anorimura-miyosino.workers.dev';

/** 広報委員でないとき（koho Worker が 403 を返したとき）に投げる */
export class KohoForbiddenError extends Error {
  constructor() {
    super('このページは広報委員だけが使えます');
    this.name = 'KohoForbiddenError';
  }
}

export async function fetchKohoLinks(): Promise<KohoLinks> {
  const token = getToken();
  if (!token) {
    throw new Error('認証トークンがありません');
  }
  const response = await fetch(`${KOHO_API_ENDPOINT}/koho/links`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (response.status === 403) {
    throw new KohoForbiddenError();
  }
  if (!response.ok) {
    throw new Error(`読み込みに失敗しました（${response.status}）`);
  }
  return (await response.json()) as KohoLinks;
}
