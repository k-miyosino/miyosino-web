import { CommunitySection } from '@/components/community';
import { TableOfContents } from '@/components/community/TableOfContents';
import { pageMetadata } from '@/shared/metadata';

export const metadata = pageMetadata({
  path: '/community/',
  title: 'コミュニティ | かわつる三芳野団地',
  description:
    'かわつる三芳野団地の自治会活動をご紹介します。団地をより楽しく、快適で、安全な街にするための、住民どうしの交流や地域生活の取り組みを掲載しています。',
});

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヒーローセクション */}
      <section className="bg-gradient-to-r from-green-600 to-blue-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">コミュニティ</h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed">
            様々な活動を通じて、
            <br />
            豊かなコミュニティを築いています
            <br />
            団地のコミュニティ活動をご紹介します
          </p>
        </div>
      </section>

      {/* コミュニティ活動セクション */}
      <CommunitySection />
    </div>
  );
}
