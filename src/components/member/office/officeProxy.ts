import {
  OfficeApplicantKind,
  OfficeApplicationType,
  OfficeProxyInput,
} from '@/types/office';

/**
 * 紙の申請の代理入力（事務員専用ページ）の手順と、入力の確認・送る内容づくり。
 * 画面から切り離して、テストしやすくする。
 * 確認の中身は office Worker（workers/api/_office-applications.ts）と同じ。最後は Worker の確認が正
 */

export type ProxyStep =
  | 'type'
  | 'unit'
  | 'applicant'
  | 'newName'
  | 'dates'
  | 'oldContact'
  | 'newContact'
  | 'confirm';

export interface ProxyDraft {
  type: OfficeApplicationType | null;
  propertyName: string;
  /** 今所有中の組合員の表示（画面に出すだけ。送らない。Worker が改めて調べる） */
  ownerDisplay: string;
  submittedDate: string;
  applicantKind: OfficeApplicantKind | null;
  agent: string;
  newName: string;
  switchDate: string;
  transferDate: string;
  moveInDate: string;
  oldAddress: string;
  oldPhone: string;
  newAddress: string;
  newPhone: string;
}

/** 手順の見出し（1 画面に 1 つの質問。上に「いま 3 / 8」と出す） */
export const STEP_TITLES: Record<ProxyStep, string> = {
  type: 'どの申請書ですか',
  unit: 'どのお部屋の申請ですか',
  applicant: '届出日と、申請した人',
  newName: '新しい氏名',
  dates: '日付',
  oldContact: '旧組合員の転出先',
  newContact: '新しい組合員の連絡先',
  confirm: '内容の確認',
};

/**
 * 申請の種類ごとの手順。名義変更は紙の「組合員名義変更届」の順番（お部屋 → 届出日 →
 * 新組合員 → 負担となる日・名義変更日・入居日 → 旧組合員の転出先 → 新組合員の連絡先）に合わせる
 */
export function stepsFor(type: OfficeApplicationType | null): ProxyStep[] {
  if (type === '名義変更') {
    return [
      'type',
      'unit',
      'applicant',
      'newName',
      'dates',
      'oldContact',
      'newContact',
      'confirm',
    ];
  }
  if (type === '情報変更') {
    return ['type', 'unit', 'applicant', 'newName', 'confirm'];
  }
  return ['type'];
}

export function emptyDraft(today: string): ProxyDraft {
  return {
    type: null,
    propertyName: '',
    ownerDisplay: '',
    submittedDate: today,
    applicantKind: null,
    agent: '',
    newName: '',
    switchDate: '',
    transferDate: '',
    moveInDate: '',
    oldAddress: '',
    oldPhone: '',
    newAddress: '',
    newPhone: '',
  };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** その手順で先に進めるか。進めないときは、画面に出す理由を返す */
export function validateStep(
  draft: ProxyDraft,
  step: ProxyStep,
  today: string
): string[] {
  const errors: string[] = [];
  switch (step) {
    case 'type':
      if (!draft.type) errors.push('申請書を選んでください');
      break;
    case 'unit':
      if (!draft.propertyName) errors.push('お部屋を選んでください');
      else if (!draft.ownerDisplay)
        errors.push(
          'このお部屋には、いま所有している組合員が登録されていません。管理者に台帳の確認を頼んでください'
        );
      break;
    case 'applicant':
      if (!DATE_PATTERN.test(draft.submittedDate))
        errors.push('届出日を入れてください');
      else if (draft.submittedDate > today)
        errors.push('届出日に、今日より後の日は入れられません');
      if (!draft.applicantKind) errors.push('申請した人を選んでください');
      if (draft.applicantKind === '代理人' && !draft.agent.trim())
        errors.push('代理人の氏名と続柄（または会社名）を入れてください');
      break;
    case 'newName':
      if (!draft.newName.trim())
        errors.push(
          draft.type === '名義変更'
            ? '新しい組合員の氏名を入れてください'
            : '変更後の氏名を入れてください'
        );
      break;
    case 'dates':
      if (!DATE_PATTERN.test(draft.switchDate))
        errors.push('新しい組合員の負担となる日を入れてください');
      if (!DATE_PATTERN.test(draft.transferDate))
        errors.push('名義変更日を入れてください');
      break;
    default:
      break;
  }
  return errors;
}

/** 申請した人の選び方（情報変更は購入者がいない） */
export function applicantKindsFor(
  type: OfficeApplicationType | null
): OfficeApplicantKind[] {
  return type === '情報変更'
    ? ['組合員', '代理人']
    : ['組合員', '購入者', '代理人'];
}

/** Worker に送る内容 */
export function toProxyInput(
  draft: ProxyDraft,
  submitKey: string
): OfficeProxyInput {
  if (!draft.type || !draft.applicantKind) {
    throw new Error('申請書と申請した人を選んでから送ってください');
  }
  const common = {
    type: draft.type,
    submitKey,
    submittedDate: draft.submittedDate,
    applicantKind: draft.applicantKind,
    agent: draft.applicantKind === '代理人' ? draft.agent.trim() : '',
    propertyName: draft.propertyName,
    newName: draft.newName.trim(),
  };
  if (draft.type === '情報変更') return common;
  return {
    ...common,
    transferDate: draft.transferDate,
    switchDate: draft.switchDate,
    moveInDate: draft.moveInDate,
    oldAddress: draft.oldAddress.trim(),
    oldPhone: draft.oldPhone.trim(),
    newAddress: draft.newAddress.trim(),
    newPhone: draft.newPhone.trim(),
  };
}

/** 'YYYY-MM-DD' を「2026年11月16日」に。空なら空 */
export function formatJapaneseDate(value: string): string {
  if (!DATE_PATTERN.test(value)) return '';
  const [y, m, d] = value.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

/** 確認画面に並べる項目（紙の様式と同じ順番）。空の項目は「（なし）」 */
export function confirmRows(draft: ProxyDraft): [string, string][] {
  const orNone = (value: string) => value.trim() || '（なし）';
  const applicant =
    draft.applicantKind === '代理人'
      ? `代理人（${draft.agent.trim()}）`
      : (draft.applicantKind ?? '');
  const rows: [string, string][] = [
    ['申請書', draft.type ?? ''],
    ['お部屋', draft.propertyName],
    [draft.type === '名義変更' ? '旧組合員' : '組合員', draft.ownerDisplay],
    ['届出日', formatJapaneseDate(draft.submittedDate)],
    ['申請した人', applicant],
  ];
  if (draft.type === '情報変更') {
    rows.push(['変更後の氏名', draft.newName.trim()]);
    return rows;
  }
  rows.push(
    ['新しい組合員', draft.newName.trim()],
    ['新しい組合員の負担となる日', formatJapaneseDate(draft.switchDate)],
    ['名義変更日', formatJapaneseDate(draft.transferDate)],
    ['入居（予定）日', formatJapaneseDate(draft.moveInDate) || '（なし）'],
    ['旧組合員の転出先の住所', orNone(draft.oldAddress)],
    ['旧組合員の転出先の電話番号', orNone(draft.oldPhone)],
    ['新しい組合員の住所', orNone(draft.newAddress)],
    ['新しい組合員の電話番号', orNone(draft.newPhone)]
  );
  return rows;
}

/** 端末の今日の日付（'YYYY-MM-DD'。事務所の PC は日本時間の前提） */
export function todayLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 二重の登録を防ぐ送信キー（代理入力を始めるたびに 1 つ作り、送り直しても変えない） */
export function newSubmitKey(): string {
  return crypto.randomUUID();
}
