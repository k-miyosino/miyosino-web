'use client';

import { useState } from 'react';
import { OpsPlace, OpsSecret, OpsSecretCategory } from '@/types/ops';
import { recordSecretRotated } from '@/repositories/ops/opsRepository';
import OpsRecordForm from './OpsRecordForm';
import { OpsHistory } from './OpsDetailParts';

interface Props {
  secrets: OpsSecret[];
  /** 種類の一覧（古い ops Worker は返さないので、そのときは1つの表にする） */
  categories?: OpsSecretCategory[];
  onRecorded: () => void;
}

const ROW_GRID =
  'md:grid md:grid-cols-[minmax(0,13rem)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,11rem)_8.5rem] md:items-start';

// 古い ops Worker の形（location・usedBy）でも表示できるようにそろえる
function purposeOf(secret: OpsSecret): string {
  return secret.purpose ?? secret.usedBy ?? '';
}
// 登録先を場所ごとにまとめる（古い形の文字列は、そのまま1つの場所として出す）
function registeredInOf(
  secret: OpsSecret
): { place: string; items: OpsPlace[] }[] {
  const raw = secret.registeredIn ?? (secret.location ? [secret.location] : []);
  const groups = new Map<string, OpsPlace[]>();
  for (const entry of raw) {
    const item =
      typeof entry === 'string' ? { place: '', label: entry } : entry;
    groups.set(item.place, [...(groups.get(item.place) ?? []), item]);
  }
  return [...groups].map(([place, items]) => ({ place, items }));
}

interface Group {
  id: string;
  label: string;
  description?: string;
  secrets: OpsSecret[];
}

function groupSecrets(
  secrets: OpsSecret[],
  categories?: OpsSecretCategory[]
): Group[] {
  if (!categories || categories.length === 0) {
    return [{ id: 'all', label: '秘密情報', secrets }];
  }
  const groups: Group[] = categories.map((c) => ({
    ...c,
    secrets: secrets.filter((s) => s.category === c.id),
  }));
  const known = new Set(categories.map((c) => c.id));
  const others = secrets.filter((s) => !s.category || !known.has(s.category));
  if (others.length > 0) {
    groups.push({ id: 'others', label: 'その他', secrets: others });
  }
  return groups.filter((g) => g.secrets.length > 0);
}

function SecretRow({
  secret,
  isOpen,
  onToggle,
  onRecorded,
}: Readonly<{
  secret: OpsSecret;
  isOpen: boolean;
  onToggle: () => void;
  onRecorded: () => void;
}>) {
  const last = secret.history[0];
  return (
    <li>
      <div
        className={`px-4 py-3 flex flex-col gap-1.5 md:gap-3 hover:bg-gray-50 ${ROW_GRID}`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="text-left font-mono text-sm font-semibold text-gray-900 break-words hover:text-blue-800"
        >
          <span aria-hidden="true" className="inline-block w-4 text-gray-400">
            {isOpen ? '▾' : '▸'}
          </span>
          {secret.name}
        </button>
        <p className="text-sm text-gray-700">
          <span className="md:hidden text-xs text-gray-500">用途：</span>
          {purposeOf(secret)}
        </p>
        <ul className="flex flex-wrap gap-1">
          {registeredInOf(secret).map(({ place, items }) => (
            <li key={place || 'other'} className="w-full">
              {place && <p className="text-xs text-gray-500">{place}</p>}
              <div className="flex flex-wrap gap-1">
                {items.map((item) =>
                  item.url ? (
                    <a
                      key={item.label}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-800 underline hover:bg-blue-100 break-words"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <span
                      key={item.label}
                      className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 break-words"
                    >
                      {item.label}
                    </span>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-sm">
          <span className="md:hidden text-xs text-gray-500">発行元：</span>
          {secret.issuer?.url ? (
            <a
              href={secret.issuer.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 underline hover:text-blue-900"
            >
              {secret.issuer.label}
            </a>
          ) : (
            <span className="text-gray-700">{secret.issuer?.label ?? '—'}</span>
          )}
        </p>
        <p className="text-sm text-gray-500">
          <span className="md:hidden text-xs">前回の入れ替え：</span>
          {last
            ? `${last.done_at.slice(0, 10)}（${last.done_by}）`
            : '記録なし'}
        </p>
      </div>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-3 text-sm bg-gray-50 border-t border-gray-100">
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
          <OpsHistory history={secret.history} title="これまでの入れ替え" />
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
}

/**
 * 漏れたら払い出し直す秘密情報の一覧。種類ごとの表に分け、用途・登録先（設定し直す場所）・
 * 発行元（作り直す場所）を列にする。値は扱わない
 */
export default function OpsSecretsSection({
  secrets,
  categories,
  onRecorded,
}: Readonly<Props>) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {groupSecrets(secrets, categories).map((group) => (
        <section key={group.id}>
          <h3 className="font-semibold text-gray-900">{group.label}</h3>
          {group.description && (
            <p className="text-sm text-gray-600 mb-2">{group.description}</p>
          )}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mt-2">
            <div
              className={`hidden ${ROW_GRID} gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500`}
            >
              <span>名前</span>
              <span>用途</span>
              <span>登録先（設定し直す場所）</span>
              <span>発行元（作り直す場所）</span>
              <span>前回の入れ替え</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {group.secrets.map((secret) => (
                <SecretRow
                  key={secret.id}
                  secret={secret}
                  isOpen={openId === secret.id}
                  onToggle={() =>
                    setOpenId(openId === secret.id ? null : secret.id)
                  }
                  onRecorded={() => {
                    setOpenId(null);
                    onRecorded();
                  }}
                />
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
