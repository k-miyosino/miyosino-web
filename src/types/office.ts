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

export type OfficeLedgerType = '名義変更' | '氏名の変更';

/** 台帳の更新で送る内容（workers/api/_office-ledger.ts の parseLedgerInput が受け取る形） */
export interface OfficeLedgerInput {
  type: OfficeLedgerType;
  submitKey: string;
  propertyName: string;
  newName: string;
  newLogin?: string;
  switchDate?: string;
  transferDate?: string;
}

export interface OfficeLedgerProration {
  daysInMonth: number;
  oldDays: number;
  newDays: number;
  monthlyFee: number;
  oldAmount: number;
  newAmount: number;
}

/** 確認画面に出す「台帳がこう変わります」（POST /office/ledger/preview） */
export interface OfficeLedgerPreview {
  summary: string[];
  warnings: string[];
  notices: string[];
  proration: OfficeLedgerProration | null;
}

/** 台帳に反映したあとの結果（POST /office/ledger） */
export interface OfficeLedgerResult {
  logId: string;
  duplicate: boolean;
  summary?: string[];
  notices?: string[];
}

/** 台帳の更新記録（workers/api/_office-ledger.ts の LogView と合わせる） */
export interface OfficeLedgerLog {
  id: string;
  type: string;
  status: string;
  propertyName: string;
  oldMember: string;
  newName: string;
  newLogin: string;
  switchDate: string;
  transferDate: string;
  enteredBy: string;
  enteredAt: string;
  canceledBy: string;
  canceledAt: string;
}
