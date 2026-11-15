import type { Metadata } from 'next';
import { SITE_CONFIG } from './constants';

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
