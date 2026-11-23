/**
 * 事務員専用ページの住戸の一覧の整理（officeUnits.ts）
 */

import { describe, expect, it } from 'vitest';
import { OfficeUnit } from '@/types/office';
import { groupUnitsByBuilding, ownerName } from './officeUnits';

function unit(
  name: string,
  building: string,
  owner: string | null,
  ownerConflict = false
): OfficeUnit {
  return {
    id: name,
    name,
    building,
    room: name.split('-')[1],
    owner: owner ? { display: owner, userCode: 'u', startDate: null } : null,
    ownerConflict,
  };
}

describe('groupUnitsByBuilding', () => {
  it('号棟ごとにまとめ、号棟を数字の順に並べる', () => {
    const groups = groupUnitsByBuilding([
      unit('10-101', '10', '10-101 A'),
      unit('2-101', '2', '2-101 B'),
      unit('2-102', '2', null),
    ]);
    expect(groups.map((g) => g.building)).toEqual(['2', '10']);
    expect(groups[0].units.map((u) => u.name)).toEqual(['2-101', '2-102']);
  });

  it('組合員のいない住戸と、所有が重なっている住戸を数える', () => {
    const [group] = groupUnitsByBuilding([
      unit('1-101', '1', null),
      unit('1-102', '1', '1-102 A', true),
      unit('1-103', '1', '1-103 B'),
    ]);
    expect(group.vacantCount).toBe(1);
    expect(group.conflictCount).toBe(1);
  });
});

describe('ownerName', () => {
  it('表示の先頭の物件名を除く', () => {
    expect(ownerName(unit('01-101', '1', '01-101 山田 太郎'))).toBe(
      '山田 太郎'
    );
  });

  it('物件名で始まらない表示は、そのまま返す', () => {
    expect(ownerName(unit('01-101', '1', '山田'))).toBe('山田');
  });

  it('組合員がいなければ空', () => {
    expect(ownerName(unit('01-101', '1', null))).toBe('');
  });
});
