'use client';

import { GithubWorkflowRun } from '@/repositories/ops/opsRepository';
import { GithubStatus, Loadable } from './useOpsData';

function formatJst(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function runBadge(run: GithubWorkflowRun): {
  label: string;
  className: string;
} {
  if (run.status !== 'completed') {
    return { label: '実行中', className: 'bg-blue-100 text-blue-800' };
  }
  switch (run.conclusion) {
    case 'success':
      return { label: '成功', className: 'bg-green-100 text-green-800' };
    case 'skipped':
      return { label: 'スキップ', className: 'bg-gray-100 text-gray-700' };
    default:
      return { label: '失敗', className: 'bg-red-100 text-red-800' };
  }
}

/** GitHub Actions の最新の結果と、開いている Dependabot の PR（公開リポジトリなので認証なしで取る） */
export default function OpsGithubSection({
  github,
}: Readonly<{ github: Loadable<GithubStatus> }>) {
  if (github.error)
    return <p className="text-sm text-red-700">{github.error}</p>;
  if (!github.data)
    return <p className="text-sm text-gray-500">読み込み中...</p>;
  const { runs, dependabotPulls: pulls } = github.data;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">自動実行の最新の結果</h3>
        <ul className="space-y-2 text-sm">
          {runs.map((run) => {
            const badge = runBadge(run);
            return (
              <li
                key={run.workflow}
                className="flex flex-wrap items-center gap-2"
              >
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${badge.className}`}
                >
                  {badge.label}
                </span>
                <a
                  href={run.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline hover:text-blue-900"
                >
                  {run.label}
                </a>
                <span className="text-gray-500">
                  {run.branch}・{formatJst(run.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">
          開いている Dependabot の PR（{pulls.length}件）
        </h3>
        {pulls.length === 0 ? (
          <p className="text-sm text-gray-600">ありません</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {pulls.map((pull) => (
              <li key={pull.number}>
                <a
                  href={pull.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline hover:text-blue-900"
                >
                  #{pull.number} {pull.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
