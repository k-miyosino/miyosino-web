import { OpsChatSummary, OpsOverview } from '@/types/ops';
import { GithubStatus, Loadable } from './useOpsData';
import { needsAttention } from './opsStatus';

interface Card {
  label: string;
  value: string;
  tone: 'danger' | 'warning' | 'success' | 'neutral';
}

const TONE_CLASS: Record<Card['tone'], string> = {
  danger: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  neutral: 'bg-white border-gray-200 text-gray-900',
};

function tasksCard(overview: OpsOverview): Card {
  const overdue = overview.tasks.filter((t) => t.status === 'overdue').length;
  const attention = overview.tasks.filter(needsAttention).length;
  if (attention === 0) {
    return { label: '要対応のタスク', value: 'なし', tone: 'success' };
  }
  return {
    label: '要対応のタスク',
    value: `${attention} 件`,
    tone: overdue > 0 ? 'danger' : 'warning',
  };
}

function runsCard(github: Loadable<GithubStatus>): Card {
  const label = '自動実行';
  if (github.error) return { label, value: '読み込めず', tone: 'neutral' };
  if (!github.data) return { label, value: '…', tone: 'neutral' };
  const failed = github.data.runs.filter(
    (run) =>
      run.status === 'completed' &&
      run.conclusion !== 'success' &&
      run.conclusion !== 'skipped'
  ).length;
  return failed > 0
    ? { label, value: `${failed} 件失敗`, tone: 'danger' }
    : { label, value: 'すべて成功', tone: 'success' };
}

function pullsCard(github: Loadable<GithubStatus>): Card {
  const label = 'Dependabot の PR';
  if (!github.data) return { label, value: '…', tone: 'neutral' };
  const count = github.data.dependabotPulls.length;
  return {
    label,
    value: `${count} 件`,
    tone: count > 0 ? 'warning' : 'neutral',
  };
}

function chatCard(chat: Loadable<OpsChatSummary>): Card {
  const label = 'チャット利用料（月の目安）';
  const estimate = chat.data?.estimate;
  if (!estimate) {
    return { label, value: chat.error ? '読み込めず' : '…', tone: 'neutral' };
  }
  return {
    label,
    value: `約 ${estimate.monthlyYen.toLocaleString('ja-JP')} 円`,
    tone: 'neutral',
  };
}

/** 一番上のまとめの数字（開いた瞬間に、今日やることがあるかがわかるように） */
export default function OpsSummaryCards({
  overview,
  github,
  chat,
}: Readonly<{
  overview: OpsOverview;
  github: Loadable<GithubStatus>;
  chat: Loadable<OpsChatSummary>;
}>) {
  const cards = [
    tasksCard(overview),
    runsCard(github),
    pullsCard(github),
    chatCard(chat),
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-lg border px-4 py-3 ${TONE_CLASS[card.tone]}`}
        >
          <p className="text-xs opacity-80">{card.label}</p>
          <p className="text-xl font-semibold mt-1">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
