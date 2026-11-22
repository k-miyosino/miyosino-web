'use client';

import { useState } from 'react';
import { OpsSecret } from '@/types/ops';
import { recordSecretRotated } from '@/repositories/ops/opsRepository';
import OpsRecordForm from './OpsRecordForm';

interface Props {
  secrets: OpsSecret[];
  onRecorded: () => void;
}

/** 漏れたら払い出し直す秘密情報の一覧（値は扱わない。名前・置き場所・手順だけ） */
export default function OpsSecretsSection({ secrets, onRecorded }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="space-y-3">
      {secrets.map((secret) => {
        const last = secret.history[0];
        const isOpen = openId === secret.id;
        return (
          <li
            key={secret.id}
            className="bg-white rounded-lg border border-gray-200"
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : secret.id)}
              aria-expanded={isOpen}
              className="w-full text-left p-4 flex flex-wrap items-center gap-x-4 gap-y-1"
            >
              <span className="font-mono text-sm font-semibold text-gray-900 flex-1 min-w-[12rem]">
                {secret.name}
              </span>
              <span className="text-sm text-gray-600">{secret.usedBy}</span>
              <span className="text-sm text-gray-500">
                {last
                  ? `前回の入れ替え ${last.done_at.slice(0, 10)}（${last.done_by}）`
                  : '入れ替えの記録なし'}
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-gray-100 p-4 space-y-3 text-sm">
                <p>
                  <span className="font-medium text-gray-700">置き場所：</span>
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
                {secret.history.length > 0 && (
                  <ul className="text-gray-600 space-y-1">
                    {secret.history.map((entry) => (
                      <li key={`${entry.done_at}-${entry.done_by}`}>
                        {entry.done_at} {entry.done_by}
                        {entry.note && `：${entry.note}`}
                      </li>
                    ))}
                  </ul>
                )}
                <OpsRecordForm
                  buttonLabel="入れ替えた"
                  onSubmit={async (note) => {
                    await recordSecretRotated(secret.id, note);
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
