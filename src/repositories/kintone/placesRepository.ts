/**
 * Kintone Places Repository
 *
 * Worker (miyosino-places-api) 経由で Kintone アプリ #120 から周辺施設データを取得し、
 * UI が使う NearbyFacility 型に変換します。
 */

import type {
  NearbyFacility,
  KintonePlaceRecord,
  KintonePlacesResponse,
} from '@/types/surrounding';

const PLACES_API_ENDPOINT =
  process.env.NEXT_PUBLIC_PLACES_API_ENDPOINT ||
  'https://miyosino-places-api.anorimura-miyosino.workers.dev';

// ---- カテゴリ → subCategory マッピング ----

function resolveSubCategory(record: KintonePlaceRecord): string {
  const { category, primaryType } = record;
  if (category === '教育（初等）' || category === '教育（中等）') {
    return 'educationFacilities';
  }
  if (
    category === '総合病院' ||
    category === '医療（診療所）' ||
    category === '動物病院'
  ) {
    return 'medicalFacilities';
  }
  if (category === '公共・生活') {
    return primaryType === 'bank' ? 'financialInstitutions' : 'publicFacilities';
  }
  return 'publicFacilities';
}

// ---- アイコン導出 ----

function resolveIcon(record: KintonePlaceRecord): string {
  const { category, primaryType } = record;
  if (category === '教育（初等）') return '🏫';
  if (category === '教育（中等）') return '🎓';
  if (category === '総合病院') return '🏥';
  if (category === '動物病院') return '🐾';
  if (category === '医療（診療所）') {
    if (primaryType === 'pharmacy') return '💊';
    if (primaryType === 'dentist' || primaryType === 'dental_clinic') return '🦷';
    return '🏥';
  }
  switch (primaryType) {
    case 'bank':
      return '🏦';
    case 'library':
      return '📚';
    case 'post_office':
      return '📮';
    case 'community_center':
    case 'city_hall':
      return '🏛️';
    default:
      return '🏢';
  }
}

// ---- 距離フォーマット ----

export function formatDistance(metres: number): string {
  if (metres < 1000) {
    return `約${Math.round(metres)}m`;
  }
  return `${(metres / 1000).toFixed(1)}km`;
}

// ---- メインエクスポート ----

export async function fetchPlaces(): Promise<NearbyFacility[]> {
  const response = await fetch(PLACES_API_ENDPOINT, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(
      `周辺施設データの取得に失敗しました: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as KintonePlacesResponse;

  return data.places.map((record: KintonePlaceRecord, index: number) => ({
    id: record.id,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    name: record.nameJa,
    description: formatDistance(record.distance),
    subCategory: resolveSubCategory(record),
    icon: resolveIcon(record),
    order: index, // Worker が距離昇順を保証しているため index = 距離順
    googleMapsUrl: record.googleMapsUrl || undefined,
    phone: record.phone || undefined,
  }));
}
