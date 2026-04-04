import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* ロゴと説明 */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                <Image
                  src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/icon-miyosino.png`}
                  alt="かわつる三芳野団地"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                  unoptimized
                />
              </div>
              <span className="text-xl font-bold">かわつる三芳野団地</span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              かわつる三芳野団地へようこそ。
              <br />
              埼玉県川越市、武蔵野台地の北端で、豊かな緑に包まれた団地空間です。
            </p>
          </div>

          {/* クイックリンク */}
          <div>
            <h3 className="text-lg font-semibold mb-4">クイックリンク</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-gray-300 hover:text-green-600 text-sm transition-colors"
                >
                  ホーム
                </Link>
              </li>
              <li>
                <Link
                  href="/features"
                  className="text-gray-300 hover:text-green-600 text-sm transition-colors"
                >
                  特徴
                </Link>
              </li>
              <li>
                <Link
                  href="/community"
                  className="text-gray-300 hover:text-green-600 text-sm transition-colors"
                >
                  コミュニティ
                </Link>
              </li>
              <li>
                <Link
                  href="/facilities"
                  className="text-gray-300 hover:text-green-600 text-sm transition-colors"
                >
                  共有施設・サービス
                </Link>
              </li>
              <li>
                <Link
                  href="/surrounding"
                  className="text-gray-300 hover:text-green-600 text-sm transition-colors"
                >
                  周辺施設
                </Link>
              </li>
              <li>
                <Link
                  href="/access"
                  className="text-gray-300 hover:text-green-600 text-sm transition-colors"
                >
                  アクセス
                </Link>
              </li>
            </ul>
          </div>

          {/* その他 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">その他</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/member"
                  className="text-gray-300 hover:text-blue-400 text-sm transition-colors flex items-center"
                >
                  <svg
                    className="w-4 h-4 mr-1"
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
                  組合員専用ページ
                </Link>
              </li>
              <li>
                <Link
                  href="/sitemap"
                  className="text-gray-300 hover:text-green-600 text-sm transition-colors"
                >
                  サイトマップ
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-gray-300 hover:text-green-600 text-sm transition-colors"
                >
                  プライバシーポリシー
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-gray-300 hover:text-green-600 text-sm transition-colors"
                >
                  お問い合わせ
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* コピーライト */}
        <div className="border-t border-gray-700 mt-8 pt-8 text-center">
          <p className="text-gray-400 text-sm">
            © 2026 かわつる三芳野団地管理組合法人. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
