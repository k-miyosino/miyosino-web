'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchOfficeUnits } from '@/repositories/office/officeRepository';
import { OfficeUnits } from '@/types/office';
import { groupUnitsByBuilding, ownerName } from './officeUnits';

/**
 * 住戸と組合員の一覧（事務員専用ページ）。号棟のボタンを押すと、その号棟の部屋と所有中の組合員を出す。
 * 個人情報なので、データは office Worker から事務員にだけ返る
 */
export default function OfficeUnitsSection() {
  const [data, setData] = useState<OfficeUnits | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetchOfficeUnits()
      .then(setData)
      .catch(() =>
        setError(
          '住戸の一覧を読み込めませんでした。時間をおいて、もう一度開いてください。'
        )
      );
  }, []);

  const groups = useMemo(
    () => (data ? groupUnitsByBuilding(data.units) : []),
    [data]
  );
  const current = groups.find((g) => g.building === selected) ?? groups[0];

  if (error) {
    return (
      <p className="bg-yellow-50 border border-yellow-300 text-yellow-900 rounded-lg p-6 text-lg">
        {error}
      </p>
    );
  }
  if (!data) {
    return <p className="text-lg text-gray-600">読み込み中...</p>;
  }
  if (!current) {
    return <p className="text-lg text-gray-600">住戸が登録されていません。</p>;
  }

  return (
    <section className="flex flex-col gap-5 text-gray-900">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">住戸と組合員</h2>
        <p className="text-base text-gray-600">
          {data.date} の時点で所有している組合員です。号棟を押してください。
        </p>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="号棟を選ぶ"
      >
        {groups.map((group) => {
          const active = group.building === current.building;
          return (
            <button
              key={group.building}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(group.building)}
              className={`min-h-12 min-w-16 px-4 rounded-lg border-2 text-lg font-bold transition-colors ${
                active
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900 hover:border-blue-700'
              }`}
            >
              {group.building}号棟
            </button>
          );
        })}
      </div>

      {current.conflictCount > 0 && (
        <p className="bg-red-50 border border-red-300 text-red-900 rounded-lg p-4 text-base">
          {current.building}号棟に、所有の記録が重なっている住戸が{' '}
          {current.conflictCount}{' '}
          件あります。管理者に台帳の確認を頼んでください。
        </p>
      )}

      <div className="bg-white border border-gray-300 rounded-2xl overflow-x-auto">
        <table className="w-full text-left text-lg">
          <caption className="sr-only">
            {current.building}号棟の住戸と組合員
          </caption>
          <thead className="bg-gray-100 text-base text-gray-700">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                部屋
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                組合員
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                所有の開始日
              </th>
            </tr>
          </thead>
          <tbody>
            {current.units.map((unit) => (
              <tr key={unit.id} className="border-t border-gray-200">
                <td className="px-4 py-3 font-bold whitespace-nowrap">
                  {unit.room}号室
                </td>
                <td className="px-4 py-3">
                  {unit.owner ? (
                    ownerName(unit)
                  ) : (
                    <span className="text-gray-500">
                      （所有中の組合員なし）
                    </span>
                  )}
                  {unit.ownerConflict && (
                    <span className="ml-2 text-base text-red-800">
                      ※ 記録が重なっています
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                  {unit.owner?.startDate ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
