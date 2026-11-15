import {
  TrainAccessSection,
  CarAccessSection,
  GoogleMapSection,
  TableOfContents,
} from '@/components/access';
import { pageMetadata } from '@/shared/metadata';

export const metadata = pageMetadata({
  path: '/access/',
  title: 'アクセス | かわつる三芳野団地',
  description:
    '団地への交通アクセス情報をご紹介。電車・バス・車でのアクセス方法、駐車場情報、都心各所へのアクセス時間などを詳しく解説します。',
});

export default function AccessPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヒーローセクション */}
      <section className="bg-gradient-to-r from-green-600 to-blue-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">アクセス</h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed">
            団地への交通アクセス情報をご紹介
            <br />
            電車・バス・車でのアクセス方法、駐車場情報などを詳しく解説します
          </p>
        </div>
      </section>

      <TableOfContents />

      <GoogleMapSection />
      <TrainAccessSection />
      <CarAccessSection />
    </div>
  );
}
