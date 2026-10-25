import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ページが見つかりません | かわつる三芳野団地',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-20">
      <div className="max-w-2xl text-center">
        <p className="text-6xl font-bold text-green-600 mb-4">404</p>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          ページが見つかりません
        </h1>
        <p className="text-gray-700 leading-relaxed mb-8">
          お探しのページは移動または削除されたか、URLが間違っている可能性があります。
          <br />
          お手数ですが、トップページまたはサイトマップからお探しください。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors duration-200"
          >
            トップページへ戻る
          </Link>
          <Link
            href="/sitemap"
            className="bg-white text-green-700 border border-green-600 px-6 py-3 rounded-lg font-medium hover:bg-green-50 transition-colors duration-200"
          >
            サイトマップを見る
          </Link>
        </div>
      </div>
    </div>
  );
}
