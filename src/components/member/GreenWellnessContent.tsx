'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { GreenWellnessFile } from './data';
import { fetchGreenWellnessFiles } from '@/shared/utils/kintone';
import { redirectToLogin } from '@/shared/utils/auth';
import FileDownloadButton from '@/components/shared/FileDownloadButton';

export default function GreenWellnessContent() {
  const [files, setFiles] = useState<GreenWellnessFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchGreenWellnessFiles();
        setFiles(data);
      } catch (err) {
        console.error('[GreenWellnessContent] Failed to load files:', err);

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
          err instanceof Error ? err.message : 'ファイルの取得に失敗しました'
        );
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          回覧板・配布資料
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          回覧板や配布資料はこちらからご確認いただけます。
        </p>
        <Link
          href="/member/circulars"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          回覧板・配布資料を閲覧する
        </Link>
      </div>
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          ダウンロード資料
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
        ) : files.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-500 text-sm">
              現在、ダウンロード可能なファイルはありません。
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {files.map((file) => (
              <div
                key={file.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {file.title}
                    </h3>
                    {file.description && (
                      <p className="text-gray-600 text-sm mt-1">
                        {file.description}
                      </p>
                    )}
                  </div>
                  {file.file?.fileKey ? (
                    <div className="w-full md:w-64 mt-4 md:mt-0">
                      <FileDownloadButton
                        fileKey={file.file.fileKey}
                        fileName={file.file.name || 'download'}
                        endpoint="greenwellness"
                        fileSize={file.file.size}
                      />
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm mt-4 md:mt-0">
                      ファイルなし
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
