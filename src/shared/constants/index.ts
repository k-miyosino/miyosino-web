// アプリケーション全体で使用する定数
export const APP_CONFIG = {
  name: 'miyosino-web',
  version: '1.0.0',
  description: 'DDD構造を意識したNext.jsアプリケーション',
} as const;

// 公開サイトの情報（OGP・sitemap.xml・robots.txt で使用）
export const SITE_CONFIG = {
  url: 'https://k-miyosino.com',
  name: 'かわつる三芳野団地',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
} as const;

// 検索エンジンに公開するページ（sitemap.xml に掲載）
// /family/ はメニューから外しているため掲載しない（再公開時に戻す）
export const PUBLIC_PAGES = [
  '/',
  '/features/',
  '/community/',
  '/facilities/',
  '/surrounding/',
  '/access/',
  '/contact/',
  '/privacy/',
  '/sitemap/',
] as const;

export const API_ENDPOINTS = {
  users: '/api/users',
  products: '/api/products',
} as const;

export const ROUTES = {
  home: '/',
  users: '/users',
  products: '/products',
} as const;
