import {
  OfficeLedgerInput,
  OfficeLedgerLog,
  OfficeLedgerPreview,
  OfficeLedgerResult,
  OfficeMe,
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

/** 入力の誤りなど、画面にそのまま出せるメッセージがあるとき（Worker が 400・409 で messages を返したとき）に投げる */
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

/** 台帳がどう変わるかを確かめる（書き込まない）。入力の誤りは OfficeInputError で返る */
export function previewOfficeLedger(
  input: OfficeLedgerInput
): Promise<OfficeLedgerPreview> {
  return requestOfficeApi<OfficeLedgerPreview>('/office/ledger/preview', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** 台帳に反映する。入力の誤り・kintone が断ったときは OfficeInputError で返る */
export function applyOfficeLedger(
  input: OfficeLedgerInput
): Promise<OfficeLedgerResult> {
  return requestOfficeApi<OfficeLedgerResult>('/office/ledger', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** その日（既定は今日）の台帳の更新記録 */
export async function fetchOfficeLedgerLogs(
  date?: string
): Promise<OfficeLedgerLog[]> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const data = await requestOfficeApi<{ logs: OfficeLedgerLog[] }>(
    `/office/ledger/logs${query}`
  );
  return data.logs;
}

/** その日の更新を取り消す */
export async function cancelOfficeLedgerLog(id: string): Promise<void> {
  await requestOfficeApi<{ ok: boolean }>(
    `/office/ledger/logs/${encodeURIComponent(id)}/cancel`,
    { method: 'POST', body: '{}' }
  );
}
