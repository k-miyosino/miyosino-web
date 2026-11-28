'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  OfficeInputError,
  cancelOfficeLedgerLog,
  fetchOfficeLedgerLogs,
} from '@/repositories/office/officeRepository';
import { OfficeLedgerLog } from '@/types/office';
import { formatJapaneseDate } from './officeLedger';

/** ISO の日時を、日本時間の「13:05」にする */
function timeJst(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  return new Date(time + 9 * 60 * 60 * 1000).toISOString().slice(11, 16);
}

/**
 * 今日の更新（事務員専用ページ。OFFICE.md 0-5）。その日に台帳を更新した記録を並べ、取り消しもここから行う。
 * 取り消しは押しまちがいを防ぐため、2 回押す（「取り消す」→「本当に取り消す」）
 */
export default function OfficeLedgerLogList() {
  const [logs, setLogs] = useState<OfficeLedgerLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);

  const load = useCallback(() => {
    fetchOfficeLedgerLogs()
      .then(setLogs)
      .catch(() =>
        setError(
          '今日の更新を読み込めませんでした。時間をおいて、もう一度開いてください。'
        )
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (id: string) => {
    setBusy(true);
    setMessages([]);
    try {
      await cancelOfficeLedgerLog(id);
      setMessages([`記録番号 ${id} の更新を取り消しました。`]);
      setConfirming(null);
      load();
    } catch (e) {
      setMessages(
        e instanceof OfficeInputError
          ? e.messages
          : ['取り消せませんでした。時間をおいて、もう一度押してください。']
      );
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <p className="bg-yellow-50 border border-yellow-300 text-yellow-900 rounded-lg p-6 text-lg">
        {error}
      </p>
    );
  }
  if (!logs) return <p className="text-lg text-gray-600">読み込み中...</p>;

  return (
    <section className="flex flex-col gap-5 text-gray-900">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">今日の更新</h2>
        <p className="text-base text-gray-600">
          今日、台帳に反映したものです。まちがえたものは、今日のうちなら取り消せます。
        </p>
      </div>

      {messages.length > 0 && (
        <div
          role="status"
          className="bg-blue-50 border border-blue-300 text-blue-900 rounded-lg p-4 text-lg"
        >
          {messages.map((m) => (
            <p key={m}>{m}</p>
          ))}
        </div>
      )}

      {logs.length === 0 ? (
        <p className="bg-white border border-gray-300 rounded-2xl p-6 text-lg">
          今日の更新はまだありません。
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {logs.map((log) => {
            const canceled = log.status === '取り消し';
            return (
              <li
                key={log.id}
                className={`bg-white border rounded-2xl p-5 flex flex-wrap items-center gap-4 ${
                  canceled ? 'border-gray-200 opacity-70' : 'border-gray-300'
                }`}
              >
                <span className="flex-[999_1_20rem] min-w-0 flex flex-col gap-1">
                  <span className="text-xl font-bold">
                    {log.type}
                    {canceled && (
                      <span className="ml-2 text-base font-bold text-gray-600">
                        （取り消し済み）
                      </span>
                    )}
                  </span>
                  <span className="text-lg">
                    {log.type === '名義変更'
                      ? `${log.oldMember} → ${log.propertyName} ${log.newName}（${formatJapaneseDate(log.switchDate)}から）`
                      : `${log.oldMember} → ${log.propertyName} ${log.newName}`}
                  </span>
                  <span className="text-base text-gray-600">
                    記録番号 {log.id} ・ {timeJst(log.enteredAt)} ・{' '}
                    {log.enteredBy}
                  </span>
                </span>
                {!canceled &&
                  (confirming === log.id ? (
                    <span className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => cancel(log.id)}
                        disabled={busy}
                        className="text-lg font-bold min-h-12 px-5 rounded-xl bg-red-700 text-white hover:bg-red-800 disabled:opacity-50"
                      >
                        {busy ? '取り消しています...' : '本当に取り消す'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        disabled={busy}
                        className="text-lg font-bold min-h-12 px-5 rounded-xl border-2 border-gray-500 bg-white"
                      >
                        やめる
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(log.id)}
                      className="text-lg font-bold min-h-12 px-5 rounded-xl border-2 border-red-700 text-red-800 hover:bg-red-50"
                    >
                      取り消す
                    </button>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
