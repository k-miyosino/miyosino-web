'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { Service } from '@/types/facilities';
import { fetchServices } from '@/repositories/microcms/contentRepository';
import { facilitiesSections } from './data';

export default function ServicesSection() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadServices = async () => {
      try {
        setLoading(true);
        const data = await fetchServices();
        setServices(data);
      } catch (error) {
        console.error('[ServicesSection] サービスデータ取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    loadServices();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
          団地内のサービス
        </h3>
        <div className="text-center py-8">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  const sectionData = facilitiesSections.find(
    (s: { id: string; label: string; icon: string }) => s.id === 'services'
  );

  return (
    <div className="space-y-8">
      <div
        id="services"
        className="bg-gradient-to-r from-green-50 to-blue-50 border-l-4 border-green-600 rounded-lg p-6 mb-8 shadow-sm"
      >
        <h3 className="text-3xl font-bold text-gray-900 flex items-center justify-start gap-3">
          <span className="text-4xl">{sectionData?.icon}</span>
          <span>{sectionData?.label}</span>
        </h3>
      </div>
      {services.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">サービスデータがありません。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {services.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-8 border border-gray-200"
            >
              <div className="flex items-start space-x-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    {service.icon && (
                      <div className="text-2xl">{service.icon}</div>
                    )}
                    <h4 className="text-xl font-bold text-gray-900">
                      {service.title}
                    </h4>
                  </div>
                  <p className="text-gray-600 mb-4 leading-relaxed">
                    {service.description}
                  </p>
                  <div
                    className="text-gray-600 mb-4 leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: service.body }}
                  />
                  {/* 画像表示（bodyの下） */}
                  {service.image && (
                    <div className="w-full h-64 relative rounded-lg overflow-hidden mt-4">
                      <Image
                        src={service.image.url}
                        alt={service.title || 'サービスの画像'}
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
