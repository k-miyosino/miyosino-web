'use client';

import { OpsWorkerErrorStat, OpsWorkersSummary } from '@/types/ops';
import { Loadable } from './useOpsData';

const CLOUDFLARE_WORKER_URL =
  'https://dash.cloudflare.com/e6544c934cee9bfb0cdfc5b155ce8aeb/workers/services/view';

// エラーの内訳（Cloudflare の status）を日本語にする。知らないものはそのまま出す
const STATUS_LABELS: Record<string, string> = {
  scriptThrewException: '例外',
  exceededResources: '上限超え',
  exceededCpu: 'CPU 時間の上限超え',
  exceededMemory: 'メモリの上限超え',
  internalError: 'Cloudflare 側のエラー',
  clientDisconnected: '接続が切れた',
};

function formatStatuses(statuses: Record<string, number>): string {
  return Object.entries(statuses)
    .map(([status, count]) => `${STATUS_LABELS[status] ?? status} ${count}`)
    .join('、');
}

interface Row {
  name: string;
  day?: OpsWorkerErrorStat;
  week?: OpsWorkerErrorStat;
}

/** 24時間と7日の数字を Worker ごとに1行にまとめる（24時間のエラー → 7日のエラー → 名前の順） */
function buildRows(
  day: OpsWorkerErrorStat[],
  week: OpsWorkerErrorStat[]
): Row[] {
  const rows = new Map<string, Row>();
  for (const stat of week) rows.set(stat.name, { name: stat.name, week: stat });
  for (const stat of day) {
    rows.set(stat.name, { ...rows.get(stat.name), name: stat.name, day: stat });
  }
  return [...rows.values()].sort(
    (a, b) =>
      (b.day?.errors ?? 0) - (a.day?.errors ?? 0) ||
      (b.week?.errors ?? 0) - (a.week?.errors ?? 0) ||
      a.name.localeCompare(b.name)
  );
}

function Count({ stat }: Readonly<{ stat: OpsWorkerErrorStat | undefined }>) {
  if (!stat) return <span className="text-gray-400">0 / 0</span>;
  return (
    <span>
      <span
        className={
          stat.errors > 0 ? 'text-red-700 font-semibold' : 'text-gray-500'
        }
      >
        {stat.errors.toLocaleString('ja-JP')}
      </span>
      <span className="text-gray-500">
        {' '}
        / {stat.requests.toLocaleString('ja-JP')}
      </span>
    </span>
  );
}

/** Worker ごとのエラー数とリクエスト数（Cloudflare の分析 API から ops Worker が取る） */
export default function OpsWorkersSection({
  workers,
}: Readonly<{ workers: Loadable<OpsWorkersSummary> }>) {
  const { data, error } = workers;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">読み込み中...</p>;
  if (!data.available) {
    return (
      <p className="text-sm text-gray-600">
        Cloudflare の分析 API のトークンがまだ設定されていません（OPS.md
        の手順で ops Worker に CLOUDFLARE_ANALYTICS_TOKEN を設定します）
      </p>
    );
  }

  if (data.error) {
    return (
      <p className="text-sm text-red-700">
        Cloudflare の分析 API から読めませんでした（{data.error}
        ）。トークンの権限が Account Analytics: Read
        になっているかを確かめてください
      </p>
    );
  }

  const rows = buildRows(data.day ?? [], data.week ?? []);
  if (rows.length === 0) {
    return <p className="text-sm text-gray-600">記録がありません</p>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="text-left font-medium px-4 py-2">Worker</th>
            <th className="text-right font-medium px-4 py-2 whitespace-nowrap">
              24時間（エラー / 全体）
            </th>
            <th className="text-right font-medium px-4 py-2 whitespace-nowrap">
              7日（エラー / 全体）
            </th>
            <th className="text-left font-medium px-4 py-2">
              7日のエラーの内訳
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr
              key={row.name}
              className={(row.day?.errors ?? 0) > 0 ? 'bg-red-50' : undefined}
            >
              <td className="px-4 py-2">
                <a
                  href={`${CLOUDFLARE_WORKER_URL}/miyosino-${row.name}/production/observability/logs`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline hover:text-blue-900"
                >
                  {row.name}
                </a>
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                <Count stat={row.day} />
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                <Count stat={row.week} />
              </td>
              <td className="px-4 py-2 text-gray-700">
                {row.week ? formatStatuses(row.week.errorStatuses) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
