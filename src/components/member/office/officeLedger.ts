import { OfficeLedgerInput, OfficeLedgerType } from '@/types/office';

/**
 * 事務員が台帳を更新する入力（名義変更・氏名の変更）の手順と、入力の確認・送る内容づくり（OFFICE.md 0-5）。
 * 画面から切り離して、テストしやすくする。最後は office Worker の確認が正
 */

export type LedgerStep =
  'type' | 'unit' | 'newName' | 'newLogin' | 'dates' | 'confirm';

export interface LedgerDraft {
  type: OfficeLedgerType | null;
  propertyName: string;
  /** 今所有中の組合員の表示（画面に出すだけ。Worker が改めて調べる） */
  ownerDisplay: string;
  newName: string;
  newLogin: string;
  switchDate: string;
  transferDate: string;
}

/** 手順の見出し（1 画面に 1 つの質問。上に「いま 3 / 6」と出す） */
export const STEP_TITLES: Record<LedgerStep, string> = {
  type: 'どの手続きですか',
  unit: 'どのお部屋ですか',
  newName: '新しい氏名',
  newLogin: '新しい組合員のログイン名',
  dates: '日付',
  confirm: '台帳がこう変わります（確認）',
};

/**
 * 手続きごとの手順。名義変更は紙の「組合員名義変更届」の順番（お部屋 → 新しい組合員 → 負担となる日・名義変更日）に、
 * 管理者から伝えられたログイン名を足したもの
 */
export function stepsFor(type: OfficeLedgerType | null): LedgerStep[] {
  if (type === '名義変更') {
    return ['type', 'unit', 'newName', 'newLogin', 'dates', 'confirm'];
  }
  if (type === '氏名の変更') return ['type', 'unit', 'newName', 'confirm'];
  return ['type'];
}

export function emptyDraft(): LedgerDraft {
  return {
    type: null,
    propertyName: '',
    ownerDisplay: '',
    newName: '',
    newLogin: '',
    switchDate: '',
    transferDate: '',
  };
}

/** 物件名（'01-101'）から、ログイン名の先頭の棟部屋コード（'01101'）を作る */
export function propertyCode(propertyName: string): string {
  return propertyName.replace('-', '');
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOGIN_PATTERN = /^[A-Za-z0-9._@-]{1,64}$/;

function checkUnit(draft: LedgerDraft): string[] {
  if (!draft.propertyName) return ['お部屋を選んでください'];
  if (!draft.ownerDisplay)
    return [
      'このお部屋には、いま所有している組合員が登録されていません。管理者に台帳の確認を頼んでください',
    ];
  return [];
}

function checkNewName(draft: LedgerDraft): string[] {
  if (draft.newName.trim()) return [];
  return [
    draft.type === '名義変更'
      ? '新しい組合員の氏名を入れてください'
      : '変更後の氏名を入れてください',
  ];
}

function checkNewLogin(draft: LedgerDraft): string[] {
  const login = draft.newLogin.trim();
  if (!LOGIN_PATTERN.test(login))
    return ['管理者から伝えられたログイン名を入れてください（半角の英数字）'];
  const code = propertyCode(draft.propertyName);
  if (!login.startsWith(code))
    return [
      `ログイン名は、お部屋の番号（${code}）で始まります。管理者に伝えられたログイン名を確かめてください`,
    ];
  return [];
}

function checkDates(draft: LedgerDraft): string[] {
  const errors: string[] = [];
  if (!DATE_PATTERN.test(draft.switchDate))
    errors.push('新しい組合員の負担となる日を入れてください');
  if (!DATE_PATTERN.test(draft.transferDate))
    errors.push('名義変更日を入れてください');
  return errors;
}

const STEP_CHECKS: Partial<
  Record<LedgerStep, (draft: LedgerDraft) => string[]>
> = {
  type: (draft) => (draft.type ? [] : ['手続きを選んでください']),
  unit: checkUnit,
  newName: checkNewName,
  newLogin: checkNewLogin,
  dates: checkDates,
};

/** その手順で先に進めるか。進めないときは、画面に出す理由を返す */
export function validateStep(draft: LedgerDraft, step: LedgerStep): string[] {
  return STEP_CHECKS[step]?.(draft) ?? [];
}

/** Worker に送る内容 */
export function toLedgerInput(
  draft: LedgerDraft,
  submitKey: string
): OfficeLedgerInput {
  if (!draft.type) throw new Error('手続きを選んでから送ってください');
  const common = {
    type: draft.type,
    submitKey,
    propertyName: draft.propertyName,
    newName: draft.newName.trim(),
  };
  if (draft.type === '氏名の変更') return common;
  return {
    ...common,
    newLogin: draft.newLogin.trim(),
    switchDate: draft.switchDate,
    transferDate: draft.transferDate,
  };
}

/** 'YYYY-MM-DD' を「2026年11月16日」に。形が正しくなければ空 */
export function formatJapaneseDate(value: string): string {
  if (!DATE_PATTERN.test(value)) return '';
  const [y, m, d] = value.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

/** 二重の登録を防ぐ送信キー（入力を始めるたびに 1 つ作り、送り直しても変えない） */
export function newSubmitKey(): string {
  return crypto.randomUUID();
}
