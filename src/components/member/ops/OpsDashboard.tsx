'use client';

import { useCallback, useEffect, useState } from 'react';
import { OpsOverview } from '@/types/ops';
import {
  OpsForbiddenError,
  fetchOpsOverview,
} from '@/repositories/ops/opsRepository';
import OpsTasksSection from './OpsTasksSection';
import OpsGithubSection from './OpsGithubSection';
import OpsChatSection from './OpsChatSection';
import OpsSecretsSection from './OpsSecretsSection';
import OpsLinksSection from './OpsLinksSection';

function Section({
  id,
  title,
  description,
  children,
}: Readonly<{
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}>) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-xl font-bold text-gray-900 mb-1">{title}</h2>
      {description && (
        <p className="text-sm text-gray-600 mb-4">{description}</p>
      )}
      <div className={description ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}

/** 運用ダッシュボードの本体。中身はすべて ops Worker から管理者にだけ返ってくる */
export default function OpsDashboard() {
  const [overview, setOverview] = useState<OpsOverview | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchOpsOverview()
      .then((data) => {
        setOverview(data);
        setError(null);
      })
      .catch((e) => {
        if (e instanceof OpsForbiddenError) setForbidden(true);
        else setError(e instanceof Error ? e.message : '読み込めませんでした');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
  if (error) return <p className="text-red-700">{error}</p>;
  if (!overview) return <p className="text-gray-500">読み込み中...</p>;

  const attention = overview.tasks.filter(
    (task) => task.status === 'overdue' || task.status === 'soon'
  ).length;

  return (
    <div className="space-y-12">
      <nav className="flex flex-wrap gap-3 text-sm">
        {[
          ['tasks', '定期タスク'],
          ['github', 'GitHub の状態'],
          ['chat', 'チャット'],
          ['analytics', 'アクセス解析'],
          ['secrets', '秘密情報'],
          ['links', 'リンク集'],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
          >
            {label}
          </a>
        ))}
      </nav>

      <Section
        id="tasks"
        title="定期タスク"
        description={
          attention > 0
            ? `期限切れ・もうすぐのタスクが ${attention} 件あります。対応したら「対応した」で記録してください（今日 ${overview.today}）`
            : `期限が近いタスクはありません（今日 ${overview.today}）`
        }
      >
        <OpsTasksSection tasks={overview.tasks} onRecorded={load} />
      </Section>

      <Section id="github" title="GitHub の状態">
        <OpsGithubSection />
      </Section>

      <Section
        id="chat"
        title="チャット"
        description="質問ログには、だれの質問かは保存していません"
      >
        <OpsChatSection />
      </Section>

      <Section id="analytics" title="アクセス解析">
        {overview.lookerStudioEmbedUrl ? (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <iframe
              src={overview.lookerStudioEmbedUrl}
              title="アクセス解析（Looker Studio）"
              className="w-full h-[720px] border-0"
              sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            />
            <p className="text-xs text-gray-500 px-4 py-2">
              表示されないときは、レポートを見る権限のある Google
              アカウントでログインしてください
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            Looker Studio のレポートがまだ設定されていません（OPS.md の手順で
            wrangler.ops.toml の LOOKER_STUDIO_EMBED_URL に設定します）
          </p>
        )}
      </Section>

      <Section
        id="secrets"
        title="秘密情報"
        description="漏れたとき・担当が替わったときに払い出し直すもの。値はここには出しません"
      >
        <OpsSecretsSection secrets={overview.secrets} onRecorded={load} />
      </Section>

      <Section id="links" title="リンク集">
        <OpsLinksSection groups={overview.linkGroups} />
      </Section>
    </div>
  );
}
