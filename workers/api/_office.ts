/**
 * 事務員専用ページ（office Worker）の、kintone に頼らない計算。テストしやすいように分けている。
 *
 * 住戸は請求アプリ（union-dues-manager）の M_物件、所有者は M_組合員物件所有状況を読む（OFFICE.md 4 章）。
 * フィールドコードは union-dues-manager の kintone/definitions に合わせる。
 */

interface KintoneField<T> {
  value: T;
}

/** M_物件のレコード（使うフィールドだけ） */
export interface PropertyRecord {
  $id: KintoneField<string>;
  property_name: KintoneField<string>; // '01-101'
  building: KintoneField<string>; // 号棟（M_棟のルックアップ）
  room_number: KintoneField<string>;
}

/** M_組合員物件所有状況のレコード（使うフィールドだけ） */
export interface OwnershipRecord {
  $id: KintoneField<string>;
  property: KintoneField<string>; // 物件名（M_物件のルックアップ）
  member: KintoneField<string>; // 組合員の表示（M_組合員のルックアップ）
  start_date: KintoneField<string | null>; // 'YYYY-MM-DD'
  end_date: KintoneField<string | null>;
  user: KintoneField<{ code: string; name: string }[]>;
}

export interface UnitOwner {
  /** M_組合員の表示（物件名＋名前） */
  display: string;
  /** Kintone ユーザーのコード（ログイン名） */
  userCode: string;
  startDate: string | null;
}

export interface Unit {
  id: string;
  /** 物件名（'01-101'） */
  name: string;
  building: string;
  room: string;
  /** 今日の時点で所有中の組合員。いなければ null */
  owner: UnitOwner | null;
  /** 今日の時点で所有中の記録が 2 件以上ある（台帳の誤り。画面で知らせる） */
  ownerConflict: boolean;
}

/** その日に所有中か（開始日 ≤ その日 ≤ 終了日。開始日・終了日が空なら、その側は限りなし） */
export function isOwnedOn(ownership: OwnershipRecord, date: string): boolean {
  const start = ownership.start_date.value;
  const end = ownership.end_date.value;
  return (!start || start <= date) && (!end || date <= end);
}

/** 住戸の一覧に、その日に所有中の組合員を付ける。物件名の順に並べる */
export function buildUnits(
  properties: PropertyRecord[],
  ownerships: OwnershipRecord[],
  date: string
): Unit[] {
  const ownedByProperty = new Map<string, OwnershipRecord[]>();
  for (const ownership of ownerships) {
    if (!isOwnedOn(ownership, date)) continue;
    const key = ownership.property.value;
    const list = ownedByProperty.get(key) ?? [];
    list.push(ownership);
    ownedByProperty.set(key, list);
  }

  return properties
    .map((property) => {
      const owned = ownedByProperty.get(property.property_name.value) ?? [];
      const first = owned[0];
      return {
        id: property.$id.value,
        name: property.property_name.value,
        building: property.building.value,
        room: property.room_number.value,
        owner: first
          ? {
              display: first.member.value,
              userCode: first.user.value[0]?.code ?? '',
              startDate: first.start_date.value,
            }
          : null,
        ownerConflict: owned.length > 1,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ja', { numeric: true }));
}

/** 日本時間の今日（'YYYY-MM-DD'） */
export function todayJst(now: number = Date.now()): string {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
