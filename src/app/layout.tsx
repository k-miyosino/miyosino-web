import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Header, Footer } from '@/components';
import { GoogleAnalytics } from '@/components/analytics';
import ChatWidgetGate from '@/components/member/ChatWidgetGate';
import { SITE_CONFIG } from '@/shared/constants';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// 日本語の Web フォント（Noto Serif JP・Kosugi Maru）は読み込まない。
// 日本語フォントは文字の範囲ごとに100件以上のファイルに分かれていて、ビルドのたびに
// Google Fonts から取得するため、1件でも取れないとビルドが止まる（GitHub Actions で頻発した）。
// 明朝体（font-serif）は globals.css で端末に入っているフォントを指定している。

const siteTitle = 'かわつる三芳野団地 | Miyoshino Apartments';
const siteDescription =
  'かわつる三芳野団地（埼玉県川越市）のホームページです。広々とした住空間、緑豊かな環境、そして温かいコミュニティがここにはあります。';

export const metadata: Metadata = {
  // 正規URL（canonical）や OGP の URL を、このドメイン＋basePath からの相対で書けるようにする
  metadataBase: new URL(`${SITE_CONFIG.url}${SITE_CONFIG.basePath}/`),
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GoogleAnalytics />
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
        {/* ログインしているときだけ、どのページでも右下にチャットを出す */}
        <ChatWidgetGate />
      </body>
    </html>
  );
}
