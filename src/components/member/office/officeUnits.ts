import { OfficeUnit } from '@/types/office';

export interface BuildingGroup {
  building: string;
  units: OfficeUnit[];
  /** 所有中の組合員がいない住戸の数 */
  vacantCount: number;
  /** 所有中の記録が重なっている住戸の数（台帳の誤り） */
  conflictCount: number;
}

/** 住戸を号棟ごとにまとめる（号棟は数字として並べる。住戸の順は受け取った順のまま） */
export function groupUnitsByBuilding(units: OfficeUnit[]): BuildingGroup[] {
  const groups = new Map<string, OfficeUnit[]>();
  for (const unit of units) {
    const list = groups.get(unit.building) ?? [];
    list.push(unit);
    groups.set(unit.building, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ja', { numeric: true }))
    .map(([building, list]) => ({
      building,
      units: list,
      vacantCount: list.filter((u) => !u.owner).length,
      conflictCount: list.filter((u) => u.ownerConflict).length,
    }));
}

/** 組合員の表示（「01-101 山田」）から、先頭の物件名を除いた名前 */
export function ownerName(unit: OfficeUnit): string {
  const display = unit.owner?.display ?? '';
  return display.startsWith(`${unit.name} `)
    ? display.slice(unit.name.length + 1)
    : display;
}
