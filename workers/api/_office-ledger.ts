/**
 * 事務員が台帳（M_組合員・所有状況・駐車場契約）を更新するときの、入力の確認と「どのレコードをどう書き換えるか」の組み立て
 * （OFFICE.md 0 章）。kintone に頼らない関数だけを置き、テストしやすくする。
 *
 * 台帳のフィールドコードは union-dues-manager の kintone/definitions に、
 * 台帳の更新記録のフィールドコードは workers/kintone/ledger-log.json に合わせる。
 */

export const LEDGER_TYPES = ['名義変更', '氏名の変更'] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

export const LOG_STATUSES = ['反映済み', '取り消し'] as const;

interface Field<T> {
  value: T;
}

/** M_組合員物件所有状況（使うフィールドだけ） */
export interface LedgerOwnership {
  $id: Field<string>;
  $revision: Field<string>;
  property: Field<string>;
  member: Field<string>;
  start_date: Field<string | null>;
  end_date: Field<string | null>;
  status: Field<string>;
  user: Field<{ code: string; name: string }[]>;
  management_fee?: Field<string | null>;
  repair_reserve_fee?: Field<string | null>;
}

/** M_組合員（使うフィールドだけ） */
export interface LedgerMember {
  $id: Field<string>;
  $revision: Field<string>;
  display: Field<string>;
  status: Field<string>;
  user: Field<{ code: string; name: string }[]>;
}

/** M_組合員駐車場契約（使うフィールドだけ） */
export interface LedgerParking {
  $id: Field<string>;
  $revision: Field<string>;
  member: Field<string>;
  start_date: Field<string | null>;
  end_date: Field<string | null>;
}

export interface TransferInput {
  type: '名義変更';
  submitKey: string;
  propertyName: string;
  newName: string;
  newLogin: string;
  switchDate: string;
  transferDate: string;
}

export interface RenameInput {
  type: '氏名の変更';
  submitKey: string;
  propertyName: string;
  newName: string;
}

export type LedgerInput = TransferInput | RenameInput;

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SUBMIT_KEY_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const PROPERTY_PATTERN = /^\d{2}-\d{3,4}$/;
const LOGIN_PATTERN = /^[A-Za-z0-9._@-]{1,64}$/;
const MAX_NAME = 50;
// bulkRequest に一度に入れられる書き込みの数（kintone の上限）
export const MAX_BULK_REQUESTS = 20;

