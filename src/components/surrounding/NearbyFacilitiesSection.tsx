'use client';

import { useState, useEffect } from 'react';
import type { NearbyFacility } from '@/types/surrounding';
import { fetchPlaces } from '@/repositories/kintone/placesRepository';

type GroupedFacilities = {
  medicalFacilities: NearbyFacility[];
  lifeFacilities: NearbyFacility[];
  educationFacilities: NearbyFacility[];
};

const MEDICAL_SUBSECTIONS = ['総合病院', '医療（診療所）', '薬局', '動物病院'];
const LIFE_SUBSECTIONS = ['公共', '金融機関', '郵便局'];
const EDUCATION_SUBSECTIONS = [
  '幼児教育',
  '教育（初等）',
  '教育（中等）',
  '教育（高等）',
];

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
    {
      medicalFacilities: [],
      lifeFacilities: [],
      educationFacilities: [],
    }
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

        setGroupedFacilities({
          medicalFacilities: filterBy('medicalFacilities'),
          lifeFacilities: filterBy('lifeFacilities'),
          educationFacilities: filterBy('educationFacilities'),
        });
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
      {/* 医療施設セクション */}
      {groupedFacilities.medicalFacilities.length > 0 && (
        <section
          id="medicalFacilities"
          className="bg-gray-50 py-12 sm:py-16 scroll-mt-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-4 px-4 py-2 bg-red-50 border-l-4 border-red-500 rounded">
              医療施設
            </h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-200">
              {groupByCategory(
                groupedFacilities.medicalFacilities,
                MEDICAL_SUBSECTIONS
              ).map((g) => (
                <SubsectionGroup
                  key={g.label}
                  label={g.label}
                  facilities={g.items}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 生活セクション */}
      {groupedFacilities.lifeFacilities.length > 0 && (
        <section
          id="lifeFacilities"
          className="bg-white py-12 sm:py-16 scroll-mt-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-4 px-4 py-2 bg-blue-50 border-l-4 border-blue-500 rounded">
              生活
            </h2>
            <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-200">
              {groupByCategory(
                groupedFacilities.lifeFacilities,
                LIFE_SUBSECTIONS
              ).map((g) => (
                <SubsectionGroup
                  key={g.label}
                  label={g.label}
                  facilities={g.items}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 教育施設セクション */}
      {groupedFacilities.educationFacilities.length > 0 && (
        <section
          id="educationFacilities"
          className="bg-gray-50 py-12 sm:py-16 scroll-mt-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-4 px-4 py-2 bg-green-50 border-l-4 border-green-500 rounded">
              教育施設
            </h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-200">
              {groupByCategory(
                groupedFacilities.educationFacilities,
                EDUCATION_SUBSECTIONS
              ).map((g) => (
                <SubsectionGroup
                  key={g.label}
                  label={g.label}
                  facilities={g.items}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
