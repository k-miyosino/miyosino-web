import { BaseEntity } from '@/shared/types/index';

// 周辺施設データ
export interface NearbyFacility extends BaseEntity {
  name: string;
  description: string;
  subCategory: string;
  category?: string;
  icon: string;
  order: number;
  // Kintone データから付与される任意フィールド
  googleMapsUrl?: string;
  phone?: string;
  website?: string;
}

// ---- Kintone Places API (アプリ #120) ----

/** Worker (miyosino-places-api) から返ってくる生データ */
export interface KintonePlaceRecord {
  id: string;
  placeId: string;
  nameJa: string;
  nameEn: string;
  category: string; // 例: "教育（初等）", "公共・生活"
  distance: number; // メートル
  address: string;
  phone: string;
  website: string;
  googleMapsUrl: string;
  primaryType: string; // 例: "bank", "library"
}

export interface KintonePlacesResponse {
  places: KintonePlaceRecord[];
}
