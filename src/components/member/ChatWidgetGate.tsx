'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AUTH_CHANGE_EVENT, hasValidToken } from '@/shared/utils/auth';
import ChatWidget from './ChatWidget';

/**
 * サイト全体（layout.tsx）に置き、ログインしているときだけチャット欄を出す。
 * 公開ページでも組合員専用ページでも、ログインした組合員は質問できる。
 * ログインしていない人には何も出さない（ログイン画面へは飛ばさない）。
 *
 * 次のときに確かめ直す: ページを移ったとき、ログインの状態が変わったとき（ログイン直後、自動のログインの更新、
 * ログアウト）、別のタブでログイン・ログアウトしたとき。
 */
export default function ChatWidgetGate() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const check = () => setIsLoggedIn(hasValidToken());
    check();
    window.addEventListener(AUTH_CHANGE_EVENT, check);
    window.addEventListener('storage', check);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, check);
      window.removeEventListener('storage', check);
    };
  }, [pathname]);

  return isLoggedIn ? <ChatWidget /> : null;
}
