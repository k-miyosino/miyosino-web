'use client';

import { useEffect, useState } from 'react';
import { useOpsData } from './useOpsData';
import { needsAttention } from './opsStatus';
import OpsSummaryCards from './OpsSummaryCards';
import OpsTasksSection from './OpsTasksSection';
import OpsGithubSection from './OpsGithubSection';
import OpsChatSection from './OpsChatSection';
import OpsSecretsSection from './OpsSecretsSection';
import OpsLinksSection from './OpsLinksSection';
import OpsLookerStudioFrame from './OpsLookerStudioFrame';

const TABS = [
  { id: 'overview', label: '概要' },
  { id: 'tasks', label: '定期タスク' },
  { id: 'chat', label: 'チャット' },
  { id: 'analytics', label: 'アクセス解析' },
  { id: 'secrets', label: '秘密情報' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function isTabId(value: string): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

function SectionTitle({
  title,
  description,
}: Readonly<{ title: string; description?: string }>) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {description && (
        <p className="text-sm text-gray-600 mt-0.5">{description}</p>
      )}
    </div>
  );
}

/**
 * 運用ダッシュボードの本体。中身はすべて ops Worker から管理者にだけ返ってくる。
 * 上にまとめの数字、その下にタブ。開いたタブは URL の #（例: #tasks）に残す
 */
export default function OpsDashboard() {
  const { forbidden, overview, chat, github, reloadOverview } = useOpsData();
  const [tab, setTab] = useState<TabId>('overview');

  // URL の # から開くタブを決める（リロードしても、# だけを変えて開き直しても、同じタブになる）
  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.slice(1);
      if (isTabId(hash)) setTab(hash);
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  const selectTab = (id: TabId) => {
    setTab(id);
    window.history.replaceState(null, '', `#${id}`);
  };

  if (forbidden) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-800 font-medium">
          このページは管理者だけが見られます
        </p>
        <p className="text-sm text-gray-600 mt-2">
          kintone
          の「システム管理」グループに入っている方は、一度ログアウトしてログインし直してください
        </p>
      </div>
    );
  }
  if (overview.error) return <p className="text-red-700">{overview.error}</p>;
  if (!overview.data) return <p className="text-gray-500">読み込み中...</p>;

  const data = overview.data;
  const attentionTasks = data.tasks.filter(needsAttention);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">今日 {data.today}</p>
        <OpsLinksSection groups={data.linkGroups} />
      </div>

      <OpsSummaryCards overview={data} github={github} chat={chat} />

      <div
        role="tablist"
        aria-label="運用ダッシュボードの区画"
        className="flex gap-6 border-b border-gray-200 overflow-x-auto overflow-y-hidden"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`ops-panel-${id}`}
            onClick={() => selectTab(id)}
            className={`py-2 -mb-px whitespace-nowrap text-sm border-b-2 transition-colors ${
              tab === id
                ? 'border-slate-800 text-slate-900 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
            {id === 'tasks' && attentionTasks.length > 0 && (
              <span className="ml-1.5 text-xs bg-red-100 text-red-800 rounded-full px-1.5">
                {attentionTasks.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div id={`ops-panel-${tab}`} role="tabpanel">
        {tab === 'overview' && (
          <div className="space-y-8">
            <section>
              <SectionTitle
                title="今やること"
                description={
                  attentionTasks.length > 0
                    ? '期限切れ・もうすぐのタスクです。行を押すと手順が開き、「対応した」で記録できます'
                    : undefined
                }
              />
              {attentionTasks.length > 0 ? (
                <OpsTasksSection
                  tasks={attentionTasks}
                  onRecorded={reloadOverview}
                  showColumns={false}
                />
              ) : (
                <p className="text-sm text-gray-600 bg-white rounded-lg border border-gray-200 p-4">
                  期限が近いタスクはありません
                </p>
              )}
              <p className="text-sm text-gray-500 mt-2">
                ほかの {data.tasks.length - attentionTasks.length}{' '}
                件は「定期タスク」のタブで見られます
              </p>
            </section>
            <section>
              <SectionTitle title="GitHub の状態" />
              <OpsGithubSection github={github} />
            </section>
          </div>
        )}

        {tab === 'tasks' && (
          <section>
            <SectionTitle
              title="定期タスク"
              description="期限切れ・もうすぐのものが上に来ます。行を押すと手順・これまでの記録・「対応した」が開きます"
            />
            <OpsTasksSection tasks={data.tasks} onRecorded={reloadOverview} />
          </section>
        )}

        {tab === 'chat' && (
          <section>
            <SectionTitle
              title="チャット"
              description="質問ログには、だれの質問かは保存していません"
            />
            <OpsChatSection chat={chat} />
          </section>
        )}

        {tab === 'analytics' &&
          (data.lookerStudioEmbedUrl ? (
            <OpsLookerStudioFrame src={data.lookerStudioEmbedUrl} />
          ) : (
            <p className="text-sm text-gray-600">
              Looker Studio のレポートがまだ設定されていません（OPS.md の手順で
              wrangler.ops.toml の LOOKER_STUDIO_EMBED_URL に設定します）
            </p>
          ))}

        {tab === 'secrets' && (
          <section>
            <SectionTitle
              title="秘密情報"
              description="漏れたとき・担当が替わったときに払い出し直すもの。値はここには出しません。行を押すと置き場所と入れ替え手順が開きます"
            />
            <OpsSecretsSection
              secrets={data.secrets}
              onRecorded={reloadOverview}
            />
          </section>
        )}
      </div>
    </div>
  );
}
