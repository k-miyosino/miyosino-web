'use client';

import { useState } from 'react';
import { OpsChatLog } from '@/types/ops';
import OpsChatLogCard from './OpsChatLogCard';

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
        <div
          role="group"
          aria-label="質問ログの絞り込み"
          className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm"
        >
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={`px-3 py-1 ${
                filter === id
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label}
              {id === 'refused' && `（${refusedCount}）`}
            </button>
          ))}
        </div>
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
