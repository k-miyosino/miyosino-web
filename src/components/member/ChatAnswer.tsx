'use client';

import Link from 'next/link';
import { Fragment, ReactNode } from 'react';

/**
 * チャットの答えの中でリンクにしてよいページ（サイトにある決まったページだけ）。
 * AI が一覧にないパスを書いてもリンクにはしない。ページを追加・削除したら、
 * 案内文（workers/api/chat-guide.ts）といっしょにここも直す。
 */
export const CHAT_LINK_PAGES: Readonly<Record<string, string>> = {
  '/': 'ホーム',
  '/features': '団地の特長',
  '/community': 'コミュニティ',
  '/facilities': '共有施設・サービス',
  '/surrounding': '周辺施設',
  '/access': 'アクセス',
  '/contact': 'お問い合わせ',
  '/privacy': 'プライバシーポリシー',
  '/sitemap': 'サイトマップ',
  '/member': '組合員専用ページ',
  '/member/announcements': 'お知らせ',
  '/member/management': '団地運営',
  '/member/green-wellness': 'グリーンウェルネス',
  '/member/circulars': '回覧板・配布資料',
  '/member/minutes': '会議情報',
  '/member/applications': '各種申請',
  '/member/events': 'イベント情報',
};

// 「（/member/circulars）」のように括弧で囲んだパス（全角・半角の括弧のどちらも）
const PATH_IN_PARENS = /[（(](\/[a-z0-9/-]{0,40})[）)]/g;

function normalizePath(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

interface ChatAnswerProps {
  text: string;
  /** リンクを押したとき（チャット欄を閉じるかどうかの判断に使う） */
  onNavigate?: () => void;
}

/**
 * 答えの文章を表示する。決まったページのパスを括弧で書いた所は「（開く）」のリンクにする。
 * 改行はそのまま表示する（親の要素に whitespace-pre-wrap を付けること）。
 */
export default function ChatAnswer({ text, onNavigate }: ChatAnswerProps) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(PATH_IN_PARENS)) {
    const path = normalizePath(match[1]);
    if (!(path in CHAT_LINK_PAGES)) continue;
    const start = match.index ?? 0;
    parts.push(text.slice(last, start));
    parts.push(
      <Fragment key={start}>
        （
        <Link
          href={path}
          onClick={onNavigate}
          className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
          aria-label={`${CHAT_LINK_PAGES[path]}を開く`}
        >
          開く
        </Link>
        ）
      </Fragment>
    );
    last = start + match[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}
