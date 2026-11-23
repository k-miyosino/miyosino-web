/**
 * 組合員申請（名義変更・情報変更）の入力の確認と、kintone の「組合員申請」アプリのレコードとの変換。
 * kintone に頼らない関数だけを置き、テストしやすくする。
 *
 * フィールドコードは OFFICE.md 4-3-2 の表と合わせる（変えるときは両方を直す）。
 */

export const APPLICATION_TYPES = ['名義変更', '情報変更'] as const;
export type ApplicationType = (typeof APPLICATION_TYPES)[number];

export const APPLICANT_KINDS = ['組合員', '購入者', '代理人'] as const;
export type ApplicantKind = (typeof APPLICANT_KINDS)[number];

export const APPLICATION_STATUSES = [
  '申請中',
  'アカウント発行待ち',
  '承認済み',
  '差し戻し',
  '取り下げ',
  '取り消し',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const PROXY_METHOD = '紙（代理入力）';

interface CommonInput {
  /** 画面が操作ごとに作る一意のキー（二重の登録を防ぐ） */
  submitKey: string;
  submittedDate: string;
  applicantKind: ApplicantKind;
  agent: string;
  /** 物件名（'01-101'） */
  propertyName: string;
}

export interface TransferInput extends CommonInput {
  type: '名義変更';
  transferDate: string;
  switchDate: string;
  newName: string;
  newAddress: string;
  newPhone: string;
  moveInDate: string;
  oldAddress: string;
  oldPhone: string;
}

export interface InfoChangeInput extends CommonInput {
  type: '情報変更';
  newName: string;
}

export type ApplicationInput = TransferInput | InfoChangeInput;

export type ParseResult =
  | { ok: true; value: ApplicationInput }
  | { ok: false; errors: string[] };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SUBMIT_KEY_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const PROPERTY_PATTERN = /^\d{2}-\d{3,4}$/;
const MAX_NAME = 50;
const MAX_ADDRESS = 200;
const MAX_PHONE = 20;
const MAX_AGENT = 100;

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function text(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 画面から届いた申請の入力を確かめる。エラーは画面にそのまま出せる日本語で返す。
 * today は日本時間の今日（'YYYY-MM-DD'）
 */
export function parseApplicationInput(body: unknown, today: string): ParseResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: ['入力の形が正しくありません'] };
  }
  const data = body as Record<string, unknown>;
  const errors: string[] = [];

  const type = text(data, 'type');
  if (!(APPLICATION_TYPES as readonly string[]).includes(type)) {
    return { ok: false, errors: ['申請の種類を選んでください'] };
  }

  const submitKey = text(data, 'submitKey');
  if (!SUBMIT_KEY_PATTERN.test(submitKey)) {
    errors.push('画面を開き直して、もう一度入力してください（送信キーが正しくありません）');
  }

  const submittedDate = text(data, 'submittedDate');
  if (!isValidDate(submittedDate)) {
    errors.push('届出日を入れてください');
  } else if (submittedDate > today) {
    errors.push('届出日に、今日より後の日は入れられません');
  }

  const applicantKind = text(data, 'applicantKind');
  if (!(APPLICANT_KINDS as readonly string[]).includes(applicantKind)) {
    errors.push('申請した人の区分を選んでください');
  } else if (type === '情報変更' && applicantKind === '購入者') {
    errors.push('情報変更は、組合員本人か代理人の申請です');
  }

  const agent = text(data, 'agent');
  if (applicantKind === '代理人' && !agent) {
    errors.push('代理人の氏名と続柄（または会社名）を入れてください');
  }
  if (agent.length > MAX_AGENT) {
    errors.push(`代理人は ${MAX_AGENT} 文字までです`);
  }

  const propertyName = text(data, 'propertyName');
  if (!PROPERTY_PATTERN.test(propertyName)) {
    errors.push('お部屋を選んでください');
  }

  const newName = text(data, 'newName');
  if (!newName) {
    errors.push(type === '名義変更' ? '新しい組合員の氏名を入れてください' : '変更後の氏名を入れてください');
  } else if (newName.length > MAX_NAME) {
    errors.push(`氏名は ${MAX_NAME} 文字までです`);
  }

  const common = {
    submitKey,
    submittedDate,
    applicantKind: applicantKind as ApplicantKind,
    agent,
    propertyName,
    newName,
  };

  if (type === '情報変更') {
    return errors.length > 0
      ? { ok: false, errors }
      : { ok: true, value: { type: '情報変更', ...common } };
  }

  const transferDate = text(data, 'transferDate');
  if (!isValidDate(transferDate)) {
    errors.push('名義変更日を入れてください');
  }
  const switchDate = text(data, 'switchDate');
  if (!isValidDate(switchDate)) {
    errors.push('新しい組合員の負担となる日を入れてください');
  }
  const moveInDate = text(data, 'moveInDate');
  if (moveInDate && !isValidDate(moveInDate)) {
    errors.push('入居（予定）日の形が正しくありません');
  }

  const newAddress = text(data, 'newAddress');
  const oldAddress = text(data, 'oldAddress');
  const newPhone = text(data, 'newPhone');
  const oldPhone = text(data, 'oldPhone');
  if (newAddress.length > MAX_ADDRESS || oldAddress.length > MAX_ADDRESS) {
    errors.push(`住所は ${MAX_ADDRESS} 文字までです`);
  }
  if (newPhone.length > MAX_PHONE || oldPhone.length > MAX_PHONE) {
    errors.push(`電話番号は ${MAX_PHONE} 文字までです`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      type: '名義変更',
      ...common,
      transferDate,
      switchDate,
      newAddress,
      newPhone,
      moveInDate,
      oldAddress,
      oldPhone,
    },
  };
}

