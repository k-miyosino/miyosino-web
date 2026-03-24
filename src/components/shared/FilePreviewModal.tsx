'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchFileBlob, downloadFile, FileDownloadEndpoint } from '@/shared/utils/fileDownload';

interface FilePreviewModalProps {
  fileKey: string;
  fileName: string;
  endpoint: FileDownloadEndpoint;
  contentType?: string;
  onClose: () => void;
}

export default function FilePreviewModal({
  fileKey,
  fileName,
  endpoint,
  contentType: contentTypeHint,
  onClose,
}: FilePreviewModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [resolvedContentType, setResolvedContentType] = useState<string>(contentTypeHint || '');
  const [downloading, setDownloading] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  // フェードインアニメーション
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // ファイルをフェッチ
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const { blob, contentType } = await fetchFileBlob(fileKey, endpoint);
        if (cancelled) return;

        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setResolvedContentType(contentType);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'ファイルの取得に失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [fileKey, endpoint]);

  // クリーンアップ: blob URL を解放
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  // Escape キーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  // スクロール禁止
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function handleClose() {
    setIsVisible(false);
    setTimeout(onClose, 300);
  }

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadFile(fileKey, fileName, endpoint);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ダウンロードに失敗しました';
      alert(msg);
    } finally {
      setDownloading(false);
    }
  }

  const isPdf = resolvedContentType.startsWith('application/pdf');
  const isImage = resolvedContentType.startsWith('image/');
  const canPreview = isPdf || isImage;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`relative bg-white rounded-lg shadow-xl flex flex-col w-full max-w-4xl transition-transform duration-300 ${
          isVisible ? 'scale-100' : 'scale-95'
        }`}
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 truncate pr-4">{fileName}</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="閉じる"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
              <p className="text-sm text-gray-500">読み込み中...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 px-6">
              <p className="text-sm text-red-600">{error}</p>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {downloading ? 'ダウンロード中...' : 'ダウンロードして開く'}
              </button>
            </div>
          ) : !canPreview ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 px-6">
              <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-gray-500 text-center">
                このファイル形式はブラウザでプレビューできません
              </p>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {downloading ? 'ダウンロード中...' : 'ダウンロードして開く'}
              </button>
            </div>
          ) : isPdf ? (
            <iframe
              src={blobUrl!}
              className="w-full"
              style={{ height: 'calc(90vh - 130px)' }}
              title={fileName}
            />
          ) : (
            <div className="flex items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={blobUrl!} alt={fileName} className="max-w-full max-h-[calc(90vh-160px)] object-contain" />
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && (
          <div className="px-6 py-3 border-t border-gray-200 flex justify-end flex-shrink-0">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {downloading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              {downloading ? 'ダウンロード中...' : 'ダウンロード'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
