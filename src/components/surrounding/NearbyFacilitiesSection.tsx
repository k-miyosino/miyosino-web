'use client';

import { useState, useEffect } from 'react';
import type { NearbyFacility } from '@/types/surrounding';
import { fetchNearbyFacilities } from '@/repositories/microcms/contentRepository';

type GroupedFacilities = {
  publicFacilities: NearbyFacility[];
  educationFacilities: NearbyFacility[];
  financialInstitutions: NearbyFacility[];
  commercialFacilities: NearbyFacility[];
  medicalFacilities: NearbyFacility[];
  utilities: NearbyFacility[];
};

export default function NearbyFacilitiesSection() {
  const [groupedFacilities, setGroupedFacilities] = useState<GroupedFacilities>(
    {
      publicFacilities: [],
      educationFacilities: [],
      financialInstitutions: [],
      commercialFacilities: [],
      medicalFacilities: [],
      utilities: [],
    }
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFacilities = async () => {
      try {
        setLoading(true);
        const facilities = await fetchNearbyFacilities();

        const sortByOrder = (a: NearbyFacility, b: NearbyFacility) =>
          a.order - b.order;
        const filterBy = (key: string) =>
          facilities.filter((f) => f.subCategory === key).sort(sortByOrder);

        setGroupedFacilities({
          publicFacilities: filterBy('publicFacilities'),
          educationFacilities: filterBy('educationFacilities'),
          financialInstitutions: filterBy('financialInstitutions'),
          commercialFacilities: filterBy('commercialFacilities'),
          medicalFacilities: filterBy('medicalFacilities'),
          utilities: filterBy('utilities'),
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
      {/* 公共施設セクション */}
      {groupedFacilities.publicFacilities.length > 0 && (
        <section
          id="publicFacilities"
          className="bg-gray-50 py-12 sm:py-16 scroll-mt-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-4 px-4 py-2 bg-blue-50 border-l-4 border-blue-500 rounded">
              公共施設
            </h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
              {groupedFacilities.publicFacilities.map((facility) => (
                <div
                  key={facility.id}
                  className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="text-2xl mr-4">{facility.icon}</div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-lg font-medium text-gray-900">
                      {facility.name}
                    </span>
                    <span className="text-gray-600 ml-4">
                      {facility.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 教育施設セクション */}
      {groupedFacilities.educationFacilities.length > 0 && (
        <section
          id="educationFacilities"
          className="bg-white py-12 sm:py-16 scroll-mt-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-4 px-4 py-2 bg-green-50 border-l-4 border-green-500 rounded">
              教育施設
            </h2>
            <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
              {groupedFacilities.educationFacilities.map((facility) => (
                <div
                  key={facility.id}
                  className="flex items-center px-6 py-4 hover:bg-gray-100 transition-colors"
                >
                  <div className="text-2xl mr-4">{facility.icon}</div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-lg font-medium text-gray-900">
                      {facility.name}
                    </span>
                    <span className="text-gray-600 ml-4">
                      {facility.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 金融機関セクション */}
      {groupedFacilities.financialInstitutions.length > 0 && (
        <section
          id="financialInstitutions"
          className="bg-gray-50 py-12 sm:py-16 scroll-mt-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-4 px-4 py-2 bg-yellow-50 border-l-4 border-yellow-500 rounded">
              金融機関
            </h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
              {groupedFacilities.financialInstitutions.map((facility) => (
                <div
                  key={facility.id}
                  className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="text-2xl mr-4">{facility.icon}</div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-lg font-medium text-gray-900">
                      {facility.name}
                    </span>
                    <span className="text-gray-600 ml-4">
                      {facility.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 商業施設セクション */}
      {groupedFacilities.commercialFacilities.length > 0 && (
        <section
          id="commercialFacilities"
          className="bg-white py-12 sm:py-16 scroll-mt-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-4 px-4 py-2 bg-pink-50 border-l-4 border-pink-500 rounded">
              商業施設
            </h2>
            <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
              {groupedFacilities.commercialFacilities.map((facility) => (
                <div
                  key={facility.id}
                  className="flex items-center px-6 py-4 hover:bg-gray-100 transition-colors"
                >
                  <div className="text-2xl mr-4">{facility.icon}</div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-lg font-medium text-gray-900">
                      {facility.name}
                    </span>
                    <span className="text-gray-600 ml-4">
                      {facility.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
              {groupedFacilities.medicalFacilities.map((facility) => (
                <div
                  key={facility.id}
                  className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="text-2xl mr-4">{facility.icon}</div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-lg font-medium text-gray-900">
                      {facility.name}
                    </span>
                    <span className="text-gray-600 ml-4">
                      {facility.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* その他セクション */}
      {groupedFacilities.utilities.length > 0 && (
        <section
          id="utilities"
          className="bg-white py-12 sm:py-16 scroll-mt-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-4 px-4 py-2 bg-gray-100 border-l-4 border-gray-400 rounded">
              その他（電気、ガス、水道、ごみ処理）
            </h2>
            <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
              {groupedFacilities.utilities.map((facility) => (
                <div
                  key={facility.id}
                  className="flex items-center px-6 py-4 hover:bg-gray-100 transition-colors"
                >
                  <div className="text-2xl mr-4">{facility.icon}</div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-lg font-medium text-gray-900">
                      {facility.name}
                    </span>
                    <span className="text-gray-600 ml-4">
                      {facility.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
