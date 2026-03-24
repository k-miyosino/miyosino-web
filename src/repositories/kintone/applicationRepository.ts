import { getToken } from '@/shared/utils/auth';
import { handleUnauthorized, parseKintoneError } from './utils';

const APPLICATIONS_API_ENDPOINT =
  process.env.NEXT_PUBLIC_APPLICATIONS_API_URL ||
  'https://miyosino-applications.anorimura-miyosino.workers.dev';

export interface Application {
  id: string;
  title: string;
  file?: {
    name: string;
    fileKey: string;
    size: string;
  };
}

interface ApplicationsResponse {
  applications: Application[];
}

export async function fetchApplications(): Promise<Application[]> {
  const token = getToken();
  if (!token) {
    throw new Error('認証トークンがありません');
  }

  const url = new URL(`${APPLICATIONS_API_ENDPOINT}/applications`);

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
      '申請書の取得に失敗しました'
    );
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as ApplicationsResponse;
  return data.applications;
}
