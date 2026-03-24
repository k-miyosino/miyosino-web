'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { CommunityActivity } from '@/types/community';
import { fetchCommunityActivities } from '@/repositories/microcms/contentRepository';
import { communitySections } from './data';

export default function CommunityActivities() {
  const [activities, setActivities] = useState<CommunityActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActivities = async () => {
      try {
        setLoading(true);
        const data = await fetchCommunityActivities();
        setActivities(data);
      } catch (error) {
        console.error(
          '[CommunityActivities] 自治会活動データ取得エラー:',
          error
        );
      } finally {
        setLoading(false);
      }
    };

    loadActivities();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
          自治会活動
        </h3>
        <div className="text-center py-8">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  const sectionData = communitySections.find((s) => s.id === 'activities');

  return (
    <div className="space-y-8">
      <div
        id="activities"
        className="bg-gradient-to-r from-green-50 to-blue-50 border-l-4 border-green-600 rounded-lg p-6 mb-8 shadow-sm"
      >
        <h3 className="text-3xl font-bold text-gray-900 flex items-center justify-start gap-3">
          <span className="text-4xl">{sectionData?.icon}</span>
          <span>{sectionData?.label}</span>
        </h3>
      </div>

      {/* 自治会活動の説明 */}
      <div className="bg-green-50 rounded-lg p-6 mb-8 border border-green-200">
        <p className="text-gray-700 leading-relaxed">
          私たちのかわつる三芳野団地を、より楽しく、快適で、安全な街にするため、居住者の地域生活の向上や良好なコミュニティの形成、そして居住者相互間のコミュニケーションや秩序維持のために、様々な自治会活動を行っています。ここでは、その活動内容をご紹介します。
        </p>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">自治会活動データがありません。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-8 border border-gray-200"
            >
              <div className="flex items-start space-x-4">
                {activity.icon && (
                  <div className="text-4xl">{activity.icon}</div>
                )}
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-gray-900 mb-3">
                    {activity.title}
                  </h4>
                  <div
                    className="text-gray-600 mb-4 leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: activity.body }}
                  />
                  {/* 画像表示（bodyの下） */}
                  {activity.image && (
                    <div className="w-full h-64 relative rounded-lg overflow-hidden mt-4">
                      <Image
                        src={activity.image.url}
                        alt={activity.title || '自治会活動の画像'}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        unoptimized
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
