/**
 * ページの一覧（sitePages.ts）: チャットの案内・答えのリンク・サイトマップがここから作られるので、崩れていないかを確かめる
 */

import { describe, expect, it } from 'vitest';
import { PUBLIC_PAGES } from './index';
import { PUBLIC_SITE_PAGES, SITE_PAGES, findSitePage } from './sitePages';

describe('SITE_PAGES', () => {
  it('パスは「/」で始まり、末尾に「/」を付けず、重ならない', () => {
    const paths = SITE_PAGES.map((page) => page.path);
    for (const path of paths) {
      expect(path).toMatch(/^\/[a-z0-9/-]*$/);
      if (path !== '/') expect(path.endsWith('/')).toBe(false);
    }
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('どのページにも呼び方が1つ以上ある（チャットのリンクの名前になる）', () => {
    for (const page of SITE_PAGES) {
      expect(page.names.length).toBeGreaterThan(0);
    }
  });

  it('組合員専用ページ（/member）は公開のページに入らない（サイトマップに載せない）', () => {
    expect(
      PUBLIC_SITE_PAGES.some((page) => page.path.startsWith('/member'))
    ).toBe(false);
    expect(PUBLIC_PAGES.some((path) => path.startsWith('/member'))).toBe(false);
  });

  it('運用ダッシュボード（/member/ops）は一覧に入れない（チャットに案内させない）', () => {
    expect(findSitePage('/member/ops')).toBeUndefined();
  });

  it('事務員専用ページ（/member/office）は一覧に入れない（チャットに案内させない）', () => {
    expect(findSitePage('/member/office')).toBeUndefined();
  });
});

describe('findSitePage', () => {
  it('末尾の「/」は無視して探す', () => {
    expect(findSitePage('/contact/')?.path).toBe('/contact');
    expect(findSitePage('/contact///')?.path).toBe('/contact');
    expect(findSitePage('/')?.path).toBe('/');
  });

  it('一覧にないパスは undefined', () => {
    expect(findSitePage('/no-such-page')).toBeUndefined();
  });
});
