import type { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/shared/constants';

// 静的エクスポートで robots.txt を生成するため
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const { url, basePath } = SITE_CONFIG;

  return {
    rules: {
      userAgent: '*',
      allow: `${basePath}/`,
      // 組合員専用ページと認証処理は検索対象外
      disallow: [`${basePath}/member/`, `${basePath}/auth/`],
    },
    sitemap: `${url}${basePath}/sitemap.xml`,
  };
}
