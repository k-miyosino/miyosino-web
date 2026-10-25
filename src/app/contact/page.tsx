import {
  // ContactFormSection, // 一時的に非表示
  PhoneContactSection,
  // TableOfContents, // 一時的に非表示
} from '@/components/contact';

export const metadata = {
  title: 'お問い合わせ | かわつる三芳野団地',
  description:
    'かわつる三芳野団地へのお問い合わせはこちら。お電話でご連絡いただけます。',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヒーローセクション */}
      <section className="bg-gradient-to-r from-green-600 to-blue-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">お問い合わせ</h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed">
            かわつる三芳野団地についてご質問やご相談がございましたら、
            <br />
            お気軽にお問い合わせください
          </p>
        </div>
      </section>

      {/* サブヘッダー（一時的に非表示） */}
      {/* <TableOfContents /> */}

      {/* 電話でのお問い合わせ */}
      <section className="py-12 lg:py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <PhoneContactSection />
        </div>
      </section>

      {/* お問い合わせフォーム（一時的に非表示） */}
      {/* <section className="py-12 lg:py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ContactFormSection />
        </div>
      </section> */}
    </div>
  );
}
