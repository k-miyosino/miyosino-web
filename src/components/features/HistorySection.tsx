'use client';

import { useState, useEffect } from 'react';
import { featuresSections } from './data';
import { fetchHistoryEvents } from '@/repositories/kintone/historyRepository';
import type { HistoryYearGroup } from '@/types/history';

export function HistorySection() {
  const sectionMeta = featuresSections.find((s) => s.id === 'history');
  const [historyData, setHistoryData] = useState<HistoryYearGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await fetchHistoryEvents();
        setHistoryData(data);
      } catch (err) {
        console.error('団地のあゆみの取得に失敗しました:', err);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, []);

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
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-600 rounded-lg p-6 shadow-sm">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-start gap-3">
              <span className="text-4xl">{sectionMeta.icon}</span>
              <span>{sectionMeta.title}</span>
            </h2>
          </div>
        </div>

        {/* 団地のあゆみ */}
        <div className="mx-auto mt-16 max-w-4xl">
          {loading ? (
            <p className="text-sm text-gray-500">団地のあゆみを読み込み中...</p>
          ) : historyData.length === 0 ? (
            <p className="text-sm text-gray-500">団地のあゆみの情報はありません。</p>
          ) : (
            <div className="flow-root">
              <ul role="list" className="-mb-8">
                {historyData.map((yearItem, yearIndex) => (
                  <li key={yearIndex}>
                    <div className="relative pb-8">
                      {yearIndex !== historyData.length - 1 ? (
                        <span
                          className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-green-600 flex items-center justify-center ring-8 ring-white">
                            <div className="h-4 w-4 bg-white rounded"></div>
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                          <div className="w-full">
                            <p className="text-sm text-gray-500 mb-2">
                              <span className="font-medium text-gray-900">
                                {yearItem.year}
                              </span>
                            </p>
                            {yearItem.events.map((event, eventIndex) => (
                              <div
                                key={eventIndex}
                                className={
                                  eventIndex > 0
                                    ? 'mt-3 pt-3 border-t border-gray-100'
                                    : ''
                                }
                              >
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <p className="text-sm font-semibold text-gray-900">
                                    {event.event}
                                  </p>
                                  {event.tag.map((t, tIndex) => (
                                    <span
                                      key={tIndex}
                                      className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                  {event.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
