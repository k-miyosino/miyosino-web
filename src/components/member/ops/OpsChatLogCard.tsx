'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import ChatAnswer from '@/components/member/ChatAnswer';
import { findSitePage } from '@/shared/constants/sitePages';

/** 質問ログ1件（「わからなかった」の一覧でも使う） */
export interface OpsChatLogItem {
  at: string; // 日本時間 'YYYY-MM-DD HH:MM:SS'
  page: string;
  question: string | null;
  answer: string | null;
  refused?: boolean;
}

// '2026-11-22 14:05:33' → '11/22 14:05'
function shortTime(at: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2}) (\d{2}:\d{2})/.exec(at);
  return match ? `${Number(match[1])}/${Number(match[2])} ${match[3]}` : at;
}

// 質問したページの名前（sitePages.ts にないページはパスのまま）
function pageName(page: string): string {
  if (!page) return 'ページ不明';
  return findSitePage(page)?.names[0] ?? page;
}

const COLLAPSED_LINES = 4;

/**
 * 質問ログのカード。上に日時とページ、質問は吹き出し、答えは組合員がチャットで見たのと同じ見た目
 * （ChatAnswer。パスはページ名のリンクになる）。長い答えは4行までたたむ
 */
export default function OpsChatLogCard({
  item,
}: Readonly<{ item: OpsChatLogItem }>) {
  const answerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  // たたんだ状態で答えがはみ出しているときだけ「続きを読む」を出す
  useLayoutEffect(() => {
    const el = answerRef.current;
    if (el && !expanded) setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [item.answer, expanded]);

  return (
    <article className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <header className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <time dateTime={item.at.replace(' ', 'T')}>{shortTime(item.at)}</time>
        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
          {pageName(item.page)}
        </span>
        {item.refused && (
          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-medium">
            断った
          </span>
        )}
      </header>

      <p className="bg-gray-100 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 whitespace-pre-wrap">
        {item.question ?? '（質問ログなし）'}
      </p>

      {item.answer && (
        <div>
          <div
            ref={answerRef}
            className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap overflow-hidden"
            style={
              expanded
                ? undefined
                : {
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: COLLAPSED_LINES,
                  }
            }
          >
            <ChatAnswer text={item.answer} />
          </div>
          {(overflowing || expanded) && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-xs text-blue-700 hover:text-blue-900"
            >
              {expanded ? 'たたむ' : '続きを読む'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
