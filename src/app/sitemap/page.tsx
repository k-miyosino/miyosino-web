import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'サイトマップ | かわつる三芳野団地',
  description:
    'かわつる三芳野団地のサイトマップです。各ページへのリンクを一覧でご案内しています。',
};

type SitemapItem = {
  title: string;
  href: string;
  description?: string;
};

type SitemapSection = {
  title: string;
  items: SitemapItem[];
};

const sitemapData: SitemapSection[] = [
  {
    title: 'メインメニュー',
    items: [
      {
        title: 'ホーム',
        href: '/',
        description: 'トップページへ戻ります',
      },
      {
        title: '団地の特長',
        href: '/features',
        description: 'かわつる三芳野団地の魅力をご紹介します',
      },
      {
        title: 'コミュニティ',
        href: '/community',
        description: '団地内のコミュニティ活動について',
      },
      {
        title: '共有施設・サービス',
        href: '/facilities',
        description: '集会所や公園などの施設案内',
      },
      {
        title: '周辺施設',
        href: '/surrounding',
        description: '団地周辺のスーパーや病院などの施設情報',
      },
      {
        title: 'アクセス',
        href: '/access',
        description: '団地への交通アクセス',
      },
    ],
  },
  {
    title: '組合員専用ページ',
    items: [
      {
        title: 'お知らせ',
        href: '/member/announcements',
        description: '組合員向けのお知らせ一覧（要ログイン）',
      },
      {
        title: 'グリーンウェルネス',
        href: '/member/green-wellness',
        description: '管理規約のダウンロード（要ログイン）',
      },
      {
        title: '回覧板・配布資料',
        href: '/member/circulars',
        description: '回覧板や配布資料を閲覧（要ログイン）',
      },
      {
        title: '会議情報・議事録',
        href: '/member/minutes',
        description: '総会や班長会などの会議情報・議事録（要ログイン）',
      },
      {
        title: '各種申請',
        href: '/member/applications',
        description: '各種申請書の提出やダウンロード（要ログイン）',
      },
      {
        title: 'イベント予定',
        href: '/member/events',
        description: '団地内のイベントスケジュール（要ログイン）',
      },
      {
        title: '団地運営',
        href: '/member/management',
        description: '管理組合の活動や組織について（要ログイン）',
      },
    ],
  },
  {
    title: 'その他',
    items: [
      {
        title: 'お問い合わせ',
        href: '/contact',
        description: 'ご質問・ご相談はこちらから',
      },
      {
        title: 'プライバシーポリシー',
        href: '/privacy',
        description: '個人情報の取り扱いについて',
      },
      {
        title: 'サイトマップ',
        href: '/sitemap',
        description: 'このページです',
      },
    ],
  },
];

export default function SitemapPage() {
  const isMemberSection = (title: string) => title === '組合員専用ページ';

  return (
    <div className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl font-serif">
            サイトマップ
          </h1>
          <p className="mt-4 text-lg leading-8 text-gray-600">
            かわつる三芳野団地ホームページの各ページをご案内します。
          </p>
        </div>

        <div className="mt-16 space-y-12">
          {sitemapData.map((section) => (
            <div
              key={section.title}
              className="bg-gray-50 rounded-2xl p-8 shadow-sm ring-1 ring-gray-900/5"
            >
              <div className="flex items-center mb-6">
                <h2 className="text-2xl font-bold leading-7 text-gray-900 border-b-2 border-green-600 pb-2 flex-1">
                  {section.title}
                </h2>
                {isMemberSection(section.title) && (
                  <span className="ml-4 px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                    要ログイン
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group block bg-white rounded-lg p-4 hover:shadow-md transition-all border border-gray-200 hover:border-green-300"
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0 mt-1">
                        <svg
                          className="w-5 h-5 text-green-600 group-hover:text-green-700"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                      <div className="ml-3 flex-1">
                        <span className="text-base font-semibold text-gray-900 group-hover:text-green-700 transition-colors block">
                          {item.title}
                        </span>
                        {item.description && (
                          <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
