/**
 * 台帳の更新記録アプリの定義（workers/kintone/ledger-log.json）が、
 * office Worker の使うフィールドコード・選択肢と、OFFICE.md 0-3 の表に合っていること。
 * アプリは定義から作る（workers/scripts/create-kintone-apps.mjs）ので、ずれると本番で読み書きに失敗する
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import definition from '../kintone/ledger-log.json';
import {
  LEDGER_TYPES,
  LOG_FIELDS,
  LOG_STATUSES,
  LedgerContext,
  planRename,
  planTransfer,
} from '../api/_office-ledger';

interface FieldDefinition {
  type: string;
  code: string;
  unique?: boolean;
  options?: Record<string, { label: string; index: string }>;
}

const properties = definition.properties as Record<string, FieldDefinition>;
const codes = Object.keys(properties);

function optionsOf(code: string): string[] {
  return Object.entries(properties[code].options ?? {})
    .sort(([, a], [, b]) => Number(a.index) - Number(b.index))
    .map(([label]) => label);
}

const apps = { member: '96', ownership: '44', parking: '50', log: '200' };
const owner = {
  $id: { value: '10' },
  $revision: { value: '3' },
  property: { value: '01-101' },
  member: { value: '01-101 山田' },
  start_date: { value: '2010-04-01' },
  end_date: { value: null },
  status: { value: '所有中' },
  user: { value: [{ code: '01101yamada', name: '山田' }] },
};
const ctx: LedgerContext = {
  today: '2026-11-28',
  propertyOwnerships: [owner],
  member: {
    $id: { value: '5' },
    $revision: { value: '2' },
    display: { value: '01-101 山田' },
    status: { value: '有効' },
    user: owner.user,
  },
  memberOwnerships: [owner],
  memberParkings: [],
};

describe('台帳の更新記録アプリの定義', () => {
  it('フィールドコードはキーと code が同じ', () => {
    for (const [key, field] of Object.entries(properties)) expect(field.code).toBe(key);
  });

  it('Worker が読むフィールドがすべてある', () => {
    for (const code of LOG_FIELDS.filter((c) => c !== '$id')) expect(codes).toContain(code);
  });

  it('Worker が書くフィールド（名義変更・氏名の変更の両方）がすべてある', () => {
    const transfer = planTransfer(
      {
        type: '名義変更',
        submitKey: 'key-12345678',
        propertyName: '01-101',
        newName: '佐藤 次郎',
        newLogin: '01101sato',
        switchDate: '2026-12-01',
        transferDate: '2026-11-16',
      },
      ctx,
      apps,
      'x',
      '2026-11-28T00:00:00Z'
    );
    const rename = planRename(
      { type: '氏名の変更', submitKey: 'key-abcdefgh', propertyName: '01-101', newName: '山田 花子' },
      ctx,
      apps,
      'x',
      '2026-11-28T00:00:00Z'
    );
    for (const result of [transfer, rename]) {
      if (!result.ok) throw new Error(result.errors.join(' / '));
      for (const code of Object.keys(result.value.logRecord)) expect(codes).toContain(code);
    }
  });

  it('ドロップダウンの選択肢が Worker と同じ（順番も）', () => {
    expect(optionsOf('type')).toEqual([...LEDGER_TYPES]);
    expect(optionsOf('status')).toEqual([...LOG_STATUSES]);
  });

  it('送信キーは値の重複を禁止する（二重の登録を防ぐ）', () => {
    expect(properties.submit_key.unique).toBe(true);
  });

  it('住所・電話番号など、扱わない個人情報のフィールドがない', () => {
    for (const code of codes) expect(code).not.toMatch(/address|phone|move_in/);
  });

  it('人が kintone の画面で書き換えたり消したりできない（Worker だけが書く）', () => {
    for (const group of [definition.rights.clerkGroup, definition.rights.adminGroup]) {
      expect(group.recordAddable).toBe(false);
      expect(group.recordEditable).toBe(false);
      expect(group.recordDeletable).toBe(false);
    }
  });

  it('OFFICE.md 0-3 の表のフィールドコードと同じ', () => {
    const doc = readFileSync(join(__dirname, '..', '..', 'OFFICE.md'), 'utf8');
    const start = doc.indexOf('### 0-3.');
    const end = doc.indexOf('\n### ', start + 1);
    const section = doc.slice(start, end);
    const documented = [...section.matchAll(/^\| [^|]+ \| `([a-z_]+)` \|/gm)].map((m) => m[1]);
    expect(documented.sort()).toEqual([...codes].sort());
  });
});