/** 'YYYY-MM-DD' を「2026年11月16日」にする */
export function formatJapaneseDate(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

/** 新規申し込みリストに出す、人が読む要約 */
export function buildSummary(input: ApplicationInput, ownerDisplay: string): string {
  if (input.type === '情報変更') {
    return `${ownerDisplay} の氏名を「${input.newName}」に変更`;
  }
  return `${input.propertyName} の名義を ${ownerDisplay} から ${input.newName} 様に変更（${formatJapaneseDate(
    input.switchDate
  )}から新組合員の負担）`;
}

type KintoneValue = { value: string };

/** 代理入力した申請を、組合員申請アプリのレコードにする（物件・組合員はルックアップのキーを入れる） */
export function toKintoneRecord(
  input: ApplicationInput,
  ownerDisplay: string,
  enteredBy: string
): Record<string, KintoneValue> {
  const record: Record<string, KintoneValue> = {
    type: { value: input.type },
    status: { value: '申請中' },
    submitted_date: { value: input.submittedDate },
    method: { value: PROXY_METHOD },
    applicant_kind: { value: input.applicantKind },
    agent: { value: input.agent },
    property: { value: input.propertyName },
    member: { value: ownerDisplay },
    new_name: { value: input.newName },
    summary: { value: buildSummary(input, ownerDisplay) },
    payload: { value: JSON.stringify({ version: 1, input }) },
    entered_by: { value: enteredBy },
    submit_key: { value: input.submitKey },
  };
  if (input.type === '名義変更') {
    Object.assign(record, {
      transfer_date: { value: input.transferDate },
      switch_date: { value: input.switchDate },
      new_address: { value: input.newAddress },
      new_phone: { value: input.newPhone },
      // 日付のフィールドは、空なら空文字を送ると kintone が空にする
      move_in_date: { value: input.moveInDate },
      old_address: { value: input.oldAddress },
      old_phone: { value: input.oldPhone },
    });
  }
  return record;
}

/** kintone のレコードの形（読むフィールドだけ。どれも { value }） */
export type ApplicationRecord = Record<string, { value: unknown } | undefined>;

export interface ApplicationView {
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

function str(record: ApplicationRecord, code: string): string {
  const value = record[code]?.value;
  return typeof value === 'string' ? value : '';
}

/** 組合員申請アプリのレコードを、画面に返す形にする（送信キー・内容データは返さない） */
export function fromKintoneRecord(record: ApplicationRecord): ApplicationView {
  return {
    id: str(record, '$id'),
    type: str(record, 'type'),
    status: str(record, 'status'),
    submittedDate: str(record, 'submitted_date'),
    method: str(record, 'method'),
    applicantKind: str(record, 'applicant_kind'),
    agent: str(record, 'agent'),
    propertyName: str(record, 'property'),
    memberDisplay: str(record, 'member'),
    summary: str(record, 'summary'),
    newName: str(record, 'new_name'),
    transferDate: str(record, 'transfer_date'),
    switchDate: str(record, 'switch_date'),
    newAddress: str(record, 'new_address'),
    newPhone: str(record, 'new_phone'),
    moveInDate: str(record, 'move_in_date'),
    oldAddress: str(record, 'old_address'),
    oldPhone: str(record, 'old_phone'),
    newLogin: str(record, 'new_login'),
    enteredBy: str(record, 'entered_by'),
    approvedBy: str(record, 'approved_by'),
    approvedAt: str(record, 'approved_at'),
    returnReason: str(record, 'return_reason'),
  };
}

/** 一覧・詳細で読むフィールド */
export const APPLICATION_FIELDS = [
  '$id',
  'type',
  'status',
  'submitted_date',
  'method',
  'applicant_kind',
  'agent',
  'property',
  'member',
  'summary',
  'new_name',
  'transfer_date',
  'switch_date',
  'new_address',
  'new_phone',
  'move_in_date',
  'old_address',
  'old_phone',
  'new_login',
  'entered_by',
  'approved_by',
  'approved_at',
  'return_reason',
];
