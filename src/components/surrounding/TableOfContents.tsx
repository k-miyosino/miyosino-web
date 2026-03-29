'use client';

import { useState, useEffect } from 'react';
import { surroundingCategories } from './data2';
import type { NearbyFacility } from '@/types/surrounding';
import { fetchPlaces } from '@/repositories/kintone/placesRepository';

type GroupedFacilities = {
  medicalFacilities: NearbyFacility[];
  lifeFacilities: NearbyFacility[];
  educationFacilities: NearbyFacility[];
};

export function TableOfContents() {
  const [groupedFacilities, setGroupedFacilities] = useState<GroupedFacilities>(
    {
      medicalFacilities: [],
      lifeFacilities: [],
      educationFacilities: [],
    }
  );
  const [loading, setLoading] = useState(true);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 80; // ヘッダーの高さ分オフセット
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition =
        elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  // APIからデータを取得して、データが存在するカテゴリのみを表示
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
        console.error('[TableOfContents] 周辺施設データ取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFacilities();
  }, []);

  // データがあるカテゴリのみをフィルタリング
  const categoriesWithData = surroundingCategories.filter((category) => {
    const categoryData =
      groupedFacilities[category.id as keyof GroupedFacilities];
    return Array.isArray(categoryData) && categoryData.length > 0;
  });

  // ローディング中は何も表示しない（またはローディング表示）
  if (loading) {
    return null;
  }

  // データがない場合は何も表示しない
  if (categoriesWithData.length === 0) {
    return null;
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-14 lg:top-16 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-start sm:justify-center gap-4 sm:gap-8 py-4 overflow-x-auto">
          {categoriesWithData.map((category) => (
            <button
              key={category.id}
              onClick={() => scrollToSection(category.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-green-600 transition-colors duration-200 whitespace-nowrap flex-shrink-0"
            >
              <span>{category.icon}</span>
              <span>{category.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
