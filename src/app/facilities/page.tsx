import { FacilitiesSection, TableOfContents } from '@/components/facilities';
import { pageMetadata } from '@/shared/metadata';

export const metadata = pageMetadata({
  path: '/facilities/',
  title: '共有施設・サービス | かわつる三芳野団地',
  description:
    'かわつる三芳野団地の共有施設とサービスをご紹介します。集会所や公園などの施設と、団地内で利用できるサービスを掲載しています。',
});

export default function FacilitiesPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヒーローセクション */}
      <section className="bg-gradient-to-r from-blue-600 to-green-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            共有施設・サービス
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed">
            共有施設とサービスについて紹介します。
          </p>
        </div>
      </section>

      <TableOfContents />

      {/* 共有施設・サービスセクション */}
      <FacilitiesSection />
    </div>
  );
}
