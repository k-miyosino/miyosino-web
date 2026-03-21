'use client';

import { useState, useEffect } from 'react';
import { fetchApplications, Application } from '@/shared/utils/kintone';
import { redirectToLogin } from '@/shared/utils/auth';
import FileDownloadButton from '@/components/shared/FileDownloadButton';

export default function ApplicationsContent() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadApplications = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchApplications();
        setApplications(data);
      } catch (err) {
        console.error(
          '[ApplicationsContent] Failed to load applications:',
          err
        );

        // 認証エラーの場合は即座にログインにリダイレクト
        if (err instanceof Error && err.message.includes('認証')) {
          // トークンを削除してからリダイレクト
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
          }
          redirectToLogin();
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : '届出・申請書の取得に失敗しました'
        );
        setApplications([]);
      } finally {
        setLoading(false);
      }
    };

    loadApplications();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            届出・申請書ダウンロード
          </h2>
          {loading ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-500 text-sm">読み込み中...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 rounded-lg p-8 text-center">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-500 text-sm">
                現在、ダウンロード可能な届出・申請書はありません。
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 準備中メッセージ */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-blue-700 text-sm">
                  印刷・ご記入の上、事務所窓口までお持ちください。
                </p>
              </div>
              {applications.map((application) => (
                <div
                  key={application.id}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <span className="text-gray-900">{application.title}</span>
                    {application.file?.fileKey ? (
                      <div className="w-full md:w-64">
                        <FileDownloadButton
                          fileKey={application.file.fileKey}
                          fileName={application.file.name || 'download'}
                          endpoint="applications"
                          fileSize={application.file.size}
                        />
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">
                        ファイルなし
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 opacity-60">
          <h2 className="text-xl font-bold text-gray-500 mb-4">
            届出・申請書提出
          </h2>
          <div className="space-y-4">
            {/* 準備中メッセージ */}
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-4">
              <p className="font-bold text-yellow-800 mb-2 text-sm">
                ⚠️ 準備中
              </p>
              <p className="text-yellow-700 text-sm">
                届出・申請書提出機能は現在準備中です。
                <br />
                管理組合事務所にてご提出ください。
              </p>
            </div>

            {/* 修繕 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">修繕</h3>
              <div className="space-y-2">
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">模様替え申請</span>
                    <button
                      disabled
                      className="bg-gray-400 text-white px-3 py-1 rounded-lg cursor-not-allowed text-sm"
                    >
                      申請する
                    </button>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">不具合箇所届出</span>
                    <button
                      disabled
                      className="bg-gray-400 text-white px-3 py-1 rounded-lg cursor-not-allowed text-sm"
                    >
                      届出する
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ペット */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">
                ペット
              </h3>
              <div className="space-y-2">
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">ペット飼育届出</span>
                    <button
                      disabled
                      className="bg-gray-400 text-white px-3 py-1 rounded-lg cursor-not-allowed text-sm"
                    >
                      届出する
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 共用施設 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">
                共用施設
              </h3>
              <div className="space-y-2">
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">駐車場利用申請</span>
                    <button
                      disabled
                      className="bg-gray-400 text-white px-3 py-1 rounded-lg cursor-not-allowed text-sm"
                    >
                      申請する
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* IT */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">IT</h3>
              <div className="space-y-2">
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">
                      Kintoneパスワード初期化申請
                    </span>
                    <button
                      disabled
                      className="bg-gray-400 text-white px-3 py-1 rounded-lg cursor-not-allowed text-sm"
                    >
                      申請する
                    </button>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">連絡先登録・変更申請</span>
                    <button
                      disabled
                      className="bg-gray-400 text-white px-3 py-1 rounded-lg cursor-not-allowed text-sm"
                    >
                      申請する
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
