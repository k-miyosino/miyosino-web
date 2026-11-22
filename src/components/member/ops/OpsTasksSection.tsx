'use client';

import { useState } from 'react';
import { OpsCadence, OpsTask, OpsTaskStatus } from '@/types/ops';
import { recordTaskDone } from '@/repositories/ops/opsRepository';
import OpsRecordForm from './OpsRecordForm';

const STATUS_STYLES: Record<
  OpsTaskStatus,
  { label: string; className: string }
> = {
  overdue: {
    label: '期限切れ',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  soon: {
    label: 'もうすぐ',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  ok: {
    label: '対応済み',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  done: {
    label: '完了',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  event: {
    label: 'そのときに',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
};

function cadenceLabel(cadence: OpsCadence): string {
  switch (cadence.type) {
    case 'monthly':
      return '月に1回';
    case 'yearly':
      return '年に1回';
    case 'deadline':
      return `${cadence.date} までに`;
    case 'event':
      return cadence.when;
  }
}

interface Props {
  tasks: OpsTask[];
  onRecorded: () => void;
}

export default function OpsTasksSection({
  tasks,
  onRecorded,
}: Readonly<Props>) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="space-y-3">
      {tasks.map((task) => {
        // 期限付きのタスクで期限まで余裕があるときは、まだ対応していないので「まだ先」と出す
        const style =
          task.status === 'ok' && task.cadence.type === 'deadline'
            ? { ...STATUS_STYLES.ok, label: 'まだ先' }
            : STATUS_STYLES[task.status];
        const last = task.history[0];
        const isOpen = openId === task.id;
        return (
          <li
            key={task.id}
            className="bg-white rounded-lg border border-gray-200"
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : task.id)}
              aria-expanded={isOpen}
              className="w-full text-left p-4 flex flex-wrap items-center gap-x-4 gap-y-2"
            >
              <span
                className={`text-xs font-semibold px-2 py-1 rounded border ${style.className}`}
              >
                {style.label}
              </span>
              <span className="font-medium text-gray-900 flex-1 min-w-[12rem]">
                {task.title}
              </span>
              <span className="text-sm text-gray-600">
                {cadenceLabel(task.cadence)}
                {task.dueDate && task.cadence.type !== 'deadline' && (
                  <>（次の期限 {task.dueDate}）</>
                )}
              </span>
              <span className="text-sm text-gray-500">
                {last
                  ? `前回 ${last.done_at.slice(0, 10)}（${last.done_by}）`
                  : '記録なし'}
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-gray-100 p-4 space-y-4">
                <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-800">
                  {task.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {task.links && task.links.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {task.links.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-700 underline hover:text-blue-900"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
                {task.history.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      これまでの記録
                    </p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {task.history.map((entry) => (
                        <li key={`${entry.done_at}-${entry.done_by}`}>
                          {entry.done_at} {entry.done_by}
                          {entry.note && `：${entry.note}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <OpsRecordForm
                  buttonLabel="対応した"
                  onSubmit={async (note) => {
                    await recordTaskDone(task.id, note);
                    onRecorded();
                  }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
