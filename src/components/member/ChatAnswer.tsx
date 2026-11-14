'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { SITE_PAGES } from '@/shared/constants/sitePages';

/**
 * チャットの答えの中でリンクにしてよいページと、その呼び方（サイトのページの一覧 sitePages.ts から作る）。
 * 呼び方の先頭がリンクの読み上げ名になる。答えで括弧の直前にこの呼び方があれば、その呼び方をリンクにする。
 * AI が一覧にないパスを書いてもリンクにはしない（画面からも消す）。
 */
export const CHAT_LINK_PAGES: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(SITE_PAGES.map((page) => [page.path, page.names]));

const OPEN_PARENS = new Set(['（', '(']);
const CLOSE_PARENS = new Set(['）', ')']);
const MAX_PATH_LENGTH = 40;

/** 答えの中で見つけたパス */
interface PathToken {
  /** 置き換える範囲（括弧があれば括弧を含む） */
  start: number;
  end: number;
  path: string;
  inParens: boolean;
}

function isPathChar(c: string): boolean {
  return (
    (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '/' || c === '-'
  );
}

// 括弧のないパスの直前にこれがあれば、パスではない（日付の 2026/11/14、URL の中など）
function isWordChar(c: string): boolean {
  return /[A-Za-z0-9/:._-]/.test(c);
}

// 末尾の「/」を取る（「/」だけのときはそのまま）
function normalizePath(path: string): string {
  let end = path.length;
  while (end > 1 && path[end - 1] === '/') end--;
  return path.slice(0, end);
}

/**
 * 答えの中のパスを前から順に探す。正規表現を使わず1文字ずつ見るので、長い答えでも処理が増えすぎない。
 * - 「（/member/circulars）」「(/contact)」: 括弧ごと
 * - 「/member/events」: 括弧なし（直前が英数字や「/」「:」なら当てない。「/」だけのものも当てない）
 */
function findPaths(text: string): PathToken[] {
  const tokens: PathToken[] = [];
  let i = 0;
  while (i < text.length) {
    const prev = i > 0 ? text[i - 1] : '';
    if (text[i] !== '/' || (!OPEN_PARENS.has(prev) && isWordChar(prev))) {
      i++;
      continue;
    }
    let end = i + 1;
    while (
      end < text.length &&
      end - i < MAX_PATH_LENGTH &&
      isPathChar(text[end])
    ) {
      end++;
    }
    const path = text.slice(i, end);
    if (OPEN_PARENS.has(prev) && CLOSE_PARENS.has(text[end] ?? '')) {
      tokens.push({ start: i - 1, end: end + 1, path, inParens: true });
    } else if (path.length > 1) {
      tokens.push({ start: i, end, path, inParens: false });
    }
    i = end;
  }
  return tokens;
}

// ページ名を囲むことのあるかぎ括弧（「イベント情報」（/member/events） のような答えに合わせる）
const CLOSING_QUOTES = ['」', '』'];

interface NameMatch {
  name: string;
  /** 名前のあとに付いていた閉じかぎ括弧（なければ空） */
  quote: string;
}

// 括弧の直前にあるページの呼び方（長い呼び方から照らし合わせる）。かぎ括弧で囲まれていてもよい
function nameBefore(path: string, before: string): NameMatch | undefined {
  const names = [...(CHAT_LINK_PAGES[path] ?? [])].sort(
    (a, b) => b.length - a.length
  );
  for (const quote of ['', ...CLOSING_QUOTES]) {
    const name = names.find((n) => before.endsWith(n + quote));
    if (name) return { name, quote };
  }
  return undefined;
}

interface ChatAnswerProps {
  text: string;
  /** リンクを押したとき（チャット欄を閉じるかどうかの判断に使う） */
  onNavigate?: () => void;
}

/**
 * 答えの文章を表示する。パスそのものは画面に出さない。
 * - 「回覧板・配布資料（/member/circulars）」→「回覧板・配布資料」をリンクにして括弧を消す
 *   （「イベント情報」（/member/events） のようにかぎ括弧で囲まれていても、中の名前をリンクにする）
 * - 括弧の直前がページの呼び方でなければ、括弧の位置に「（開く）」のリンクを出す
 * - 括弧のないパスは、その位置にページ名のリンクを出す
 * - 一覧にないパスは消す
 * 改行はそのまま表示する（親の要素に whitespace-pre-wrap を付けること）。
 */
export default function ChatAnswer({
  text,
  onNavigate,
}: Readonly<ChatAnswerProps>) {
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

  // 1つのパスと、その直前の文章を表示の部品にする
  const render = (token: PathToken, before: string): ReactNode[] => {
    const path = normalizePath(token.path);
    if (!(path in CHAT_LINK_PAGES)) return [before]; // 一覧にないパスは消す
    if (!token.inParens)
      return [before, link(path, CHAT_LINK_PAGES[path][0], token.start)];
    const match = nameBefore(path, before);
    if (!match) return [before, '（', link(path, '開く', token.start), '）'];
    // 名前をリンクにする（かぎ括弧があれば残し、その中の名前だけをリンクにする）
    const cut = match.name.length + match.quote.length;
    return [
      before.slice(0, before.length - cut),
      link(path, match.name, token.start),
      match.quote,
    ];
  };

  const parts: ReactNode[] = [];
  let last = 0;
  for (const token of findPaths(text)) {
    parts.push(...render(token, text.slice(last, token.start)));
    last = token.end;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}
