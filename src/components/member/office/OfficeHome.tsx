'use client';

import { useEffect, useState } from 'react';
import { isOfficeClerk } from '@/shared/utils/auth';
import {
  OfficeForbiddenError,
  fetchOfficeLedgerLogs,
  fetchOfficeMe,
} from '@/repositories/office/officeRepository';
import { OfficeMe } from '@/types/office';
import OfficeLedgerForm from './OfficeLedgerForm';
import OfficeLedgerLogList from './OfficeLedgerLogList';
import OfficeUnitsSection from './OfficeUnitsSection';

type View = 'home' | 'units' | 'logs' | 'ledger';

/**
 * 事務員専用ページのトップ（OFFICE.md 0-5）。
 * 事務員が IT に慣れていない前提で、文字とボタンを大きくし、やることをカードで並べる
 */
export default function OfficeHome() {
  const [me, setMe] = useState<OfficeMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('home');
  // 今日の更新の数（読めなければ null のまま。トップの表示だけに使う）
  const [todayCount, setTodayCount] = useState<number | null>(null);

  useEffect(() => {
    // 事務員のトークンでなければ、Worker に問い合わせずに「事務員だけ」と出す
    Promise.resolve()
      .then(() => {
        if (!isOfficeClerk()) throw new OfficeForbiddenError();
        return fetchOfficeMe();
      })
      .then(setMe)
      .catch((e: unknown) => {
        setError(
          e instanceof OfficeForbiddenError
            ? 'このページは事務員だけが使えます。事務員のアカウントでログインしてください。'
            : '読み込みに失敗しました。時間をおいて、もう一度開いてください。'
        );
      });
  }, []);

  // トップを出すたびに、今日の更新の数を読み直す（更新・取り消しから戻ったときに古い数を出さない）
  useEffect(() => {
    if (!me || view !== 'home') return;
    let cancelled = false;
    fetchOfficeLedgerLogs()
      .then((logs) => {
        if (!cancelled)
          setTodayCount(logs.filter((l) => l.status === '反映済み').length);
      })
      .catch(() => {
        if (!cancelled) setTodayCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [me, view]);

  if (error) {
    return (
      <p className="bg-yellow-50 border border-yellow-300 text-yellow-900 rounded-lg p-6 text-lg">
        {error}
      </p>
    );
  }

  if (!me) {
    return <p className="text-lg text-gray-600">読み込み中...</p>;
  }

  if (view === 'ledger') {
    return <OfficeLedgerForm onDone={() => setView('home')} />;
  }

  if (view === 'units' || view === 'logs') {
    return (
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => setView('home')}
          className="self-start text-lg font-medium text-blue-700 hover:text-blue-900 min-h-11"
        >
          ← トップに戻る
        </button>
        {view === 'units' ? <OfficeUnitsSection /> : <OfficeLedgerLogList />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 text-gray-900">
      <p className="text-lg text-gray-600">{me.name} さん（事務員）</p>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">届を受け取ったら</h2>
        <button
          type="button"
          onClick={() => setView('ledger')}
          className="text-left flex flex-wrap items-center justify-between gap-6 bg-white border-[3px] border-blue-700 hover:bg-blue-50 rounded-2xl p-6 sm:p-8 transition-colors"
        >
          <span className="flex flex-col gap-1">
            <span className="text-2xl font-bold">台帳を更新する</span>
            <span className="text-lg text-gray-600">
              名義変更（組合員名義変更届）・氏名の変更を、台帳に反映します
            </span>
          </span>
          <span className="text-xl font-bold text-white bg-blue-700 rounded-xl px-6 py-4">
            入力する →
          </span>
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold text-gray-600">そのほかの仕事</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setView('logs')}
            className="text-left bg-white border-2 border-blue-700 hover:bg-blue-50 rounded-2xl p-6 flex flex-col gap-2 min-h-36 transition-colors"
          >
            <span className="text-xl font-bold text-blue-800">
              今日の更新{todayCount === null ? '' : `（${todayCount} 件）`} →
            </span>
            <span className="text-base text-gray-600">
              今日、台帳に反映したものを見ます。まちがえたものは、ここから取り消せます
            </span>
          </button>
          <button
            type="button"
            onClick={() => setView('units')}
            className="text-left bg-white border-2 border-blue-700 hover:bg-blue-50 rounded-2xl p-6 flex flex-col gap-2 min-h-36 transition-colors"
          >
            <span className="text-xl font-bold text-blue-800">
              住戸と組合員を見る →
            </span>
            <span className="text-base text-gray-600">
              号棟ごとに、いま所有している組合員を確かめます
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
