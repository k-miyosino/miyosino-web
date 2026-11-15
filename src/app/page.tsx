import Link from 'next/link';
import {
  HeroSection,
  IntroductionSection,
  FeaturesHighlightSection,
  InstagramSection,
} from '@/components/home';
import { pageMetadata } from '@/shared/metadata';

export const metadata = pageMetadata({
  path: '/',
  title: 'かわつる三芳野団地（埼玉県川越市） | Miyoshino Apartments',
  description:
    'かわつる三芳野団地（埼玉県川越市）のホームページです。東武東上線の鶴ヶ島駅から約2km、緑豊かな団地の特徴やコミュニティ活動、共有施設、周辺施設、アクセスをご紹介します。',
});

export default function Home() {
  return (
    <>
      <HeroSection />
      {/*<InstagramSection />*/}
      <IntroductionSection />
      <FeaturesHighlightSection />

      {/* さらに詳しく知るためのリンク */}
      <section className="py-16 bg-gradient-to-b from-gray-100 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-lg text-gray-700 mb-8">
            さらに詳しく知りたい方は、こちらもご覧ください
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/features"
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              特徴を見る
            </Link>
            <Link
              href="/community"
              className="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              コミュニティを見る
            </Link>
            <Link
              href="/facilities"
              className="bg-teal-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-teal-700 transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              共有施設・サービスを見る
            </Link>
            <Link
              href="/surrounding"
              className="bg-pink-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-pink-700 transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              周辺施設を見る
            </Link>
            <Link
              href="/access"
              className="bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-700 transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              アクセスを見る
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
