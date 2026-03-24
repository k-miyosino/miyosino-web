'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { CommonFacility } from '@/types/facilities';
import { fetchCommonFacilities } from '@/repositories/microcms/contentRepository';
import { facilitiesSections } from './data';

export default function CommonFacilitiesSection() {
  const [facilities, setFacilities] = useState<CommonFacility[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFacilities = async () => {
      try {
        setLoading(true);
        const data = await fetchCommonFacilities();
        setFacilities(data);
      } catch (error) {
        console.error(
          '[CommonFacilitiesSection] 共用施設データ取得エラー:',
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
      <div className="space-y-8">
        <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
          共有施設
        </h3>
        <div className="text-center py-8">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  const sectionData = facilitiesSections.find((s) => s.id === 'common');

  return (
    <div className="space-y-8">
      <div
        id="common"
        className="bg-gradient-to-r from-blue-50 to-green-50 border-l-4 border-blue-600 rounded-lg p-6 mb-8 shadow-sm"
      >
        <h3 className="text-3xl font-bold text-gray-900 flex items-center justify-start gap-3">
          <span className="text-4xl">{sectionData?.icon}</span>
          <span>{sectionData?.label}</span>
        </h3>
      </div>
      {facilities.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">共用施設データがありません。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {facilities.map((facility) => (
            <div
              key={facility.id}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-200"
            >
              <div className="h-48 bg-gradient-to-br from-blue-400 to-green-600 flex items-center justify-center relative">
                {facility.image ? (
                  <Image
                    src={facility.image.url}
                    alt={facility.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    unoptimized
                  />
                ) : (
                  <div className="text-6xl text-white opacity-80">
                    {facility.icon || '🏢'}
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  {facility.icon && (
                    <div className="text-2xl">{facility.icon}</div>
                  )}
                  <h4 className="text-xl font-bold text-gray-900">
                    {facility.title}
                  </h4>
                </div>
                <p className="text-gray-600 mb-4 leading-relaxed">
                  {facility.description}
                </p>
                <div
                  className="text-gray-600 mb-4 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: facility.body }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
