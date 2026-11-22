'use client';

import { useState } from 'react';
import { OpsChatLog } from '@/types/ops';
import OpsChatLogCard from './OpsChatLogCard';
import OpsSegmentedControl from './OpsSegmentedControl';

type Filter = 'all' | 'refused';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'refused', label: '断ったもの' },
];

/** 直近の質問ログ（カードを並べ、「すべて」「断ったもの」で絞り込める） */
export default function OpsChatLogList({
  logs,
  logging,
}: Readonly<{ logs: OpsChatLog[]; logging: boolean }>) {
  const [filter, setFilter] = useState<Filter>('all');
  const refusedCount = logs.filter((log) => log.outcome === 'refused').length;
  const shown =
    filter === 'refused'
      ? logs.filter((log) => log.outcome === 'refused')
      : logs;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="font-medium text-gray-900">
          直近の質問ログ（{logs.length}件）
        </h3>
        <OpsSegmentedControl
          legend="質問ログの絞り込み"
          options={FILTERS.map(({ id, label }) => ({
            id,
            label: id === 'refused' ? `${label}（${refusedCount}）` : label,
          }))}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {!logging && (
        <p className="text-sm text-gray-600 mb-2">
          質問ログは保存していません（npm run chat:log -- on でオンにする）
        </p>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-gray-600 bg-white rounded-lg border border-gray-200 p-4">
          {filter === 'refused'
            ? '断った質問はありません'
            : '質問ログはありません'}
        </p>
      ) : (
        <div className="space-y-3">
          {shown.map((log) => (
            <OpsChatLogCard
              key={`${log.at}-${log.question}`}
              item={{ ...log, refused: log.outcome === 'refused' }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
