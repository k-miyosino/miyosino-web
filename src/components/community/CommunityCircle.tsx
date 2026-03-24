'use client';

import { useState, useEffect } from 'react';
import type { ResidentCircle } from '@/types/community';
import {
  fetchSportsCircles,
  fetchCultureCircles,
} from '@/repositories/microcms/contentRepository';
import { communitySections } from './data';

export default function CommunityCircle() {
  const [sportsCircles, setSportsCircles] = useState<ResidentCircle[]>([]);
  const [cultureCircles, setCultureCircles] = useState<ResidentCircle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCircles = async () => {
      try {
        setLoading(true);
        const [sports, culture] = await Promise.all([
          fetchSportsCircles(),
          fetchCultureCircles(),
        ]);
        setSportsCircles(sports);
        setCultureCircles(culture);
      } catch (error) {
        console.error('[CommunityCircle] 住民サークルデータ取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCircles();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
          住人サークル紹介
        </h3>
        <div className="text-center py-8">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  const categories = [
    { name: 'スポーツ・運動', circles: sportsCircles },
    { name: '文化活動', circles: cultureCircles },
  ];

  const sectionData = communitySections.find((s) => s.id === 'circles');

  return (
    <div className="space-y-8">
      <div
        id="circles"
        className="bg-gradient-to-r from-blue-50 to-green-50 border-l-4 border-blue-600 rounded-lg p-6 mb-8 shadow-sm"
      >
        <h3 className="text-3xl font-bold text-gray-900 flex items-center justify-start gap-3">
          <span className="text-4xl">{sectionData?.icon}</span>
          <span>{sectionData?.label}</span>
        </h3>
      </div>

      {/* サークル活動の説明 */}
      <div className="bg-blue-50 rounded-lg p-6 mb-8 border border-blue-200">
        <p className="text-gray-700 leading-relaxed mb-4">
          私たちの団地生活をより楽しく、快適に過ごすために、有志の方々により、いろいろなサークルが結成されています。教養、趣味、体力増強を目的にサークル活動が活発に行われています。
        </p>
      </div>

      {/* 分類別に表示 */}
      {categories.map(({ name, circles }) => {
        if (circles.length === 0) return null;

        return (
          <div key={name} className="mb-12">
            <h4 className="text-xl font-bold text-gray-900 mb-6 pb-2 border-b-2 border-green-600">
              {name}
            </h4>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
              {circles.map((circle) => (
                <div
                  key={circle.id}
                  className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  {circle.icon && (
                    <div className="text-2xl mr-4">{circle.icon}</div>
                  )}
                  <div className="flex-1">
                    <span className="text-lg font-medium text-gray-900">
                      {circle.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
