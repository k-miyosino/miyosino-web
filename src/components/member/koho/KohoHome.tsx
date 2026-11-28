'use client';

import { useEffect, useState } from 'react';
import { isKohoMember } from '@/shared/utils/auth';
import {
  KohoForbiddenError,
  fetchKohoLinks,
} from '@/repositories/koho/kohoRepository';
import { KohoGuideRow, KohoLinks } from '@/types/koho';

const EDIT_IN_STYLE: Record<KohoGuideRow['editIn'], string> = {
  kintone: 'bg-blue-100 text-blue-900',
  microCMS: 'bg-purple-100 text-purple-900',
  ソース: 'bg-gray-200 text-gray-800',
};

/**
 * 広報ページ（段階 1。KOHO.md 4 章）。
 * kintone の各アプリ・microCMS へのリンクと、「この部分はここで直す」の早見表を並べる。
 * リンクの中身は koho Worker が広報委員にだけ返す
 */
export default function KohoHome() {
  const [links, setLinks] = useState<KohoLinks | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve()
      .then(() => {
        if (!isKohoMember()) throw new KohoForbiddenError();
        return fetchKohoLinks();
      })
      .then(setLinks)
      .catch((e: unknown) => {
        setError(
          e instanceof KohoForbiddenError
            ? 'このページは広報委員だけが使えます。広報委員のアカウントでログインしてください。'
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
  if (!links) {
    return <p className="text-lg text-gray-600">読み込み中...</p>;
  }

  return (
    <div className="flex flex-col gap-10 text-gray-900">
      <p className="text-lg text-gray-600">{links.me.name} さん（広報委員）</p>

      <section className="flex flex-col gap-4" aria-labelledby="koho-guide">
        <div className="flex flex-col gap-1">
          <h2 id="koho-guide" className="text-2xl font-bold">
            どこで直す？（早見表）
          </h2>
          <p className="text-base text-gray-600">
            直したい場所を探して、右の「どこで直すか」を開いてください。
          </p>
        </div>
        <div className="bg-white border border-gray-300 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-base sm:text-lg">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  ホームページの場所
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  どこで直すか
                </th>
              </tr>
            </thead>
            <tbody>
              {links.guide.map((row) => (
                <tr key={row.area} className="border-t border-gray-200">
                  <td className="px-4 py-3">{row.area}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 mr-2 text-sm font-bold ${EDIT_IN_STYLE[row.editIn]}`}
                    >
                      {row.editIn}
                    </span>
                    {row.target}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="koho-kintone">
        <div className="flex flex-col gap-1">
          <h2 id="koho-kintone" className="text-2xl font-bold">
            kintone で直すもの
          </h2>
          <p className="text-base text-gray-600">
            ボタンを押すと kintone の画面が新しいタブで開きます。kintone
            に保存すると、ホームページにも出ます。
          </p>
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          {links.kintone.map((app) => (
            <li
              key={app.key}
              className="bg-white border border-gray-300 rounded-2xl p-6 flex flex-col gap-3"
            >
              <h3 className="text-xl font-bold">{app.name}</h3>
              <p className="text-base text-gray-700">{app.where}</p>
              {app.note && (
                <p className="text-base text-amber-900 bg-amber-50 rounded-lg px-3 py-2">
                  {app.note}
                </p>
              )}
              <div className="flex flex-wrap gap-3 mt-auto">
                <a
                  href={app.addUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center min-h-12 px-5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-lg font-bold"
                >
                  新しく書く
                </a>
                <a
                  href={app.listUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center min-h-12 px-5 rounded-xl border-2 border-blue-700 text-blue-800 hover:bg-blue-50 text-lg font-bold"
                >
                  一覧を開く（直す・消す）
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="koho-microcms">
        <div className="flex flex-col gap-1">
          <h2 id="koho-microcms" className="text-2xl font-bold">
            microCMS で直すもの
          </h2>
          <p className="text-base text-gray-600">
            写真や紹介の文章は microCMS で直します。microCMS
            のアカウントがない人は、システム管理者に頼んでください。
          </p>
        </div>
        <div className="bg-white border border-gray-300 rounded-2xl p-6 flex flex-col gap-4">
          <ul className="flex flex-col gap-2 text-base sm:text-lg">
            {links.microcms.items.map((item) => (
              <li key={item.name}>
                <span className="font-bold">{item.name}</span>
                <span className="text-gray-600"> … {item.where}</span>
              </li>
            ))}
          </ul>
          <a
            href={links.microcms.url}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start inline-flex items-center min-h-12 px-5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-lg font-bold"
          >
            microCMS を開く
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-2 bg-gray-100 rounded-2xl p-6">
        <h2 className="text-xl font-bold">ページの文章を直したいとき</h2>
        <p className="text-base text-gray-700">
          アクセスの説明や団地の紹介など、ページの文章そのものを直すときは、いまはシステム管理者に頼んでください。言葉で頼むと直せるしくみは準備中です。
        </p>
      </section>
    </div>
  );
}
