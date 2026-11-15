import { NearbyFacilitiesSection } from '@/components/surrounding';
import { TableOfContents } from '@/components/surrounding/TableOfContents';
import { pageMetadata } from '@/shared/metadata';

export const metadata = pageMetadata({
  path: '/surrounding/',
  title: '周辺施設 | かわつる三芳野団地',
  description:
    'かわつる三芳野団地の周辺にある公共施設や病院、スーパーなど、暮らしに役立つ施設をご紹介します。',
});

export default function SurroundingPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヒーローセクション */}
      <section className="bg-gradient-to-r from-blue-600 to-green-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">周辺施設</h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed">
            団地周辺にある公共施設や病院、主要な生活関連施設をご紹介します。
          </p>
        </div>
      </section>

      <TableOfContents />

      {/* 周辺の施設・お店セクション */}
      <NearbyFacilitiesSection />
    </div>
  );
}
