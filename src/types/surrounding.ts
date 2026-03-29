import { BaseEntity } from '@/shared/types/index';

// 周辺施設データ
export interface NearbyFacility extends BaseEntity {
  name: string;
  description: string;
  subCategory: string;
  icon: string;
  order: number;
  // Kintone データから付与される任意フィールド
  googleMapsUrl?: string;
  phone?: string;
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

// MicroCMS API用のNearbyFacility型定義
export interface MicroCMSNearbyFacility {
  id: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  revisedAt?: string;
  title: string;
  description: string;
  subCategory?:
    | {
        id: string;
        name: string;
        createdAt?: string;
        updatedAt?: string;
        publishedAt?: string;
        revisedAt?: string;
        order?: number;
      }
    | string; // 文字列として返ってくる場合も考慮
  icon?: string; // アイコン（1行テキスト）
  order?: number; // 表示順
  category?: Array<{
    id: string;
    name: string;
    createdAt?: string;
    updatedAt?: string;
    publishedAt?: string;
    revisedAt?: string;
    order?: number;
  }>;
}

// MicroCMSのレスポンス型（contents配列）
export interface MicroCMSNearbyFacilityListResponse {
  contents: MicroCMSNearbyFacility[];
  totalCount: number;
  offset: number;
  limit: number;
}
