/**
 * Kintone API 共通ユーティリティ
 * 複数の API ハンドラで共有するヘルパー関数を提供します。
 */

interface KintoneRecordsResponse<T> {
  records: T[];
  totalCount?: string;
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export async function fetchAllKintoneRecords<T>(
  domain: string,
  appId: string,
  apiToken: string
): Promise<T[]> {
  const PAGE_SIZE = 500;
  let offset = 0;
  const all: T[] = [];

  while (true) {
    const url = new URL(`https://${domain}/k/v1/records.json`);
    url.searchParams.set('app', appId);
    url.searchParams.set('totalCount', 'true');
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(offset));

    const response = await fetch(url.toString(), {
      headers: { 'X-Cybozu-API-Token': apiToken },
      // @ts-expect-error cf は Cloudflare Workers 固有のプロパティ
      cf: { cacheTtl: 300, cacheEverything: true },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Kintone API error: ${response.status} ${response.statusText} - ${text}`
      );
    }

    const data = (await response.json()) as KintoneRecordsResponse<T>;
    all.push(...data.records);

    if (data.records.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}
