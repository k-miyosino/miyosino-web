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
  // 静的エクスポート時のRSCプリフェッチエラーを防ぐ
  experimental: {
    // RSCプリフェッチを無効化（静的エクスポートでは不要）
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Docker環境でのホットリロード対応（開発時のみ）
  webpack: (config, { isServer, dev }) => {
    // ファイル監視設定を強化（Windows Docker対応）
    config.watchOptions = {
      poll: 1000, // 1秒ごとにファイル変更をチェック
      aggregateTimeout: 300, // 変更検知後300ms待ってからリロード
      ignored: /node_modules/, // node_modulesは監視対象外
    };

    // WSL2環境でのwebpackキャッシュエラー対策
    if (dev && !isServer) {
      // 開発環境のクライアント側でキャッシュを無効化（WSL2のファイルシステム問題を回避）
      config.cache = false;
    }

    return config;
  },
};

export default nextConfig;
