import type { MetadataRoute } from 'next';
import { PUBLIC_PAGES, SITE_CONFIG } from '@/shared/constants';

// 静的エクスポートで sitemap.xml を生成するため
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const { url, basePath } = SITE_CONFIG;

  return PUBLIC_PAGES.map((page) => ({
    url: `${url}${basePath}${page}`,
  }));
}
