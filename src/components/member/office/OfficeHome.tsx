'use client';

import { useEffect, useState } from 'react';
import { isOfficeClerk } from '@/shared/utils/auth';
import {
  OfficeForbiddenError,
  fetchOfficeApplications,
  fetchOfficeMe,
} from '@/repositories/office/officeRepository';
import { OfficeMe } from '@/types/office';
import OfficeApplicationList from './OfficeApplicationList';
import OfficeProxyForm from './OfficeProxyForm';
import OfficeUnitsSection from './OfficeUnitsSection';

type View = 'home' | 'units' | 'list' | 'proxy';

/**
 * 事務員専用ページのトップ（OFFICE.md 7-3）。
 * 事務員が IT に慣れていない前提で、文字とボタンを大きくし、やることをカードで並べる。
 * 承認は次の段階で足す
 */
export default function OfficeHome() {
  const [me, setMe] = useState<OfficeMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('home');
  // 承認を待っている申請の数（読めなければ null のまま。トップの表示だけに使う）
  const [pendingCount, setPendingCount] = useState<number | null>(null);

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

  // トップを出すたびに、承認を待っている件数を読み直す（入力・承認から戻ったときに古い数を出さない）
  useEffect(() => {
    if (!me || view !== 'home') return;
    let cancelled = false;
    fetchOfficeApplications('申請中')
      .then((data) => {
        if (!cancelled) setPendingCount(data.applications.length);
      })
      .catch(() => {
        if (!cancelled) setPendingCount(null);
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

  if (view === 'proxy') {
    return <OfficeProxyForm onDone={() => setView('home')} />;
  }

  if (view === 'units' || view === 'list') {
    return (
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => setView('home')}
          className="self-start text-lg font-medium text-blue-700 hover:text-blue-900 min-h-11"
        >
          ← トップに戻る
        </button>
        {view === 'units' ? <OfficeUnitsSection /> : <OfficeApplicationList />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 text-gray-900">
      <p className="text-lg text-gray-600">{me.name} さん（事務員）</p>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">今日やること</h2>
        <button
          type="button"
          onClick={() => setView('list')}
          className="text-left flex flex-wrap items-center justify-between gap-6 bg-white border-[3px] border-blue-700 hover:bg-blue-50 rounded-2xl p-6 sm:p-8 transition-colors"
        >
          <span className="flex items-center gap-5">
            <span className="w-20 h-20 rounded-full bg-blue-700 text-white flex items-center justify-center text-4xl font-bold">
              {pendingCount ?? '…'}
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-2xl font-bold">新規申し込みリスト</span>
              <span className="text-lg text-gray-600">
                {pendingCount === null
                  ? '承認を待っている申請を見ます'
                  : `承認を待っている申請が ${pendingCount} 件あります`}
              </span>
            </span>
          </span>
          <span className="text-xl font-bold text-white bg-blue-700 rounded-xl px-6 py-4">
            申請を確認する →
          </span>
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold text-gray-600">そのほかの仕事</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setView('proxy')}
            className="text-left bg-white border-2 border-blue-700 hover:bg-blue-50 rounded-2xl p-6 flex flex-col gap-2 min-h-36 transition-colors"
          >
            <span className="text-xl font-bold text-blue-800">
              紙の申請を入力する →
            </span>
            <span className="text-base text-gray-600">
              窓口に出された申請書（組合員名義変更届など）を、代わりに入力します
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
