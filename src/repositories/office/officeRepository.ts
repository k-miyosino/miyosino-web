import {
  OfficeApplication,
  OfficeApplicationList,
  OfficeMe,
  OfficeProxyInput,
  OfficeProxyResult,
  OfficeUnits,
} from '@/types/office';
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

/** 入力の誤りなど、画面にそのまま出せるメッセージがあるとき（Worker が 400・502 で messages を返したとき）に投げる */
export class OfficeInputError extends Error {
  constructor(readonly messages: string[]) {
    super(messages.join(' / '));
    this.name = 'OfficeInputError';
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
    const body = (await response.json().catch(() => null)) as {
      messages?: unknown;
    } | null;
    if (Array.isArray(body?.messages) && body.messages.length > 0) {
      throw new OfficeInputError(body.messages.map(String));
    }
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

export function fetchOfficeApplications(
  status = '申請中'
): Promise<OfficeApplicationList> {
  return requestOfficeApi<OfficeApplicationList>(
    `/office/applications?status=${encodeURIComponent(status)}`
  );
}

export async function fetchOfficeApplication(
  id: string
): Promise<OfficeApplication> {
  const data = await requestOfficeApi<{ application: OfficeApplication }>(
    `/office/applications/${encodeURIComponent(id)}`
  );
  return data.application;
}

/** 紙の申請を代理入力する。入力の誤りは OfficeInputError で返る */
export function submitOfficeProxyApplication(
  input: OfficeProxyInput
): Promise<OfficeProxyResult> {
  return requestOfficeApi<OfficeProxyResult>('/office/applications/proxy', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
