import type { Metadata } from 'next';
import { Geist, Geist_Mono, Noto_Serif_JP } from 'next/font/google';
import './globals.css';
import { Header, Footer } from '@/components';
import { GoogleAnalytics } from '@/components/analytics';

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

export const metadata: Metadata = {
  title: 'かわつる三芳野団地 | Miyoshino Apartments',
  description:
    'かわつる三芳野団地へようこそ。広々とした住空間、緑豊かな環境、そして温かいコミュニティがここにはあります。',
  keywords: '団地, マンション, 家族, コミュニティ, 子育て, 緑豊か',
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
