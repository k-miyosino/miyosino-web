import { BaseEntity } from '@/shared/types';

// メディアの種類
export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
}

// Heroセクション用の写真データ
export interface Photo extends BaseEntity {
  title: string;
  description?: string;
  image: {
    url: string;
    width?: number;
    height?: number;
  };
  order: number;
}

// MicroCMS API用のトップイメージ型定義
export interface MicroCMSCommonTopImage {
  id: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  revisedAt?: string;
  title: string;
  description: string;
  body: string; // HTML（features、capacity、reservationを含む）
  icon?: string; // アイコン（1行テキスト）
  order?: number;
  /** MicroCMS / Cloudflare Workers API が返す画像（実際のAPIは photo を使用） */
  image?: {
    url: string;
    width?: number;
    height?: number;
  };
  /** トップ画像用APIが返す画像（photo で返る場合あり） */
  photo?: {
    url: string;
    width?: number;
    height?: number;
  };
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
export interface MicroCMSTopImageListResponse {
  contents: MicroCMSCommonTopImage[];
  totalCount: number;
  offset: number;
  limit: number;
}
