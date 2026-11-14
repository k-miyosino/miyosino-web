'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

const navigationItems = [
  { href: '/', label: 'ホーム' },
  { href: '/features', label: '特徴' },
  { href: '/community', label: 'コミュニティ' },
  { href: '/facilities', label: '共有施設・サービス' },
  { href: '/surrounding', label: '周辺施設' },
  { href: '/access', label: 'アクセス' },
];

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 lg:h-16">
          {/* ロゴ */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center overflow-hidden">
                <Image
                  src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/icon-miyosino.png`}
                  alt="かわつる三芳野団地"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                  unoptimized
                />
              </div>
              <span className="text-lg lg:text-xl font-bold text-gray-900 tracking-wide">
                かわつる三芳野団地
              </span>
            </Link>
          </div>

          {/* デスクトップナビゲーション */}
          <nav className="hidden md:flex space-x-4 lg:space-x-6">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-gray-700 hover:text-green-600 px-2 py-2 text-xs lg:text-sm font-medium transition-colors duration-200 whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* 組合員専用ボタンとお問い合わせボタン */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
            <Link
              href="/member"
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1.5 rounded-lg text-xs lg:text-sm font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 whitespace-nowrap flex items-center"
            >
              <svg
                className="w-3 h-3 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              組合員専用
            </Link>
            <Link
              href="/contact"
              className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs lg:text-sm font-medium hover:bg-green-600 transition-colors duration-200 whitespace-nowrap"
            >
              お問い合わせ
            </Link>
          </div>

          {/* モバイルメニューボタン */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-green-600 focus:outline-none focus:text-green-600"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={
                    isMenuOpen
                      ? 'M6 18L18 6M6 6l12 12'
                      : 'M4 6h16M4 12h16M4 18h16'
                  }
                />
              </svg>
            </button>
          </div>
        </div>

        {/* モバイルメニュー */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-gray-700 hover:text-green-600 block px-3 py-2 text-base font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/member"
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-2 text-base font-medium rounded-lg mx-3 mt-4 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center"
                onClick={() => setIsMenuOpen(false)}
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                組合員専用
              </Link>
              <Link
                href="/contact"
                className="bg-green-600 text-white px-3 py-2 text-base font-medium rounded-lg mx-3 mt-2 hover:bg-green-600 transition-colors duration-200 flex items-center justify-center"
                onClick={() => setIsMenuOpen(false)}
              >
                お問い合わせ
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
