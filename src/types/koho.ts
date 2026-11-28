/** 広報ページ（/member/koho）で koho Worker から受け取るデータ（workers/api/_koho-catalog.ts と合わせる） */

export interface KohoKintoneApp {
  key: string;
  name: string;
  appId: string;
  where: string;
  note: string;
  listUrl: string;
  addUrl: string;
}

export interface KohoMicrocms {
  url: string;
  items: { name: string; where: string }[];
}

export interface KohoGuideRow {
  area: string;
  editIn: 'kintone' | 'microCMS' | 'ソース';
  target: string;
}

export interface KohoLinks {
  me: { code: string; name: string };
  kintone: KohoKintoneApp[];
  microcms: KohoMicrocms;
  guide: KohoGuideRow[];
}
