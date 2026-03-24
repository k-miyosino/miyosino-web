import { GreenWellnessFile } from '@/components/member/data';
import { getToken } from '@/shared/utils/auth';

const GREENWELLNESS_API_ENDPOINT =
  process.env.NEXT_PUBLIC_GREENWELLNESS_API_URL ||
  'https://miyosino-greenwellness.anorimura-miyosino.workers.dev';

interface GreenWellnessFilesResponse {
  files: GreenWellnessFile[];
}

export async function fetchGreenWellnessFiles(): Promise<GreenWellnessFile[]> {
  const token = getToken();
  if (!token) {
    throw new Error('認証トークンがありません');
  }

  const url = new URL(`${GREENWELLNESS_API_ENDPOINT}/greenwellness`);

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
      `グリーンウェルネスファイルの取得に失敗しました: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as GreenWellnessFilesResponse;
  return data.files;
}
