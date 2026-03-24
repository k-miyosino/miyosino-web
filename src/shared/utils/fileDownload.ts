/**
 * ファイルダウンロード関連のユーティリティ関数
 *
 * 統一されたファイルダウンロード機能を提供
 */

import { getToken, redirectToLogin } from './auth';

export type FileDownloadEndpoint =
  | 'greenwellness'
  | 'circulars'
  | 'minutes'
  | 'applications';

/**
 * エンドポイントタイプからAPI URLを取得
 */
function getApiEndpoint(endpoint: FileDownloadEndpoint): string {
  switch (endpoint) {
    case 'greenwellness':
      return (
        process.env.NEXT_PUBLIC_GREENWELLNESS_API_URL ||
        'https://miyosino-greenwellness.anorimura-miyosino.workers.dev'
      );
    case 'circulars':
      return (
        process.env.NEXT_PUBLIC_CIRCULARS_API_URL ||
        'https://miyosino-circulars.anorimura-miyosino.workers.dev'
      );
    case 'minutes':
      return (
        process.env.NEXT_PUBLIC_MINUTES_API_URL ||
        'https://miyosino-minutes.anorimura-miyosino.workers.dev'
      );
    case 'applications':
      return (
        process.env.NEXT_PUBLIC_APPLICATIONS_API_URL ||
        'https://miyosino-applications.anorimura-miyosino.workers.dev'
      );
    default:
      throw new Error(`Unknown endpoint type: ${endpoint}`);
  }
}

/**
 * ファイルをBlobとして取得する（プレビュー用）
 *
 * @param fileKey - Kintoneのファイルキー
 * @param endpoint - エンドポイントタイプ
 * @returns blob と contentType
 * @throws エラーが発生した場合
 */
export async function fetchFileBlob(
  fileKey: string,
  endpoint: FileDownloadEndpoint
): Promise<{ blob: Blob; contentType: string }> {
  const token = getToken();
  if (!token) {
    throw new Error('認証トークンがありません');
  }

  const apiEndpoint = getApiEndpoint(endpoint);
  const url = `${apiEndpoint}/${endpoint}/file?fileKey=${encodeURIComponent(fileKey)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
      }
      redirectToLogin();
      throw new Error('認証に失敗しました');
    }
    throw new Error(`ファイルの取得に失敗しました: ${response.status}`);
  }

  const blob = await response.blob();
  const contentType =
    response.headers.get('Content-Type') ||
    blob.type ||
    'application/octet-stream';
  return { blob, contentType };
}

/**
 * ファイルをダウンロードする
 *
 * @param fileKey - Kintoneのファイルキー
 * @param fileName - ダウンロードするファイル名
 * @param endpoint - エンドポイントタイプ（greenwellness/circulars/minutes/applications）
 * @throws エラーが発生した場合
 */
export async function downloadFile(
  fileKey: string,
  fileName: string,
  endpoint: FileDownloadEndpoint
): Promise<void> {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('認証トークンがありません');
    }

    const apiEndpoint = getApiEndpoint(endpoint);
    const url = `${apiEndpoint}/${endpoint}/file?fileKey=${encodeURIComponent(fileKey)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
        }
        redirectToLogin();
        throw new Error('認証に失敗しました');
      }
      throw new Error(
        `ファイルのダウンロードに失敗しました: ${response.status}`
      );
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error(`[FileDownload] downloadFile error (${endpoint}):`, error);
    throw error;
  }
}
