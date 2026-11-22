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

describe('ChatAnswer', () => {
  it('「ページ名（/パス）」は、ページ名をリンクにして括弧を消す', () => {
    const text = '回覧板・配布資料（/member/circulars）で見られます。';
    expect(links(text)).toEqual([['回覧板・配布資料', '/member/circulars']]);
    expect(plain(text)).toBe('回覧板・配布資料で見られます。');
  });

  it('かぎ括弧で囲まれたページ名でも、中の名前だけをリンクにする', () => {
    const text = '「イベント情報」（/member/events）を開いてください。';
    expect(links(text)).toEqual([['イベント情報', '/member/events']]);
    expect(plain(text)).toBe('「イベント情報」を開いてください。');
  });

  it('括弧の直前がページ名でなければ「（開く）」のリンクにする', () => {
    const text = 'こちら（/member/events）から見られます。';
    expect(links(text)).toEqual([['開く', '/member/events']]);
    expect(plain(text)).toBe('こちら（開く）から見られます。');
  });

  it('括弧のないパスは、その位置にページ名のリンクを出す', () => {
    expect(links('お問い合わせは /contact へ')).toEqual([
      ['お問い合わせページ', '/contact'],
    ]);
  });

  it('末尾に「/」があっても同じページとして扱う', () => {
    expect(links('（/contact/）')[0][1]).toBe('/contact');
  });

  it('一覧にないパスはリンクにせず、画面からも消す', () => {
    const text = 'くわしくは（/admin/secret）を見てください。';
    expect(links(text)).toEqual([]);
    expect(plain(text)).toBe('くわしくはを見てください。');
  });

  it.each([
    ['日付', '2026/11/14 に開催します'],
    ['外部の URL', 'https://evil.example/contact を開いて'],
    ['ファイル名', 'file.pdf/contact'],
  ])('%sの中の「/」はパスとして扱わない', (_, text) => {
    expect(links(text)).toEqual([]);
    expect(plain(text)).toBe(text);
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
