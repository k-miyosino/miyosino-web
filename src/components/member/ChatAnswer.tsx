'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

/**
 * チャットの答えの中でリンクにしてよいページ（サイトにある決まったページだけ）と、その呼び方。
 * 呼び方の先頭がリンクの読み上げ名になる。答えで括弧の直前にこの呼び方があれば、その呼び方をリンクにする。
 * AI が一覧にないパスを書いてもリンクにはしない（画面からも消す）。ページを追加・削除したら、
 * 案内文（workers/api/chat-guide.ts）といっしょにここも直す。
 */
export const CHAT_LINK_PAGES: Readonly<Record<string, readonly string[]>> = {
  '/': ['ホーム', 'トップページ'],
  '/features': ['団地の特長', '団地の特徴'],
  '/community': ['コミュニティ'],
  '/facilities': ['共有施設・サービス'],
  '/surrounding': ['周辺施設'],
  '/access': ['アクセス'],
  '/contact': ['お問い合わせページ', 'お問い合わせ'],
  '/privacy': ['プライバシーポリシー'],
  '/sitemap': ['サイトマップ'],
  '/member': ['組合員専用ページのトップ', '組合員専用ページ'],
  '/member/announcements': ['お知らせ'],
  '/member/management': ['団地運営'],
  '/member/green-wellness': ['グリーンウェルネス'],
  '/member/circulars': ['回覧板・配布資料'],
  '/member/minutes': ['会議情報・議事録', '会議情報'],
  '/member/applications': ['各種申請'],
  '/member/events': ['イベント情報', 'イベント予定'],
};

// 括弧で囲んだパス（全角・半角の括弧）か、括弧のないパス。
// 括弧のないパスは、直前が英数字・「/」・「:」などのとき（日付の 2026/11/14 や URL の中）は当てない
const PATH_PATTERN =
  /[（(](\/[a-z0-9/-]{0,40})[）)]|(^|[^A-Za-z0-9/:._-])(\/[a-z0-9-][a-z0-9/-]{0,39})/g;

function normalizePath(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

// 長い呼び方から照らし合わせる（「お問い合わせページ」を「お問い合わせ」より先に）
function namesOf(path: string): string[] {
  return [...(CHAT_LINK_PAGES[path] ?? [])].sort((a, b) => b.length - a.length);
}

interface ChatAnswerProps {
  text: string;
  /** リンクを押したとき（チャット欄を閉じるかどうかの判断に使う） */
  onNavigate?: () => void;
}

/**
 * 答えの文章を表示する。パスそのものは画面に出さない。
 * - 「回覧板・配布資料（/member/circulars）」→「回覧板・配布資料」をリンクにして括弧を消す
 * - 括弧の直前がページの呼び方でなければ、括弧の位置に「（開く）」のリンクを出す
 * - 括弧のないパスは、その位置にページ名のリンクを出す
 * - 一覧にないパスは消す
 * 改行はそのまま表示する（親の要素に whitespace-pre-wrap を付けること）。
 */
export default function ChatAnswer({ text, onNavigate }: ChatAnswerProps) {
  const parts: ReactNode[] = [];
  let last = 0;

  const link = (path: string, label: string, key: number) => (
    <Link
      key={key}
      href={path}
      onClick={onNavigate}
      className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
      aria-label={`${CHAT_LINK_PAGES[path][0]}を開く`}
    >
      {label}
    </Link>
  );

  for (const match of text.matchAll(PATH_PATTERN)) {
    const start = match.index ?? 0;
    let before = text.slice(last, start);
    const inParens = match[1] !== undefined;
    const path = normalizePath(inParens ? match[1] : match[3]);
    const known = path in CHAT_LINK_PAGES;

    if (inParens) {
      const name = known
        ? namesOf(path).find((n) => before.endsWith(n))
        : undefined;
      if (name) {
        // 括弧の直前の呼び方をリンクにして、括弧は消す
        parts.push(before.slice(0, before.length - name.length));
        parts.push(link(path, name, start));
      } else {
        parts.push(before);
        if (known) parts.push('（', link(path, '開く', start), '）');
        // 一覧にないパスは括弧ごと消す
      }
    } else {
      // 括弧のないパス: 直前の1文字（match[2]）は残す
      before += match[2];
      parts.push(before);
      if (known) parts.push(link(path, CHAT_LINK_PAGES[path][0], start));
      // 一覧にないパスは消す
    }
    last = start + match[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}
