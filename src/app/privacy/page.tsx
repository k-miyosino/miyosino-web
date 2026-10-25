import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'プライバシーポリシー | かわつる三芳野団地',
  description:
    'かわつる三芳野団地のプライバシーポリシー。個人情報の取り扱いについて説明します。',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヒーローセクション */}
      <section className="bg-gradient-to-r from-green-600 to-blue-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            プライバシーポリシー
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed">
            かわつる三芳野団地における個人情報の取り扱いについて
          </p>
        </div>
      </section>

      {/* メインコンテンツ */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
          <div className="prose prose-lg max-w-none">
            <p className="text-sm text-gray-500 mb-8">
              最終更新日:{' '}
              {new Date().toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                1. 個人情報の収集について
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                かわつる三芳野団地（以下「当団地」といいます）は、お問い合わせフォームを通じて以下の個人情報を収集することがあります。
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li>お名前</li>
                <li>メールアドレス</li>
                <li>電話番号</li>
                <li>お問い合わせ内容</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                2. 個人情報の利用目的
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                当団地は、収集した個人情報を以下の目的で利用します。
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li>お問い合わせへの回答</li>
                <li>団地に関する情報のご提供</li>
                <li>サービス向上のための分析</li>
                <li>重要な通知の送付</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                3. 個人情報の管理
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                当団地は、個人情報を適切に管理し、以下の措置を講じます。
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li>
                  個人情報への不正アクセス、紛失、破壊、改ざん、漏えいの防止
                </li>
                <li>個人情報保護に関する法令等の遵守</li>
                <li>適切な安全管理措置の実施</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                4. 個人情報の第三者提供
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                当団地は、以下の場合を除き、個人情報を第三者に提供することはありません。
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li>ご本人の同意がある場合</li>
                <li>法令に基づく場合</li>
                <li>人の生命、身体又は財産の保護のために必要がある場合</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                5. 個人情報の開示・訂正・削除
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                ご本人は、当団地に対して個人情報の開示、訂正、削除を請求することができます。
                ご請求の際は、お問い合わせフォームよりご連絡ください。
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                6. Cookie（クッキー）について
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                当サイトでは、サービスの向上のためにCookieを使用することがあります。
                Cookieは、お客様のブラウザに保存される小さなテキストファイルです。
                お客様はブラウザの設定により、Cookieの受け入れを拒否することができます。
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                7. お問い合わせ
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                プライバシーポリシーに関するお問い合わせは、
                <Link
                  href="/contact"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  お問い合わせページ
                </Link>
                よりご連絡ください。
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                8. プライバシーポリシーの変更
              </h2>
              <p className="text-gray-700 leading-relaxed">
                当団地は、必要に応じて本プライバシーポリシーを変更することがあります。
                変更後のプライバシーポリシーは、本ページに掲載した時点で効力を生じるものとします。
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
