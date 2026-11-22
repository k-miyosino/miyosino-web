'use client';

import { useState } from 'react';
import { OpsSecret } from '@/types/ops';
import { recordSecretRotated } from '@/repositories/ops/opsRepository';
import OpsRecordForm from './OpsRecordForm';
import { OpsHistory } from './OpsDetailParts';

interface Props {
  secrets: OpsSecret[];
  onRecorded: () => void;
}

const ROW_GRID =
  'md:grid md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_12rem] md:items-center';

/** 漏れたら払い出し直す秘密情報の一覧（表の形。値は扱わない。名前・置き場所・手順だけ） */
export default function OpsSecretsSection({
  secrets,
  onRecorded,
}: Readonly<Props>) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div
        className={`hidden ${ROW_GRID} gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500`}
      >
        <span>名前</span>
        <span>使っている所</span>
        <span>前回の入れ替え</span>
      </div>
      <ul className="divide-y divide-gray-100">
        {secrets.map((secret) => {
          const last = secret.history[0];
          const isOpen = openId === secret.id;
          return (
            <li key={secret.id}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : secret.id)}
                aria-expanded={isOpen}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex flex-wrap items-center gap-x-3 gap-y-1 ${ROW_GRID}`}
              >
                <span className="font-mono text-sm font-semibold text-gray-900 break-all">
                  {secret.name}
                </span>
                <span className="text-sm text-gray-600 flex-1 min-w-[10rem]">
                  {secret.usedBy}
                </span>
                <span className="text-sm text-gray-500">
                  {last
                    ? `${last.done_at.slice(0, 10)}（${last.done_by}）`
                    : '記録なし'}
                </span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 space-y-3 text-sm bg-gray-50 border-t border-gray-100">
                  <p>
                    <span className="font-medium text-gray-700">
                      置き場所：
                    </span>
                    {secret.location}
                  </p>
                  <div>
                    <p className="font-medium text-gray-700 mb-1">
                      漏れたとき・担当が替わったときの入れ替え手順
                    </p>
                    <ol className="list-decimal pl-5 space-y-1 text-gray-800">
                      {secret.rotate.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  {secret.after && (
                    <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                      入れ替えたあと：{secret.after}
                    </p>
                  )}
                  <OpsHistory
                    history={secret.history}
                    title="これまでの入れ替え"
                  />
                  <OpsRecordForm
                    buttonLabel="入れ替えた"
                    onSubmit={async (note) => {
                      await recordSecretRotated(secret.id, note);
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
