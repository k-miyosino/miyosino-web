/**
 * サイトのページの一覧（ページを追加・削除・改名したら、ここだけを直す）
 *
 * ここから次のものを作る:
 * - サイトマップ（sitemap.xml）に載せるページ: 公開（public）のページ
 * - チャットの答えでリンクにするページと呼び方: すべてのページ（src/components/member/ChatAnswer.tsx）
 * - チャットの案内文のページ一覧: すべてのページ（workers/api/chat-guide.ts）
 * - チャットが中身を読んでよいページ: 公開（public）のページだけ（workers/api/_chat-knowledge.ts）
 *
 * 組合員専用（member）のページの中身は、チャットから読まない。
 * 組合員向けの情報を Anthropic 社（チャットの AI）に送ることについて、承認を得ていないため。
 * 公開のページは、公開しているサイトの HTML を読む（ページの文章を直して公開すれば、チャットの知識も同じになる）。
 *
 * このファイルは Worker（workers/api/）からも読み込むので、ほかのファイルを読み込まないこと。
 */

/** HTML 以外から足す中身（画面が表示されてから読み込むため、HTML に入っていないもの） */
export type SitePageExtraContent =
  | 'microcms:community-activities'
  | 'microcms:community-circle-sports'
  | 'microcms:community-circle-culture'
  | 'microcms:facility'
  | 'microcms:service'
  | 'microcms:season'
  | 'places'
  | 'history';

export interface SitePage {
  /** パス（末尾の「/」なし。ホームは「/」） */
  path: string;
  /** 呼び方。先頭がページ名。チャットの答えでこの呼び方のあとにパスがあれば、呼び方をリンクにする */
  names: readonly string[];
  /** ページの説明（チャットの案内文に載せる） */
  description: string;
  /** public: だれでも見られる（チャットが中身を読む）／member: 組合員専用（チャットは中身を読まない） */
  visibility: 'public' | 'member';
  /** HTML 以外から足す中身（公開のページだけ） */
  extraContent?: readonly SitePageExtraContent[];
}

export const SITE_PAGES: readonly SitePage[] = [
  // ---- 公開ページ ----
  {
    path: '/',
    names: ['ホーム', 'トップページ'],
    description: 'トップページ',
    visibility: 'public',
  },
  {
    path: '/features',
    names: ['団地の特長', '団地の特徴'],
    description:
      'かわつる三芳野団地の魅力の紹介（基本情報、運営体制、修繕、耐震性能、災害リスク情報、団地の四季、団地のあゆみ）',
    visibility: 'public',
    extraContent: ['microcms:season', 'history'],
  },
  {
    path: '/community',
    names: ['コミュニティ'],
    description: '団地内のコミュニティ活動の紹介（自治会活動、住民サークル）',
    visibility: 'public',
    extraContent: [
      'microcms:community-activities',
      'microcms:community-circle-sports',
      'microcms:community-circle-culture',
    ],
  },
  {
    path: '/facilities',
    names: ['共有施設・サービス', '共用施設・サービス'],
    description: '集会所や公園などの施設と、団地のサービスの案内',
    visibility: 'public',
    extraContent: ['microcms:facility', 'microcms:service'],
  },
  {
    path: '/surrounding',
    names: ['周辺施設'],
    description: '団地周辺のスーパーや病院などの施設の情報',
    visibility: 'public',
    extraContent: ['places'],
  },
  {
    path: '/access',
    names: ['アクセス'],
    description: '団地への交通アクセス（電車・バス・車、駐車場）',
    visibility: 'public',
  },
  {
    path: '/contact',
    names: ['お問い合わせページ', 'お問い合わせ'],
    description: '質問や相談を送るフォームと、電話でのお問い合わせ',
    visibility: 'public',
  },
  {
    path: '/privacy',
    names: ['プライバシーポリシー'],
    description: '個人情報の取り扱い（このチャットでの扱いを含む）',
    visibility: 'public',
  },
  {
    path: '/sitemap',
    names: ['サイトマップ'],
    description: '全ページの一覧',
    visibility: 'public',
  },

  // ---- 組合員専用ページ（ログインが必要。チャットは中身を読まない） ----
  {
    path: '/member',
    names: ['組合員専用ページのトップ', '組合員専用ページ'],
    description: '最新のお知らせが表示される',
    visibility: 'member',
  },
  {
    path: '/member/announcements',
    names: ['お知らせ'],
    description:
      '組合員向けのお知らせの一覧。年と月で絞り込める。お知らせには重要度（重要・推奨・任意）が付いている。お知らせを押すと、詳しい内容と「添付ファイル」が表示される',
    visibility: 'member',
  },
  {
    path: '/member/management',
    names: ['団地運営'],
    description: '管理組合の活動や組織の説明',
    visibility: 'member',
  },
  {
    path: '/member/green-wellness',
    names: ['グリーンウェルネス'],
    description: '管理規約などの資料',
    visibility: 'member',
  },
  {
    path: '/member/circulars',
    names: ['回覧板・配布資料'],
    description: '回覧板や配布資料の一覧。カテゴリ・年・月で絞り込める',
    visibility: 'member',
  },
  {
    path: '/member/minutes',
    names: ['会議情報・議事録', '会議情報'],
    description:
      '総会や班長会などの会議の情報と議事録。カテゴリ・年・月で絞り込める',
    visibility: 'member',
  },
  {
    path: '/member/applications',
    names: ['各種申請'],
    description:
      '届出・申請書のダウンロード。印刷して記入し、管理組合事務所の窓口に持っていく。ホームページからの提出は準備中なので、提出は管理組合事務所で行う',
    visibility: 'member',
  },
  {
    path: '/member/events',
    names: ['イベント情報', 'イベント予定'],
    description:
      '団地内のイベントの予定。「一覧」と「カレンダー」の表示を切り替えられる。カテゴリと主催者で絞り込める（一覧では年・月でも絞り込める）',
    visibility: 'member',
  },
];

/** 公開のページ */
export const PUBLIC_SITE_PAGES: readonly SitePage[] = SITE_PAGES.filter(
  (page) => page.visibility === 'public'
);

/** パスからページを探す（末尾の「/」は無視する） */
export function findSitePage(path: string): SitePage | undefined {
  let end = path.length;
  while (end > 1 && path[end - 1] === '/') end--;
  const normalized = path.slice(0, end);
  return SITE_PAGES.find((page) => page.path === normalized);
}
