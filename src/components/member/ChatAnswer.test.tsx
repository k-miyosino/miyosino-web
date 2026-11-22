/**
 * チャットの答えの表示（ChatAnswer）: 答えの中のパスをページ名のリンクにする
 * AI が書いた答えをそのまま表示するので、知らないパスや見せかけのパスをリンクにしないことが大事
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ChatAnswer from './ChatAnswer';

function html(text: string): string {
  return renderToStaticMarkup(<ChatAnswer text={text} />);
}

/** 出てきたリンクの [表示, href] の一覧 */
function links(text: string): [string, string][] {
  return [
    ...html(text).matchAll(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g),
  ].map(([, href, label]) => [label, href]);
}

/** タグを除いた文字だけ */
function plain(text: string): string {
  return html(text).replace(/<[^>]+>/g, '');
}

// [何を確かめるか, 答えの文章, 出てくるリンク [表示, href], タグを除いた表示]
const CASES: [string, string, [string, string][], string][] = [
  [
    '「ページ名（/パス）」は、ページ名をリンクにして括弧を消す',
    '回覧板・配布資料（/member/circulars）で見られます。',
    [['回覧板・配布資料', '/member/circulars']],
    '回覧板・配布資料で見られます。',
  ],
  [
    'かぎ括弧で囲まれたページ名でも、中の名前だけをリンクにする',
    '「イベント情報」（/member/events）を開いてください。',
    [['イベント情報', '/member/events']],
    '「イベント情報」を開いてください。',
  ],
  [
    '括弧の直前がページ名でなければ「（開く）」のリンクにする',
    'こちら（/member/events）から見られます。',
    [['開く', '/member/events']],
    'こちら（開く）から見られます。',
  ],
  [
    '括弧のないパスは、その位置にページ名のリンクを出す',
    'お問い合わせは /contact へ',
    [['お問い合わせページ', '/contact']],
    'お問い合わせは お問い合わせページ へ',
  ],
  [
    '末尾に「/」があっても同じページとして扱う',
    '（/contact/）',
    [['開く', '/contact']],
    '（開く）',
  ],
  [
    '一覧にないパスはリンクにせず、画面からも消す',
    'くわしくは（/admin/secret）を見てください。',
    [],
    'くわしくはを見てください。',
  ],
  // 「/」を含むがパスではないもの（そのまま表示する）
  [
    '日付の「/」はパスとして扱わない',
    '2026/11/14 に開催します',
    [],
    '2026/11/14 に開催します',
  ],
  [
    '外部の URL の中の「/」はパスとして扱わない',
    'https://evil.example/contact を開いて',
    [],
    'https://evil.example/contact を開いて',
  ],
  [
    'ファイル名の中の「/」はパスとして扱わない',
    'file.pdf/contact',
    [],
    'file.pdf/contact',
  ],
];

describe('ChatAnswer', () => {
  it.each(CASES)('%s', (_, text, expectedLinks, expectedPlain) => {
    expect(links(text)).toEqual(expectedLinks);
    expect(plain(text)).toBe(expectedPlain);
  });

  it('リンクには読み上げ用の名前（〇〇を開く）が付く', () => {
    expect(html('（/contact）')).toContain(
      'aria-label="お問い合わせページを開く"'
    );
  });

  it('文字はエスケープして表示する（HTML として解釈しない）', () => {
    expect(html('<img src=x onerror=alert(1)>')).not.toContain('<img');
  });
});
