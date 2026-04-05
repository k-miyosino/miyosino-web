'use client';

import { useEffect, useState, useRef, ReactNode } from 'react';
import {
  getToken,
  redirectToLogin,
  handleAuthCallback,
  silentRefresh,
} from '@/shared/utils/auth';

interface MemberAuthWrapperProps {
  children: ReactNode;
}

const ANNOUNCEMENTS_API_ENDPOINT =
  process.env.NEXT_PUBLIC_ANNOUNCEMENTS_API_URL ||
  'https://miyosino-announcements.anorimura-miyosino.workers.dev';

export default function MemberAuthWrapper({
  children,
}: MemberAuthWrapperProps) {
  const [isLoading, setIsLoading] = useState(true);
  const hasCheckedAuth = useRef(false);

  useEffect(() => {
    if (hasCheckedAuth.current) return;
    hasCheckedAuth.current = true;

    async function verifyAuth() {
      // URLからトークンを取得してlocalStorageに保存（認証後のリダイレクト時）
      const tokenSaved = handleAuthCallback();
      if (tokenSaved) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // トークンが存在するか確認
      let token = getToken();
      if (!token) {
        // JWTがない場合、リフレッシュトークンでサイレント更新を試みる
        console.log('[MemberAuthWrapper] No token, attempting silent refresh...');
        const refreshed = await silentRefresh();
        if (!refreshed) {
          console.log('[MemberAuthWrapper] Silent refresh failed, redirecting to login');
          redirectToLogin();
          return;
        }
        token = getToken();
        if (!token) {
          redirectToLogin();
          return;
        }
      }

      // 実際のAPIエンドポイントで認証を確認（軽量なリクエスト）
      try {
        const response = await fetch(
          `${ANNOUNCEMENTS_API_ENDPOINT}/announcements/years`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            console.log('[MemberAuthWrapper] 401 error, attempting silent refresh...');
            // 401の場合、すぐにトークンを削除せずリフレッシュを試みる
            const refreshed = await silentRefresh();
            if (refreshed) {
              // リフレッシュ成功：認証済みとして続行
              console.log('[MemberAuthWrapper] Silent refresh successful after 401');
              setIsLoading(false);
              return;
            }
            // リフレッシュも失敗した場合のみトークンを削除してログイン画面へ
            if (typeof window !== 'undefined') {
              localStorage.removeItem('auth_token');
              localStorage.removeItem('auth_refresh_token');
            }
            redirectToLogin();
            return;
          }
          // 401以外のエラーは無視して続行（サーバーエラーの可能性）
          console.warn(
            '[MemberAuthWrapper] API error:',
            response.status,
            response.statusText
          );
        }

        // 認証成功
        setIsLoading(false);
      } catch (error) {
        console.error('[MemberAuthWrapper] Auth verification error:', error);
        // ネットワークエラーの場合も続行（一時的な障害の可能性）
        setIsLoading(false);
      }
    }

    verifyAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">認証状態を確認中...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
