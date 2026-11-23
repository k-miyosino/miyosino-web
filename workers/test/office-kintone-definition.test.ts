/**
 * 組合員申請アプリの定義（workers/kintone/member-application.json）が、
 * office Worker の使うフィールドコード・選択肢と、OFFICE.md 4-3-2 の表に合っていること。
 * アプリは定義から作る（workers/scripts/create-kintone-apps.mjs）ので、ずれると本番で読み書きに失敗する
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import definition from '../kintone/member-application.json';
import {
  APPLICANT_KINDS,
  APPLICATION_FIELDS,
  APPLICATION_STATUSES,
  APPLICATION_TYPES,
  PROXY_METHOD,
  parseApplicationInput,
  toKintoneRecord,
} from '../api/_office-applications';

interface FieldDefinition {
  type: string;
  code: string;
  required?: boolean;
  unique?: boolean;
  options?: Record<string, { label: string; index: string }>;
  lookup?: { relatedApp: { app: string }; relatedKeyField: string };
}

const properties = definition.properties as Record<string, FieldDefinition>;
const codes = Object.keys(properties);

function optionsOf(code: string): string[] {
  const options = properties[code].options ?? {};
  return Object.entries(options)
    .sort(([, a], [, b]) => Number(a.index) - Number(b.index))
    .map(([label]) => label);
}

describe('組合員申請アプリの定義', () => {
  it('フィールドコードはキーと code が同じ', () => {
    for (const [key, field] of Object.entries(properties)) {
      expect(field.code).toBe(key);
    }
  });

  it('Worker が読むフィールドがすべてある', () => {
    for (const code of APPLICATION_FIELDS.filter((c) => c !== '$id')) {
      expect(codes).toContain(code);
    }
  });

  it('Worker が書くフィールド（名義変更・情報変更の両方）がすべてある', () => {
    const today = '2026-11-23';
    const base = {
      submitKey: 'key-12345678',
      submittedDate: today,
      applicantKind: '組合員',
      propertyName: '01-101',
      newName: '新しい 名前',
    };
    for (const body of [
      { ...base, type: '名義変更', transferDate: today, switchDate: today },
      { ...base, type: '情報変更' },
    ]) {
      const parsed = parseApplicationInput(body, today);
      if (!parsed.ok) throw new Error(parsed.errors.join(' / '));
      for (const code of Object.keys(toKintoneRecord(parsed.value, '01-101 旧', 'x'))) {
        expect(codes).toContain(code);
      }
    }
  });

  it('ドロップダウンの選択肢が Worker と同じ（順番も）', () => {
    expect(optionsOf('type')).toEqual([...APPLICATION_TYPES]);
    expect(optionsOf('status')).toEqual([...APPLICATION_STATUSES]);
    expect(optionsOf('applicant_kind')).toEqual([...APPLICANT_KINDS]);
    expect(optionsOf('method')).toContain(PROXY_METHOD);
  });

  it('送信キーは値の重複を禁止する（二重の登録を防ぐ）', () => {
    expect(properties.submit_key.unique).toBe(true);
  });

  it('物件・組合員は、作るときにアプリ ID を入れるルックアップ', () => {
    expect(properties.property.lookup?.relatedApp.app).toBe('{{PROPERTY_APP_ID}}');
    expect(properties.property.lookup?.relatedKeyField).toBe('property_name');
    expect(properties.member.lookup?.relatedApp.app).toBe('{{MEMBER_APP_ID}}');
    expect(properties.member.lookup?.relatedKeyField).toBe('display');
  });

  it('事務員にも管理者にも、レコードの削除の権限を付けない', () => {
    expect(definition.rights.clerkGroup.recordDeletable).toBe(false);
    expect(definition.rights.adminGroup.recordDeletable).toBe(false);
  });

  it('OFFICE.md 4-3-2 の表のフィールドコードと同じ', () => {
    const doc = readFileSync(join(__dirname, '..', '..', 'OFFICE.md'), 'utf8');
    const start = doc.indexOf('#### 4-3-2.');
    const end = doc.indexOf('\n#', start + 1);
    const section = doc.slice(start, end);
    const documented = [...section.matchAll(/^\| [^|]+ \| `([a-z_]+)` \|/gm)].map((m) => m[1]);
    expect(documented.sort()).toEqual([...codes].sort());
  });
});
