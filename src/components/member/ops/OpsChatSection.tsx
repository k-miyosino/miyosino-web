'use client';

import { OpsChatSummary } from '@/types/ops';
import { Loadable } from './useOpsData';
import OpsChatLogCard from './OpsChatLogCard';
import OpsChatLogList from './OpsChatLogList';

const RATING_LABELS = {
  understood: 'わかった',
  partly: '少しわかった',
  not: 'わからなかった',
} as const;

function OnOff({ on }: Readonly<{ on: boolean }>) {
  return (
    <span className={on ? 'text-green-700 font-medium' : 'text-gray-500'}>
      {on ? 'オン' : 'オフ'}
    </span>
  );
}

/** チャットの設定・回数・利用料の目安・評価・質問ログ */
export default function OpsChatSection({
  chat,
}: Readonly<{ chat: Loadable<OpsChatSummary> }>) {
  const { data, error } = chat;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">読み込み中...</p>;
  if (!data.available || !data.settings) {
    return (
      <p className="text-sm text-gray-600">
        チャットのデータベースにつながっていません
      </p>
    );
  }

  const {
    settings,
    daily = [],
    estimate,
    month,
    logs = [],
    ratings = {},
    notUnderstood = [],
  } = data;
  const ratingTotal = Object.values(ratings).reduce(
    (sum, n) => sum + (n ?? 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm space-y-1">
          <h3 className="font-medium text-gray-900 mb-2">設定</h3>
          <p>
            チャット：
            <OnOff on={settings.enabled} />
          </p>
          <p>
            質問ログ：
            <OnOff on={settings.logging} />（{settings.retentionDays}日保存）
          </p>
          <p>
            評価のボタン：
            <OnOff on={settings.feedback} />
          </p>
          <p>
            上限：1人1日 {settings.limitPerUser} 回、全員で1日{' '}
            {settings.limitTotal} 回
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm">
          <h3 className="font-medium text-gray-900 mb-2">直近7日の回数</h3>
          {daily.length === 0 ? (
            <p className="text-gray-600">記録なし</p>
          ) : (
            <ul className="space-y-0.5">
              {daily.map((row) => (
                <li key={row.date} className="flex justify-between">
                  <span>{row.date}</span>
                  <span className="font-mono">{row.count} 回</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm space-y-1">
          <h3 className="font-medium text-gray-900 mb-2">利用料の目安</h3>
          {estimate && (
            <>
              <p className="text-2xl font-semibold text-gray-900">
                月 {estimate.monthlyYen.toLocaleString('ja-JP')} 円前後
              </p>
              <p className="text-gray-600">
                直近7日の {estimate.weekCount} 回 × 1回 {estimate.yenPerRequest}{' '}
                円から見積もり。 実際の金額は Anthropic コンソールで確かめる
              </p>
            </>
          )}
          {month && settings.logging && (
            <p className="text-gray-600">
              今月（{month.from}〜）の記録：{month.loggedCount} 件、入力{' '}
              {month.inputTokens.toLocaleString('ja-JP')}・出力{' '}
              {month.outputTokens.toLocaleString('ja-JP')} トークン
            </p>
          )}
        </div>
      </div>

      <section className="bg-white rounded-lg border border-gray-200 p-4 text-sm">
        <h3 className="font-medium text-gray-900 mb-2">
          直近30日の評価（{ratingTotal}件）
        </h3>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          {(Object.keys(RATING_LABELS) as (keyof typeof RATING_LABELS)[]).map(
            (key) => (
              <span key={key}>
                {RATING_LABELS[key]}：{ratings[key] ?? 0}
              </span>
            )
          )}
        </p>
      </section>

      {notUnderstood.length > 0 && (
        <section>
          <h3 className="font-medium text-gray-900 mb-2">
            「わからなかった」の質問と答え（{notUnderstood.length}件）
          </h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {notUnderstood.map((item) => (
              <OpsChatLogCard key={`${item.at}-${item.page}`} item={item} />
            ))}
          </div>
        </section>
      )}

      <OpsChatLogList logs={logs} logging={settings.logging} />
    </div>
  );
}