export function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** 'YYYY-MM-DD' の前の日 */
export function previousDay(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' を「2026年11月16日」にする */
export function formatJapaneseDate(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

/** 'YYYY-MM-DD' を「2026年2月」にする */
export function formatJapaneseMonth(value: string): string {
  const [y, m] = value.split('-').map(Number);
  return `${y}年${m}月`;
}

/** 物件名（'01-101'）からログイン名の先頭の棟部屋コード（'01101'）を作る */
export function propertyCode(propertyName: string): string {
  return propertyName.replace('-', '');
}

function text(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 氏名の空白をそろえる。前後の空白を取り、間の空白（全角・半角・続いたもの）は半角 1 つにする。
 * 画面は姓と名を分けて入れ、半角の空白でつないで送る（外国籍の方などは 1 つの欄に、空白も含めて入れる）
 */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/gu, ' ');
}

/** M_組合員の「表示」（物件名と氏名を空けずにつなぐ。今の台帳の「01-101田中」と同じ形。例: 01-101田中 太郎） */
export function memberDisplay(propertyName: string, name: string): string {
  return `${propertyName}${name}`;
}

/** 「表示」は重複禁止なので、すでにあれば「01-101田中太郎(2)」のように重ならない番号を付ける */
export function uniqueDisplay(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}(${n})`;
    if (!taken.includes(candidate)) return candidate;
  }
}

function numberedWarning(base: string, numbered: string): string {
  return `「${base}」はすでに台帳にあるので（同じ姓名の旧組合員など）、重ならないよう「${numbered}」で登録します`;
}

/** 画面から届いた入力を確かめる。エラーは画面にそのまま出せる日本語で返す */
export function parseLedgerInput(body: unknown): Parsed<LedgerInput> {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: ['入力の形が正しくありません'] };
  }
  const data = body as Record<string, unknown>;
  const type = text(data, 'type');
  if (!(LEDGER_TYPES as readonly string[]).includes(type)) {
    return { ok: false, errors: ['手続きを選んでください'] };
  }
  const errors: string[] = [];
  const submitKey = text(data, 'submitKey');
  if (!SUBMIT_KEY_PATTERN.test(submitKey)) {
    errors.push('画面を開き直して、もう一度入力してください（送信キーが正しくありません）');
  }
  const propertyName = text(data, 'propertyName');
  if (!PROPERTY_PATTERN.test(propertyName)) errors.push('お部屋を選んでください');
  const newName = normalizeName(text(data, 'newName'));
  errors.push(...checkNewName(newName, type));
  if (type === '氏名の変更') {
    return errors.length > 0
      ? { ok: false, errors }
      : { ok: true, value: { type: '氏名の変更', submitKey, propertyName, newName } };
  }

  const newLogin = text(data, 'newLogin');
  errors.push(...checkNewLogin(newLogin, propertyName));
  const switchDate = text(data, 'switchDate');
  if (!isValidDate(switchDate)) errors.push('新しい組合員の負担となる日を入れてください');
  const transferDate = text(data, 'transferDate');
  if (!isValidDate(transferDate)) errors.push('名義変更日を入れてください');
  return errors.length > 0
    ? { ok: false, errors }
    : {
        ok: true,
        value: { type: '名義変更', submitKey, propertyName, newName, newLogin, switchDate, transferDate },
      };
}

function checkNewName(newName: string, type: string): string[] {
  if (!newName) {
    return [type === '名義変更' ? '新しい組合員の氏名を入れてください' : '変更後の氏名を入れてください'];
  }
  return newName.length > MAX_NAME ? [`氏名は ${MAX_NAME} 文字までです`] : [];
}

function checkNewLogin(newLogin: string, propertyName: string): string[] {
  if (!LOGIN_PATTERN.test(newLogin)) {
    return ['新しい組合員のログイン名を入れてください（半角の英数字）'];
  }
  if (PROPERTY_PATTERN.test(propertyName) && !newLogin.startsWith(propertyCode(propertyName))) {
    return [
      `ログイン名は、お部屋の番号（${propertyCode(propertyName)}）で始まります。管理者に伝えられたログイン名を確かめてください`,
    ];
  }
  return [];
}

/** その日に所有中か（開始日 ≤ その日 ≤ 終了日。空ならその側は限りなし） */
export function ownedOn(record: LedgerOwnership, date: string): boolean {
  const start = record.start_date.value;
  const end = record.end_date.value;
  return (!start || start <= date) && (!end || date <= end);
}

/** その日以降も続いている駐車場契約か */
function activeParkingOn(record: LedgerParking, date: string): boolean {
  const end = record.end_date.value;
  return !end || date <= end;
}

export interface LedgerApps {
  member: string;
  ownership: string;
  parking?: string;
  log: string;
}

/** 今の台帳の状態（Worker が kintone から読んで渡す） */
export interface LedgerContext {
  today: string;
  /** その物件の所有状況（すべて） */
  propertyOwnerships: LedgerOwnership[];
  /** 今の所有者の M_組合員（見つからなければ null） */
  member: LedgerMember | null;
  /** 今の所有者（のユーザー）の所有状況（すべて。氏名の変更で写し直す） */
  memberOwnerships: LedgerOwnership[];
  /** 今の所有者（のユーザー）の駐車場契約（すべて） */
  memberParkings: LedgerParking[];
  /** その物件名で始まる M_組合員の「表示」（すべて。新しい表示が重ならないようにする） */
  takenDisplays?: string[];
  /** 名義変更の新しいログイン名の M_組合員（すでにあれば。取り消したものは使い直す） */
  loginMembers?: LedgerMember[];
}

export interface BulkRequest {
  method: 'POST' | 'PUT';
  api: '/k/v1/record.json';
  payload: Record<string, unknown>;
}

export interface Proration {
  daysInMonth: number;
  oldDays: number;
  newDays: number;
  monthlyFee: number;
  oldAmount: number;
  newAmount: number;
}

export interface LedgerPlan {
  /** 台帳への書き込み（台帳の更新記録の追加は含まない） */
  requests: BulkRequest[];
  /** 台帳の更新記録のレコード */
  logRecord: Record<string, { value: string }>;
  /** 確認画面に出す「台帳がこう変わります」 */
  summary: string[];
  /** 確認画面に出す注意（駐車場の契約など） */
  warnings: string[];
  /** 登録したあとに知らせること（管理者・会計担当へ） */
  notices: string[];
  proration: Proration | null;
}

const put = (app: string, id: string, revision: string | null, record: Record<string, unknown>): BulkRequest => ({
  method: 'PUT',
  api: '/k/v1/record.json',
  payload: revision ? { app, id, revision, record } : { app, id, record },
});

const post = (app: string, record: Record<string, unknown>): BulkRequest => ({
  method: 'POST',
  api: '/k/v1/record.json',
  payload: { app, record },
});

const value = (v: string) => ({ value: v });

/** その日の日割り（負担を切り替える日を新しい組合員の初日とし、その月の日数で割って円未満を切り捨てる。決定済み） */
export function computeProration(switchDate: string, monthlyFee: number): Proration | null {
  const [y, m, d] = switchDate.split('-').map(Number);
  if (d === 1 || !Number.isFinite(monthlyFee) || monthlyFee <= 0) return null;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const oldDays = d - 1;
  const newDays = daysInMonth - oldDays;
  return {
    daysInMonth,
    oldDays,
    newDays,
    monthlyFee,
    oldAmount: Math.floor((monthlyFee * oldDays) / daysInMonth),
    newAmount: Math.floor((monthlyFee * newDays) / daysInMonth),
  };
}

/** 取り消して期間を空にした所有状況か（終了日が開始日より前） */
function isEmptyPeriod(o: LedgerOwnership): boolean {
  const start = o.start_date.value;
  const end = o.end_date.value;
  return Boolean(start && end && end < start);
}

/** レコード番号のいちばん大きい（新しい）もの */
function newestRecord<T extends { $id: Field<string> }>(records: T[]): T | undefined {
  return records.reduce<T | undefined>(
    (newest, r) => (!newest || Number(r.$id.value) > Number(newest.$id.value) ? r : newest),
    undefined
  );
}

function currentOwnership(ctx: LedgerContext): LedgerOwnership | string {
  const owned = ctx.propertyOwnerships.filter((o) => ownedOn(o, ctx.today));
  if (owned.length === 0) {
    return 'このお部屋には、いま所有している組合員が登録されていません。管理者に台帳の確認を頼んでください';
  }
  if (owned.length > 1) {
    return 'このお部屋は所有の記録が重なっています。管理者に台帳の確認を頼んでください';
  }
  return owned[0];
}

function baseLog(
  input: LedgerInput,
  oldDisplay: string,
  enteredBy: string,
  enteredAt: string,
  before: unknown,
  after: unknown
): Record<string, { value: string }> {
  return {
    type: value(input.type),
    status: value('反映済み'),
    property: value(input.propertyName),
    old_member: value(oldDisplay),
    new_name: value(input.newName),
    before: value(JSON.stringify(before)),
    after: value(JSON.stringify(after)),
    entered_by: value(enteredBy),
    entered_at: value(enteredAt),
    submit_key: value(input.submitKey),
  };
}

/** 名義変更: 旧組合員の所有を終え、新しい組合員を作って所有を始める */
export function planTransfer(
  input: TransferInput,
  ctx: LedgerContext,
  apps: LedgerApps,
  enteredBy: string,
  enteredAt: string
): Parsed<LedgerPlan> {
  const owner = currentOwnership(ctx);
  if (typeof owner === 'string') return { ok: false, errors: [owner] };
  const errors: string[] = [];
  const oldDisplay = owner.member.value;
  const oldUser = owner.user.value[0]?.code ?? '';
  const start = owner.start_date.value ?? '';
  if (start && input.switchDate <= start) {
    errors.push(`新しい組合員の負担となる日は、旧組合員の所有の開始日（${formatJapaneseDate(start)}）より後の日にしてください`);
  }
  if (owner.end_date.value) {
    errors.push('旧組合員の所有には、すでに終了日が入っています。管理者に台帳の確認を頼んでください');
  }
  if (ctx.member?.display.value !== oldDisplay) {
    errors.push('旧組合員の組合員の登録が見つかりません。管理者に台帳の確認を頼んでください');
  }
  if (input.newLogin === oldUser) {
    errors.push('新しい組合員のログイン名が、旧組合員と同じです。名義変更では新しいアカウントを作ります');
  }
  // 新しいログイン名の M_組合員がすでにあれば: 有効なら止め、無効（取り消したものなど）なら新しく作らずに使い直す
  const loginMembers = ctx.loginMembers ?? [];
  const active = loginMembers.find((m) => m.status.value === '有効');
  if (active) {
    errors.push(
      `ログイン名 ${input.newLogin} は、ほかの組合員（${active.display.value}）がいま使っています。管理者に相談してください`
    );
  }
  const reused = active ? undefined : newestRecord(loginMembers);
  const baseDisplay = memberDisplay(input.propertyName, input.newName);
  const newDisplay = uniqueDisplay(
    baseDisplay,
    (ctx.takenDisplays ?? []).filter((d) => d !== reused?.display.value)
  );
  if (errors.length > 0 || !ctx.member) return { ok: false, errors };
  // 使い直す組合員を指す、前に取り消した所有状況（期間が空のもの）があれば、それも新しく作らずに書き換える
  const reusedOwnership = reused
    ? newestRecord(ctx.propertyOwnerships.filter((o) => o.member.value === reused.display.value && isEmptyPeriod(o)))
    : undefined;

  const lastDay = previousDay(input.switchDate);
  const parkings = ctx.memberParkings.filter((p) => activeParkingOn(p, input.switchDate));
  const fee =
    Number(owner.management_fee?.value ?? 0) + Number(owner.repair_reserve_fee?.value ?? 0);
  const proration = computeProration(input.switchDate, fee);

  const requests = [
    put(apps.ownership, owner.$id.value, owner.$revision.value, {
      end_date: value(lastDay),
      status: value('譲渡済'),
    }),
    put(apps.member, ctx.member.$id.value, ctx.member.$revision.value, { status: value('無効') }),
    reused
      ? put(apps.member, reused.$id.value, reused.$revision.value, {
          display: value(newDisplay),
          status: value('有効'),
        })
      : post(apps.member, {
          display: value(newDisplay),
          user: { value: [{ code: input.newLogin }] },
          status: value('有効'),
        }),
    reusedOwnership
      ? put(apps.ownership, reusedOwnership.$id.value, reusedOwnership.$revision.value, {
          member: value(newDisplay),
          start_date: value(input.switchDate),
          end_date: value(''),
          status: value('所有中'),
        })
      : post(apps.ownership, {
          member: value(newDisplay),
          property: value(input.propertyName),
          start_date: value(input.switchDate),
          status: value('所有中'),
        }),
  ];
  const before = {
    oldOwnership: { id: owner.$id.value, end_date: owner.end_date.value ?? '', status: owner.status.value },
    oldMember: { id: ctx.member.$id.value, status: ctx.member.status.value },
    // 使い直した組合員の、使い直す前の状態（取り消したら、この状態に戻す）
    ...(reused && {
      reusedMember: { id: reused.$id.value, display: reused.display.value, status: reused.status.value },
    }),
    ...(reusedOwnership && {
      reusedOwnership: {
        id: reusedOwnership.$id.value,
        member: reusedOwnership.member.value,
        start_date: reusedOwnership.start_date.value ?? '',
        end_date: reusedOwnership.end_date.value ?? '',
        status: reusedOwnership.status.value,
      },
    }),
  };
  const after = {
    newMember: { display: newDisplay },
    newOwnership: { start_date: input.switchDate },
    ...(reused && {
      ids: { member: reused.$id.value, ...(reusedOwnership && { ownership: reusedOwnership.$id.value }) },
    }),
  };
  const logRecord = {
    ...baseLog(input, oldDisplay, enteredBy, enteredAt, before, after),
    new_login: value(input.newLogin),
    switch_date: value(input.switchDate),
    transfer_date: value(input.transferDate),
  };

  const summary = [
    `${oldDisplay} 様の所有を ${formatJapaneseDate(lastDay)} で終えます（譲渡済）`,
    `${oldDisplay} 様の組合員の登録を「無効」にします`,
    reused
      ? `前に取り消した組合員の登録（${reused.display.value}）を使い直し、「${newDisplay}」（ログイン名 ${input.newLogin}）として有効に戻します`
      : `新しい組合員「${newDisplay}」（ログイン名 ${input.newLogin}）を登録します`,
    reusedOwnership
      ? `${newDisplay} 様の所有を ${formatJapaneseDate(input.switchDate)} から始めます（前に取り消した所有状況の記録を使い直します）`
      : `${newDisplay} 様の所有を ${formatJapaneseDate(input.switchDate)} から始めます`,
  ];
  const warnings: string[] = [];
  if (newDisplay !== baseDisplay) {
    warnings.push(numberedWarning(baseDisplay, newDisplay));
  }
  if (parkings.length > 0) {
    warnings.push(
      `${oldDisplay} 様には、続いている駐車場の契約が ${parkings.length} 件あります。駐車場の契約は、この手続きでは変わりません`
    );
  }
  const notices = [
    `管理者へ: ${formatJapaneseDate(input.switchDate)} に、旧組合員のアカウント（${oldUser}）を止めてください`,
    `会計担当へ: 新しい組合員（${newDisplay} 様、ログイン名 ${input.newLogin}）の口座振替の登録をお願いします（口座振替の依頼書は紙で回します）`,
  ];
  if (proration) {
    notices.push(
      `会計担当へ: ${formatJapaneseMonth(input.switchDate)}分の管理費・修繕積立費を日割りに直してください（旧組合員 ${proration.oldDays} 日・新しい組合員 ${proration.newDays} 日、参考の金額 ${proration.oldAmount} 円・${proration.newAmount} 円。月額 ${proration.monthlyFee} 円をその月の ${proration.daysInMonth} 日で割り、円未満を切り捨て）`
    );
  }
  return { ok: true, value: { requests, logRecord, summary, warnings, notices, proration } };
}

/** 氏名の変更: M_組合員の表示を書き換え、所有状況・駐車場契約の「組合員」（ルックアップ）も写し直す */
export function planRename(
  input: RenameInput,
  ctx: LedgerContext,
  apps: LedgerApps,
  enteredBy: string,
  enteredAt: string
): Parsed<LedgerPlan> {
  const owner = currentOwnership(ctx);
  if (typeof owner === 'string') return { ok: false, errors: [owner] };
  const member = ctx.member;
  if (member?.display.value !== owner.member.value) {
    return { ok: false, errors: ['組合員の登録が見つかりません。管理者に台帳の確認を頼んでください'] };
  }
  const oldDisplay = member.display.value;
  const baseDisplay = memberDisplay(input.propertyName, input.newName);
  if (baseDisplay === oldDisplay) {
    return { ok: false, errors: ['変更後の氏名が、いまの登録と同じです'] };
  }
  const newDisplay = uniqueDisplay(
    baseDisplay,
    (ctx.takenDisplays ?? []).filter((d) => d !== oldDisplay)
  );
  const ownerships = ctx.memberOwnerships;
  const parkings = apps.parking ? ctx.memberParkings : [];
  const requests = [
    put(apps.member, member.$id.value, member.$revision.value, { display: value(newDisplay) }),
    ...ownerships.map((o) => put(apps.ownership, o.$id.value, o.$revision.value, { member: value(newDisplay) })),
    ...parkings.map((p) =>
      put(apps.parking as string, p.$id.value, p.$revision.value, { member: value(newDisplay) })
    ),
  ];
  if (requests.length + 1 > MAX_BULK_REQUESTS) {
    return { ok: false, errors: ['書き換える記録が多すぎて、まとめて更新できません。管理者に頼んでください'] };
  }
  const before = {
    member: { id: member.$id.value, display: oldDisplay },
    ownerships: ownerships.map((o) => o.$id.value),
    parkings: parkings.map((p) => p.$id.value),
  };
  const after = { display: newDisplay };
  const parkingPart = parkings.length > 0 ? `・駐車場の契約 ${parkings.length} 件` : '';
  const summary = [
    `組合員の登録の表示を「${oldDisplay}」から「${newDisplay}」に書き換えます`,
    `所有状況 ${ownerships.length} 件${parkingPart}の「組合員」も、新しい表示に写し直します`,
  ];
  const notices = [
    `管理者へ: ログイン名 ${owner.user.value[0]?.code ?? ''} の Kintone ユーザーの表示名を、新しい氏名（${input.newName}）に変えてください`,
  ];
  return {
    ok: true,
    value: {
      requests,
      logRecord: baseLog(input, oldDisplay, enteredBy, enteredAt, before, after),
      summary,
      warnings: newDisplay === baseDisplay ? [] : [numberedWarning(baseDisplay, newDisplay)],
      notices,
      proration: null,
    },
  };
}

/** 台帳の更新記録（読むフィールドだけ） */
export type LogRecord = Record<string, { value: unknown } | undefined>;

function str(record: LogRecord, code: string): string {
  const v = record[code]?.value;
  return typeof v === 'string' ? v : '';
}

export interface LogView {
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

/** 台帳の更新記録を画面に返す形にする（変更前後の値・送信キーは返さない） */
export function toLogView(record: LogRecord): LogView {
  return {
    id: str(record, '$id'),
    type: str(record, 'type'),
    status: str(record, 'status'),
    propertyName: str(record, 'property'),
    oldMember: str(record, 'old_member'),
    newName: str(record, 'new_name'),
    newLogin: str(record, 'new_login'),
    switchDate: str(record, 'switch_date'),
    transferDate: str(record, 'transfer_date'),
    enteredBy: str(record, 'entered_by'),
    enteredAt: str(record, 'entered_at'),
    canceledBy: str(record, 'canceled_by'),
    canceledAt: str(record, 'canceled_at'),
  };
}

export const LOG_FIELDS = [
  '$id',
  'type',
  'status',
  'property',
  'old_member',
  'new_name',
  'new_login',
  'switch_date',
  'transfer_date',
  'before',
  'after',
  'entered_by',
  'entered_at',
  'canceled_by',
  'canceled_at',
];

/** ISO の日時（UTC）が、日本時間で何日か */
export function jstDate(isoDateTime: string): string {
  const time = Date.parse(isoDateTime);
  if (Number.isNaN(time)) return '';
  return new Date(time + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 取り消しの書き込み。その日（日本時間）の「反映済み」の記録だけ取り消せる */
export function planCancel(
  log: LogRecord,
  apps: LedgerApps,
  today: string,
  canceledBy: string,
  canceledAt: string
): Parsed<BulkRequest[]> {
  if (str(log, 'status') !== '反映済み') {
    return { ok: false, errors: ['この記録は、すでに取り消されています'] };
  }
  if (jstDate(str(log, 'entered_at')) !== today) {
    return { ok: false, errors: ['取り消せるのは、その日の更新だけです。前の日の更新は、管理者に直してもらってください'] };
  }
  let before: Record<string, unknown>;
  let after: Record<string, unknown>;
  try {
    before = JSON.parse(str(log, 'before')) as Record<string, unknown>;
    after = JSON.parse(str(log, 'after')) as Record<string, unknown>;
  } catch {
    return { ok: false, errors: ['記録の中身が読めません。管理者に直してもらってください'] };
  }
  const logId = str(log, '$id');
  const closeLog = put(apps.log, logId, null, {
    status: value('取り消し'),
    canceled_by: value(canceledBy),
    canceled_at: value(canceledAt),
  });

  if (str(log, 'type') === '名義変更') {
    const oldOwnership = before.oldOwnership as { id: string; end_date: string; status: string } | undefined;
    const oldMember = before.oldMember as { id: string; status: string } | undefined;
    const reusedMember = before.reusedMember as { id: string; display: string; status: string } | undefined;
    const reusedOwnership = before.reusedOwnership as
      | { id: string; member: string; start_date: string; end_date: string; status: string }
      | undefined;
    const ids = after.ids as { member?: string; ownership?: string } | undefined;
    const newMember = after.newMember as { display: string } | undefined;
    const newOwnership = after.newOwnership as { start_date: string } | undefined;
    if (!oldOwnership || !oldMember || !ids?.member || !ids.ownership || !newMember || !newOwnership) {
      return { ok: false, errors: ['取り消しに使う記録が足りません。管理者に直してもらってください'] };
    }
    // 作った組合員は消さずに「無効」にし、表示は重複の禁止にかからないよう「（取り消し 記録番号）」を付ける。
    // 前に取り消した組合員を使い直していたら、使い直す前の状態（表示・状況）に戻す
    const canceledDisplay = reusedMember?.display ?? `${newMember.display}（取り消し ${logId}）`;
    const canceledStatus = reusedMember?.status ?? '無効';
    return {
      ok: true,
      value: [
        put(apps.ownership, oldOwnership.id, null, {
          end_date: value(oldOwnership.end_date),
          status: value(oldOwnership.status),
        }),
        put(apps.member, oldMember.id, null, { status: value(oldMember.status) }),
        put(apps.member, ids.member, null, { status: value(canceledStatus), display: value(canceledDisplay) }),
        // 前に取り消した所有状況を使い直していたら、使い直す前の状態に戻す
        reusedOwnership
          ? put(apps.ownership, ids.ownership, null, {
              member: value(reusedOwnership.member),
              start_date: value(reusedOwnership.start_date),
              end_date: value(reusedOwnership.end_date),
              status: value(reusedOwnership.status),
            })
          : put(apps.ownership, ids.ownership, null, {
              member: value(canceledDisplay),
              end_date: value(previousDay(newOwnership.start_date)),
              status: value('所有前'),
            }),
        closeLog,
      ],
    };
  }

  const member = before.member as { id: string; display: string } | undefined;
  const ownerships = (before.ownerships as string[] | undefined) ?? [];
  const parkings = (before.parkings as string[] | undefined) ?? [];
  if (!member) {
    return { ok: false, errors: ['取り消しに使う記録が足りません。管理者に直してもらってください'] };
  }
  if (parkings.length > 0 && !apps.parking) {
    return { ok: false, errors: ['駐車場契約のアプリが設定されていないので、取り消せません。管理者に頼んでください'] };
  }
  return {
    ok: true,
    value: [
      put(apps.member, member.id, null, { display: value(member.display) }),
      ...ownerships.map((id) => put(apps.ownership, id, null, { member: value(member.display) })),
      ...parkings.map((id) => put(apps.parking as string, id, null, { member: value(member.display) })),
      closeLog,
    ],
  };
}
