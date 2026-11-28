/**
 * 広報ページのリンク集の中身（KOHO.md 4 章）。
 * ページの HTML はだれでも取得できるので、ここに書いて miyosino-koho が広報委員にだけ返す。
 * アプリ ID は、ホームページの各 Worker（announcements.ts など）が読んでいるアプリと合わせる。
 */

export interface KohoKintoneApp {
  key: string;
  name: string;
  appId: string;
  /** ホームページのどこに出るか（一文） */
  where: string;
  /** 公開・非公開の切り替え方などの注意（なければ空） */
  note: string;
  listUrl: string;
  addUrl: string;
}

export interface KohoMicrocms {
  url: string;
  /** microCMS で管理しているもの（カテゴリー）と、ホームページのどこに出るか */
  items: { name: string; where: string }[];
}

export interface KohoGuideRow {
  /** ホームページの場所 */
  area: string;
  /** どこで直すか */
  editIn: 'kintone' | 'microCMS' | 'ソース';
  /** 何を開くか */
  target: string;
}

export interface KohoCatalogEnv {
  KINTONE_DOMAIN: string;
  KINTONE_APP_ID_HISTORY?: string;
  KINTONE_APP_ID_PLACES?: string;
  MICROCMS_SERVICE_DOMAIN?: string;
}

interface AppDefinition {
  key: string;
  name: string;
  appId: string | undefined;
  where: string;
  note?: string;
}

/** kintone のアプリ（アプリ ID が分からないものは出さない） */
export function buildKintoneApps(env: KohoCatalogEnv): KohoKintoneApp[] {
  const definitions: AppDefinition[] = [
    {
      key: 'announcements',
      name: 'お知らせ',
      appId: '53',
      where: '組合員専用ページのトップと「お知らせ」に、日付の新しい順に出ます',
      note: '「公開」にしたものだけが出ます（「準備中」のあいだは出ません）',
    },
    {
      key: 'circulars',
      name: '回覧板・配布資料',
      appId: '54',
      where: '組合員専用ページの「回覧板・配布資料」に出ます',
    },
    {
      key: 'events',
      name: 'イベント',
      appId: '49',
      where: '組合員専用ページの「イベント情報」に出ます',
    },
    {
      key: 'greenwellness',
      name: 'グリーンウェルネス',
      appId: '51',
      where: '組合員専用ページの「グリーンウェルネス」に出ます',
    },
    {
      key: 'minutes',
      name: '会議情報',
      appId: '48',
      where: '組合員専用ページの「会議情報」に、議事録として出ます',
    },
    {
      key: 'applications',
      name: '届出・申請書',
      appId: '56',
      where: '組合員専用ページの「各種申請」に、ダウンロードできる様式として出ます',
      note: '「公開」にしたものだけが出ます（「非公開」は出ません）',
    },
    {
      key: 'history',
      name: '団地の歴史',
      appId: env.KINTONE_APP_ID_HISTORY,
      where: '団地のあゆみ・修繕の履歴として、だれでも見られるページに出ます',
    },
    {
      key: 'places',
      name: '周辺施設',
      appId: env.KINTONE_APP_ID_PLACES,
      where: 'だれでも見られる「周辺施設」のページに出ます',
      note: 'Google の情報から毎月自動で更新されます。手で直した内容は、次の更新で書き換わることがあります',
    },
  ];

  return definitions
    .filter((d): d is AppDefinition & { appId: string } => /^\d+$/.test(d.appId ?? ''))
    .map((d) => ({
      key: d.key,
      name: d.name,
      appId: d.appId,
      where: d.where,
      note: d.note ?? '',
      listUrl: `https://${env.KINTONE_DOMAIN}/k/${d.appId}/`,
      addUrl: `https://${env.KINTONE_DOMAIN}/k/${d.appId}/edit`,
    }));
}

/** microCMS（ホームページの「contents」API。カテゴリーで出し分けている） */
export function buildMicrocms(env: KohoCatalogEnv): KohoMicrocms {
  const service = env.MICROCMS_SERVICE_DOMAIN || 'k-miyoshino';
  return {
    url: `https://${service}.microcms.io/apis/contents`,
    items: [
      { name: 'トップの写真', where: 'ホームのいちばん上の写真' },
      { name: '季節の写真', where: '「特徴」のページの季節の写真' },
      { name: 'コミュニティ活動', where: '「コミュニティ」のページの活動の紹介' },
      { name: 'サークル（スポーツ・文化）', where: '「コミュニティ」のページのサークルの紹介' },
      { name: '共有施設・サービス', where: '「共有施設・サービス」のページ' },
    ],
  };
}

/** 「この部分はここで直す」の早見表 */
export const KOHO_GUIDE: KohoGuideRow[] = [
  { area: 'ホームのいちばん上の写真', editIn: 'microCMS', target: 'トップの写真' },
  { area: '組合員専用ページのお知らせ', editIn: 'kintone', target: 'お知らせ' },
  { area: '回覧板・配布資料', editIn: 'kintone', target: '回覧板・配布資料' },
  { area: 'イベント情報', editIn: 'kintone', target: 'イベント' },
  { area: 'グリーンウェルネス', editIn: 'kintone', target: 'グリーンウェルネス' },
  { area: '会議情報（議事録）', editIn: 'kintone', target: '会議情報' },
  { area: '届出・申請書のダウンロード', editIn: 'kintone', target: '届出・申請書' },
  { area: 'コミュニティ活動・サークルの紹介', editIn: 'microCMS', target: 'コミュニティ活動・サークル' },
  { area: '共有施設・サービスのページ', editIn: 'microCMS', target: '共有施設・サービス' },
  { area: '「特徴」のページの季節の写真', editIn: 'microCMS', target: '季節の写真' },
  { area: '周辺施設', editIn: 'kintone', target: '周辺施設（Google から毎月自動で更新）' },
  {
    area: '各ページの文章（アクセスの説明・団地の紹介など）',
    editIn: 'ソース',
    target: 'いまはシステム管理者に頼む（言葉で頼むと直せるしくみは準備中）',
  },
];
