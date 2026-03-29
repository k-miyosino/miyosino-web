/**
 * Kintone History Repository
 *
 * Worker (miyosino-history-api) 経由で Kintone 団地のあゆみ・修繕履歴アプリから
 * データを取得し、HistorySection / MaintenanceSection が使う型に変換します。
 */

import type {
  KintoneHistoryEvent,
  KintoneHistoryResponse,
  HistoryYearGroup,
  MaintenanceRepair,
} from '@/types/history';

const HISTORY_API_ENDPOINT =
  process.env.NEXT_PUBLIC_HISTORY_API_ENDPOINT ||
  'https://miyosino-history-api.anorimura-miyosino.workers.dev';

async function fetchAllEvents(): Promise<KintoneHistoryEvent[]> {
  const response = await fetch(HISTORY_API_ENDPOINT, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(
      `団地のあゆみデータの取得に失敗しました: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as KintoneHistoryResponse;
  return data.events;
}

function groupByYear(events: KintoneHistoryEvent[]): HistoryYearGroup[] {
  const map = new Map<string, HistoryYearGroup['events']>();

  for (const e of events) {
    if (!map.has(e.year)) {
      map.set(e.year, []);
    }
    map.get(e.year)!.push({
      id: e.id,
      event: e.event,
      description: e.description,
      tag: e.tag,
    });
  }

  return Array.from(map.entries()).map(([year, events]) => ({ year, events }));
}

export async function fetchHistoryEvents(): Promise<HistoryYearGroup[]> {
  const events = await fetchAllEvents();
  return groupByYear(events);
}

export async function fetchMaintenanceRepairs(): Promise<MaintenanceRepair[]> {
  const events = await fetchAllEvents();

  return events
    .filter((e) => e.type === '修繕')
    .map((e) => ({
      id: e.id,
      year: e.year,
      event: e.event,
      tag: e.tag,
      description: e.description,
    }));
}
