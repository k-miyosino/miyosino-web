/** 事務員専用ページ（/member/office）で office Worker から受け取るデータ（workers/api/office.ts・_office.ts と合わせる） */

export interface OfficeMe {
  code: string;
  name: string;
}

export interface OfficeUnitOwner {
  /** M_組合員の表示（物件名＋名前） */
  display: string;
  /** Kintone ユーザーのコード（ログイン名） */
  userCode: string;
  startDate: string | null;
}

export interface OfficeUnit {
  id: string;
  /** 物件名（'01-101'） */
  name: string;
  building: string;
  room: string;
  owner: OfficeUnitOwner | null;
  /** 同じ日に所有中の記録が 2 件以上ある（台帳の誤り） */
  ownerConflict: boolean;
}

export interface OfficeUnits {
  /** 所有中かを判定した日（日本時間 'YYYY-MM-DD'） */
  date: string;
  units: OfficeUnit[];
}
