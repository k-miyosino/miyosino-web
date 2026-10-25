import type { Metadata } from 'next';
import { Geist, Geist_Mono, Noto_Serif_JP } from 'next/font/google';
import './globals.css';
import { Header, Footer } from '@/components';
import { GoogleAnalytics } from '@/components/analytics';
import { SITE_CONFIG } from '@/shared/constants';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const notoSerifJP = Noto_Serif_JP({
  variable: '--font-noto-serif-jp',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  preload: true,
});

// Kosugi Maru は Dev Container 等で Google Fonts がタイムアウトするため削除。
// 必要なら Noto Serif JP やローカルフォントで代替可能。

const siteTitle = 'かわつる三芳野団地 | Miyoshino Apartments';
const siteDescription =
  'かわつる三芳野団地へようこそ。広々とした住空間、緑豊かな環境、そして温かいコミュニティがここにはあります。';

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  keywords: '団地, マンション, 家族, コミュニティ, 子育て, 緑豊か',
  // SNS（LINE等）で共有したときの表示（画像は後日追加予定）
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    siteName: SITE_CONFIG.name,
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: 'summary',
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSerifJP.variable} antialiased`}
      >
        <GoogleAnalytics />
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
