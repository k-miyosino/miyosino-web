import type { Metadata } from 'next';
import { SITE_CONFIG, findSitePage } from './constants';

/**
 * 組合員専用ページの中の各ページのタイトル（例:「お知らせ | 組合員専用ページ | かわつる三芳野団地」）。
 * ページ名は sitePages.ts の names[0]。sitePages.ts に無いページ（運用ダッシュボードなど）は name で渡す。
 * ページごとにタイトルを分けるのは、アクセス解析（GA の「ページ タイトル」）でページを見分けるため。
 * 組合員専用ページは robots.txt で除外しているので、説明文や正規URLは付けない。
 */
export function memberPageMetadata(path: string, name?: string): Metadata {
  const pageName = name ?? findSitePage(path)?.names[0];
  if (!pageName) {
    throw new Error(`sitePages.ts に ${path} がありません`);
  }
  return {
    title: `${pageName} | 組合員専用ページ | ${SITE_CONFIG.name}`,
  };
}

interface PageMetadataInput {
  /** ページのパス（ホームは「/」、ほかは末尾に「/」を付ける。例: '/access/'） */
  path: string;
  /** 検索結果に出るタイトル */
  title: string;
  /** 検索結果に出る説明文（全角で80〜120文字くらい） */
  description: string;
}

/**
 * 公開ページのメタデータ（タイトル・説明文・正規URL・SNSで共有したときの表示）を作る。
 * 正規URL（canonical）は、layout.tsx の metadataBase（ドメイン＋basePath）からの相対で書く。
 * www 付き・なしなど、同じページが複数のURLで見えても、検索エンジンがひとつにまとめられるようにするため。
 */
export function pageMetadata({
  path,
  title,
  description,
}: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      locale: 'ja_JP',
      siteName: SITE_CONFIG.name,
      title,
      description,
      url: path,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}
