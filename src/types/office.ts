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

export type OfficeApplicationType = '名義変更' | '情報変更';
export type OfficeApplicantKind = '組合員' | '購入者' | '代理人';

/** 組合員申請（workers/api/_office-applications.ts の ApplicationView と合わせる） */
export interface OfficeApplication {
  id: string;
  type: string;
  status: string;
  submittedDate: string;
  method: string;
  applicantKind: string;
  agent: string;
  propertyName: string;
  memberDisplay: string;
  summary: string;
  newName: string;
  transferDate: string;
  switchDate: string;
  newAddress: string;
  newPhone: string;
  moveInDate: string;
  oldAddress: string;
  oldPhone: string;
  newLogin: string;
  enteredBy: string;
  approvedBy: string;
  approvedAt: string;
  returnReason: string;
}

export interface OfficeApplicationList {
  status: string;
  applications: OfficeApplication[];
}

/** 代理入力で送る内容（workers/api/_office-applications.ts の parseApplicationInput が受け取る形） */
export interface OfficeProxyInput {
  type: OfficeApplicationType;
  submitKey: string;
  submittedDate: string;
  applicantKind: OfficeApplicantKind;
  agent: string;
  propertyName: string;
  newName: string;
  transferDate?: string;
  switchDate?: string;
  newAddress?: string;
  newPhone?: string;
  moveInDate?: string;
  oldAddress?: string;
  oldPhone?: string;
}

export interface OfficeProxyResult {
  id: string;
  duplicate: boolean;
}
