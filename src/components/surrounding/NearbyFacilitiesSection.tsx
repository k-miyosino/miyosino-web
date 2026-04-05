'use client';

import { useState, useEffect } from 'react';
import type { NearbyFacility } from '@/types/surrounding';
import { fetchPlaces } from '@/repositories/kintone/placesRepository';
import { surroundingCategories } from './categories';

type GroupedFacilities = Record<string, NearbyFacility[]>;

const colorMap: Record<string, { header: string; card: string }> = {
  blue: { header: 'bg-blue-50 border-blue-500', card: 'bg-white' },
  green: { header: 'bg-green-50 border-green-500', card: 'bg-gray-50' },
  red: { header: 'bg-red-50 border-red-500', card: 'bg-white' },
  emerald: { header: 'bg-emerald-50 border-emerald-500', card: 'bg-white' },
};

function groupByCategory(
  facilities: NearbyFacility[],
  order: string[]
): { label: string; items: NearbyFacility[] }[] {
  const map = new Map<string, NearbyFacility[]>();
  for (const f of facilities) {
    const key = f.category ?? '__none__';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  return order
    .map((label) => ({ label, items: map.get(label) ?? [] }))
    .filter((g) => g.items.length > 0);
}

function FacilityRow({ facility }: { facility: NearbyFacility }) {
  return (
    <div className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="text-2xl mr-4">{facility.icon}</div>
      <div className="flex-1 flex items-center justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1">
          <span className="text-lg font-medium text-gray-900">
            {facility.name}
          </span>
          {facility.googleMapsUrl && (
            <a
              href={facility.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:text-blue-700 underline sm:ml-2"
            >
              地図を見る
            </a>
          )}
          {facility.website && (
            <a
              href={facility.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:text-blue-700 underline sm:ml-2"
            >
              ウェブサイト
            </a>
          )}
        </div>
        <span className="text-gray-600 ml-4 whitespace-nowrap">
          {facility.description}
        </span>
      </div>
    </div>
  );
}

function SubsectionGroup({
  label,
  facilities,
}: {
  label: string;
  facilities: NearbyFacility[];
}) {
  if (facilities.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 px-6 py-2 bg-gray-50 border-b border-gray-200">
        {label}
      </h3>
      <div className="divide-y divide-gray-200">
        {facilities.map((f) => (
          <FacilityRow key={f.id} facility={f} />
        ))}
      </div>
    </div>
  );
}

export default function NearbyFacilitiesSection() {
  const [groupedFacilities, setGroupedFacilities] = useState<GroupedFacilities>(
    {}
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFacilities = async () => {
      try {
        setLoading(true);
        const facilities = await fetchPlaces();

        const sortByOrder = (a: NearbyFacility, b: NearbyFacility) =>
          a.order - b.order;
        const filterBy = (key: string) =>
          facilities.filter((f) => f.subCategory === key).sort(sortByOrder);

        const grouped: GroupedFacilities = {};
        for (const cat of surroundingCategories) {
          grouped[cat.id] = filterBy(cat.id);
        }
        setGroupedFacilities(grouped);
      } catch (error) {
        console.error(
          '[NearbyFacilitiesSection] 周辺施設データ取得エラー:',
          error
        );
      } finally {
        setLoading(false);
      }
    };

    loadFacilities();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <>
      {/* データソース注記 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <p className="text-sm text-gray-500 flex items-center gap-1.5">
          <span>ℹ️</span>
          <span>
            施設情報はGoogle Maps
            APIから自動取得しています。内容が実際と異なる場合があります。
          </span>
        </p>
      </div>

      {surroundingCategories.map((category, index) => {
        const items = groupedFacilities[category.id] ?? [];
        if (items.length === 0) return null;
        const { header, card } = colorMap[category.color] ?? colorMap['blue'];
        const sectionBg = index % 2 === 0 ? 'bg-gray-50' : 'bg-white';
        return (
          <section
            key={category.id}
            id={category.id}
            className={`${sectionBg} py-12 sm:py-16 scroll-mt-20`}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2
                className={`text-lg md:text-xl font-semibold text-gray-700 mb-4 px-4 py-2 ${header} border-l-4 rounded`}
              >
                {category.label}
              </h2>
              <div
                className={`${card} rounded-lg shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-200`}
              >
                {groupByCategory(items, category.subsections).map((g) => (
                  <SubsectionGroup
                    key={g.label}
                    label={g.label}
                    facilities={g.items}
                  />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
