'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { featuresSections } from './data';
import type { Season } from '@/types/seasons';
import { fetchSeasons } from '@/repositories/microcms/contentRepository';

export function SeasonsSection() {
  const [seasonsData, setSeasonsData] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSeasons = async () => {
      try {
        setLoading(true);
        const data = await fetchSeasons();
        const sorted = data.sort((a, b) => (a.order || 0) - (b.order || 0));
        setSeasonsData(sorted);
      } catch (error) {
        console.error('[SeasonsSection] 四季データ取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSeasons();
  }, []);

  const sectionMeta = featuresSections.find((s) => s.id === 'seasons');

  if (!sectionMeta) {
    return null;
  }

  return (
    <section
      id={sectionMeta.id}
      className="bg-white py-24 sm:py-32 scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12">
          <div className="bg-gradient-to-r from-pink-50 to-yellow-50 border-l-4 border-pink-600 rounded-lg p-6 shadow-sm">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-start gap-3">
              <span className="text-4xl">{sectionMeta.icon}</span>
              <span>{sectionMeta.title}</span>
            </h2>
            <p className="mt-4 text-lg leading-8 text-gray-600">
              かわつる三芳野団地では、四季折々の表情をお楽しみいただけます。
              季節ごとの美しい風景と、住民の皆さんとの交流の様子をご紹介します。
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 mt-16">
            <p className="text-gray-600">四季の情報を読み込み中...</p>
          </div>
        ) : seasonsData.length === 0 ? (
          <div className="text-center py-12 mt-16">
            <p className="text-gray-600">四季の情報はありません。</p>
          </div>
        ) : (
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:mx-0 lg:max-w-none lg:grid-cols-2">
            {seasonsData.map((season) => (
              <div
                key={season.id}
                className="flex flex-col items-start rounded-2xl bg-gradient-to-br from-gray-50 to-white p-8 shadow-sm ring-1 ring-gray-200 hover:shadow-md transition-shadow duration-300"
              >
                <div className="mb-6 flex items-center gap-3">
                  {season.icon && (
                    <span className="text-4xl flex-shrink-0">
                      {season.icon}
                    </span>
                  )}
                  <h3 className="text-2xl font-bold text-gray-900">
                    {season.title}
                  </h3>
                </div>
                <div
                  className="prose prose-sm max-w-none text-gray-700 leading-relaxed mb-6"
                  dangerouslySetInnerHTML={{ __html: season.body }}
                />
                {/* 画像表示（文章の後、同じ大きさ） */}
                {season.image && (
                  <div className="w-full h-64 relative rounded-lg overflow-hidden mt-4">
                    <Image
                      src={season.image.url}
                      alt={season.title || '四季の画像'}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      unoptimized
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
