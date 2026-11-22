import type { NextConfig } from 'next';

const basePath = process.env.BASE_PATH_OVERRIDE
  ?? (process.env.NODE_ENV === 'production' ? '/miyosino-web' : '');

// 環境変数として公開（クライアント側で使用可能）
process.env.NEXT_PUBLIC_BASE_PATH = basePath;

const nextConfig: NextConfig = {
  // 開発時は静的エクスポートを無効化（HMRとAPIルートを有効にするため）
  ...(process.env.NODE_ENV === 'production' && { output: 'export' }),
  trailingSlash: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.microcms.io',
      },
      {
        protocol: 'https',
        hostname: 'images.microcms.io',
      },
      {
        protocol: 'https',
        hostname: '**.microcms-assets.io',
      },
    ],
  },
  basePath,
  assetPrefix: basePath,
  // Next.js 16 から、dev とビルドは Turbopack で動く。webpack の設定があると next build が失敗するので置かない。
  // Docker で開発するときだけ、docker-compose.yml で `next dev --webpack` を使い、
  // ファイル監視は WATCHPACK_POLLING（変更を一定間隔で見に行く）に任せる
};

export default nextConfig;
