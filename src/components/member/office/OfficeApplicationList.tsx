'use client';

import { useEffect, useState } from 'react';
import {
  fetchOfficeApplication,
  fetchOfficeApplications,
} from '@/repositories/office/officeRepository';
import { OfficeApplication } from '@/types/office';
import { formatJapaneseDate } from './officeProxy';

/**
 * 新規申し込みリスト（事務員専用ページ。OFFICE.md 7-3）。
 * 申請中の申請を古い順にカードで並べ、押すと内容を出す。承認は次の段階で足す
 */
export default function OfficeApplicationList() {
  const [applications, setApplications] = useState<OfficeApplication[] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetchOfficeApplications('申請中')
      .then((data) => setApplications(data.applications))
      .catch(() =>
        setError(
          '新規申し込みリストを読み込めませんでした。時間をおいて、もう一度開いてください。'
        )
      );
  }, []);

  if (openId) {
    return <ApplicationDetail id={openId} onBack={() => setOpenId(null)} />;
  }
  if (error) {
    return (
      <p className="bg-yellow-50 border border-yellow-300 text-yellow-900 rounded-lg p-6 text-lg">
        {error}
      </p>
    );
  }
  if (!applications) {
    return <p className="text-lg text-gray-600">読み込み中...</p>;
  }

  return (
    <section className="flex flex-col gap-5 text-gray-900">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">新規申し込みリスト</h2>
        <p className="text-base text-gray-600">
          承認を待っている申請です。古い申請から順に並んでいます。
        </p>
      </div>

      {applications.length === 0 ? (
        <p className="bg-white border border-gray-300 rounded-2xl p-6 text-lg">
          承認を待っている申請はありません。
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {applications.map((application) => (
            <li key={application.id}>
              <button
                type="button"
                onClick={() => setOpenId(application.id)}
                className="w-full text-left bg-white border border-gray-300 hover:border-blue-700 rounded-2xl p-5 flex flex-wrap items-center gap-4 transition-colors"
              >
                <span className="text-base font-bold text-amber-900 bg-amber-100 rounded-lg px-3 py-1 whitespace-nowrap">
                  組合員
                </span>
                <span className="flex-[999_1_20rem] min-w-0 flex flex-col gap-1">
                  <span className="text-xl font-bold">
                    {application.type === '名義変更'
                      ? '組合員名義変更届'
                      : '氏名の変更'}
                  </span>
                  <span className="text-lg">{application.memberDisplay}</span>
                  <span className="text-base text-gray-600 break-words">
                    {application.summary}
                  </span>
                </span>
                <span className="flex-[1_1_10rem] flex flex-col gap-1 text-base text-gray-600">
                  <span>
                    {formatJapaneseDate(application.submittedDate)} 届出
                  </span>
                  <span>{application.method}</span>
                </span>
                <span className="text-lg font-bold text-white bg-blue-700 rounded-xl px-5 py-3 whitespace-nowrap">
                  内容を見る
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ApplicationDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [application, setApplication] = useState<OfficeApplication | null>(
    null
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchOfficeApplication(id)
      .then(setApplication)
      .catch(() => setError(true));
  }, [id]);

  const rows: [string, string][] = application
    ? [
        ['申請番号', application.id],
        ['状態', application.status],
        ['お部屋', application.propertyName],
        [
          application.type === '名義変更' ? '旧組合員' : '組合員',
          application.memberDisplay,
        ],
        ['届出日', formatJapaneseDate(application.submittedDate)],
        [
          '申請した人',
          application.agent
            ? `${application.applicantKind}（${application.agent}）`
            : application.applicantKind,
        ],
        ...((application.type === '名義変更'
          ? [
              ['新しい組合員', application.newName],
              [
                '新しい組合員の負担となる日',
                formatJapaneseDate(application.switchDate),
              ],
              ['名義変更日', formatJapaneseDate(application.transferDate)],
              [
                '入居（予定）日',
                formatJapaneseDate(application.moveInDate) || '（なし）',
              ],
              ['旧組合員の転出先の住所', application.oldAddress || '（なし）'],
              [
                '旧組合員の転出先の電話番号',
                application.oldPhone || '（なし）',
              ],
              ['新しい組合員の住所', application.newAddress || '（なし）'],
              ['新しい組合員の電話番号', application.newPhone || '（なし）'],
            ]
          : [['変更後の氏名', application.newName]]) as [string, string][]),
        ['入力した人', application.enteredBy],
        ['申請の方法', application.method],
      ]
    : [];

  return (
    <section className="flex flex-col gap-5 text-gray-900">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-lg font-medium text-blue-700 hover:text-blue-900 min-h-11"
      >
        ← 新規申し込みリストに戻る
      </button>
      {error && (
        <p className="bg-yellow-50 border border-yellow-300 text-yellow-900 rounded-lg p-6 text-lg">
          申請を読み込めませんでした。時間をおいて、もう一度開いてください。
        </p>
      )}
      {!error && !application && (
        <p className="text-lg text-gray-600">読み込み中...</p>
      )}
      {application && (
        <>
          <h2 className="text-2xl font-bold">
            {application.type === '名義変更'
              ? '組合員名義変更届'
              : '氏名の変更'}
          </h2>
          <div className="bg-white border border-gray-300 rounded-2xl p-6 sm:p-8">
            <dl className="grid grid-cols-1 sm:grid-cols-[16em_1fr] gap-x-6 gap-y-3 text-lg">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-gray-600">{label}</dt>
                  <dd className="font-medium break-words whitespace-pre-line">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="bg-gray-100 rounded-lg p-4 text-base text-gray-700">
            承認は準備中です。次の更新で、この画面から承認・差し戻しができるようになります。
          </p>
        </>
      )}
    </section>
  );
}
