import { CommunitySection } from '@/components/community';
import { TableOfContents } from '@/components/community/TableOfContents';

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
