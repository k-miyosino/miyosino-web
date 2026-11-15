import {
  OverviewSection,
  OrganizationManagementSection,
  MaintenanceSection,
  SeismicSection,
  HazardMapSection,
  SeasonsSection,
  HistorySection,
} from '@/components/features';
import { TableOfContents } from '@/components/features/TableOfContents';
import { pageMetadata } from '@/shared/metadata';

export const metadata = pageMetadata({
  path: '/features/',
  title: '団地の特徴 | かわつる三芳野団地',
  description:
    'かわつる三芳野団地の特徴をご紹介します。運営体制やあゆみ、四季の様子など、団地の魅力を解説します。',
});

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヒーローセクション */}
      <section className="bg-gradient-to-r from-green-600 to-blue-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">団地の特徴</h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed">
            かわつる三芳野団地の特徴をご紹介します。
            <br />
            運営体制やあゆみ、四季の様子など、団地の魅力を解説します。
          </p>
        </div>
      </section>

      <TableOfContents />

      <OverviewSection />
      <OrganizationManagementSection />
      <MaintenanceSection />
      <SeismicSection />
      <HazardMapSection />
      <SeasonsSection />
      <HistorySection />
    </div>
  );
}
