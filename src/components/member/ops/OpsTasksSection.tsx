'use client';

import { useState } from 'react';
import { OpsTask } from '@/types/ops';
import { recordTaskDone } from '@/repositories/ops/opsRepository';
import OpsRecordForm from './OpsRecordForm';
import { cadenceLabel, dueLabel, taskBadge } from './opsStatus';
import { OpsHistory, OpsLinkList } from './OpsDetailParts';

interface Props {
  tasks: OpsTask[];
  onRecorded: () => void;
  /** 前回・次の期限の列を出す（概要タブでは出さず、行を短くする） */
  showColumns?: boolean;
}

// 表の列（md 以上で揃える。スマホでは折り返す）
const ROW_GRID =
  'md:grid md:grid-cols-[6.5rem_minmax(0,1fr)_9rem_7rem_12rem] md:items-center';

/** 定期タスクの一覧（表の形。行を押すと手順・記録・「対応した」が開く） */
export default function OpsTasksSection({
  tasks,
  onRecorded,
  showColumns = true,
}: Readonly<Props>) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {showColumns && (
        <div
          className={`hidden ${ROW_GRID} gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500`}
        >
          <span>状態</span>
          <span>タスク</span>
          <span>周期</span>
          <span>次の期限</span>
          <span>前回</span>
        </div>
      )}
      <ul className="divide-y divide-gray-100">
        {tasks.map((task) => {
          const badge = taskBadge(task);
          const last = task.history[0];
          const isOpen = openId === task.id;
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : task.id)}
                aria-expanded={isOpen}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex flex-wrap items-center gap-x-3 gap-y-1 ${showColumns ? ROW_GRID : ''}`}
              >
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded w-fit ${badge.className}`}
                >
                  {badge.label}
                </span>
                <span className="font-medium text-gray-900 flex-1 min-w-[10rem]">
                  {task.title}
                </span>
                <span className="text-sm text-gray-600">
                  {cadenceLabel(task.cadence)}
                </span>
                {showColumns && (
                  <>
                    <span className="text-sm text-gray-600">
                      <span className="md:hidden">次の期限 </span>
                      {dueLabel(task)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {last
                        ? `${last.done_at.slice(0, 10)}（${last.done_by}）`
                        : '記録なし'}
                    </span>
                  </>
                )}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 space-y-3 bg-gray-50 border-t border-gray-100">
                  <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-800">
                    {task.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <OpsLinkList links={task.links} />
                  <OpsHistory history={task.history} title="これまでの記録" />
                  <OpsRecordForm
                    buttonLabel="対応した"
                    onSubmit={async (note) => {
                      await recordTaskDone(task.id, note);
                      setOpenId(null);
                      onRecorded();
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
