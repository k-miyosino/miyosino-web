'use client';

import { useEffect, useState } from 'react';
import { isOfficeClerk } from '@/shared/utils/auth';
import {
  OfficeForbiddenError,
  fetchOfficeMe,
} from '@/repositories/office/officeRepository';
import { OfficeMe } from '@/types/office';
import OfficeUnitsSection from './OfficeUnitsSection';

type View = 'home' | 'units';

/**
 * 事務員専用ページのトップ（OFFICE.md 7-3）。
 * 事務員が IT に慣れていない前提で、文字とボタンを大きくし、やることをカードで並べる。
 * 申請の一覧・代理入力は次の段階で足す（今は「準備中」と出す）
 */
export default function OfficeHome() {
  const [me, setMe] = useState<OfficeMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('home');

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

  if (view === 'units') {
    return (
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => setView('home')}
          className="self-start text-lg font-medium text-blue-700 hover:text-blue-900 min-h-11"
        >
          ← トップに戻る
        </button>
        <OfficeUnitsSection />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 text-gray-900">
      <p className="text-lg text-gray-600">{me.name} さん（事務員）</p>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">今日やること</h2>
        <div className="flex flex-wrap items-center justify-between gap-6 bg-white border-2 border-gray-300 rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-bold">新規申し込みリスト</span>
            <span className="text-lg text-gray-600">
              準備中です。次の更新で、承認を待っている申請がここに並びます。
            </span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold text-gray-600">そのほかの仕事</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-white border border-gray-300 rounded-2xl p-6 flex flex-col gap-2 min-h-36">
            <span className="text-xl font-bold">紙の申請を入力する</span>
            <span className="text-base text-gray-600">
              準備中です。窓口に出された申請書（名義変更届など）を、代わりに入力できるようになります。
            </span>
          </div>
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
