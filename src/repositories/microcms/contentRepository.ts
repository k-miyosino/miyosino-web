/**
 * MicroCMS コンテンツリポジトリ
 *
 * Cloudflare Workers 経由で MicroCMS からコンテンツを取得します。
 * API キーはサーバーサイド（Cloudflare Workers）で管理されます。
 */

import { ContentCategoryId } from '@/types/categories';
import {
  CommunityActivity,
  MicroCMSCommunityActivity,
  MicroCMSCommunityActivityListResponse,
  MicroCMSResidentCircle,
  MicroCMSResidentCircleListResponse,
  ResidentCircle,
} from '@/types/community';
import {
  CommonFacility,
  MicroCMSCommonFacility,
  MicroCMSCommonFacilityListResponse,
  MicroCMSService,
  MicroCMSServiceListResponse,
  Service,
} from '@/types/facilities';
import {
  Photo,
  MicroCMSCommonTopImage,
  MicroCMSTopImageListResponse,
} from '@/types/media';
import {
  Season,
  MicroCMSSeason,
  MicroCMSSeasonListResponse,
} from '@/types/seasons';
import { CONTENT_CATEGORIES } from '@/types/categories';

// MicroCMS カテゴリ配列の共通型
interface WithCategory {
  category?: Array<{ id: string; name: string }>;
}

/**
 * MicroCMS コンテンツを category でフィルタして取得する共通ヘルパー
 */
async function fetchContents<T extends WithCategory>(
  category: ContentCategoryId
): Promise<T[]> {
  const endpoint = process.env.NEXT_PUBLIC_CONTENTS_API_ENDPOINT;
  if (!endpoint) {
    throw new Error('NEXT_PUBLIC_CONTENTS_API_ENDPOINT が設定されていません');
  }

  const url = new URL(endpoint);
  url.searchParams.append('category', category);
  url.searchParams.append('orders', 'order');
  url.searchParams.append('getAll', 'true');

  const response = await fetch(url.toString(), { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(
      `コンテンツの取得に失敗しました: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as { contents: T[] };

  // サーバー側クエリに加え、クライアント側でも category でフィルタ
  return data.contents.filter(
    (item) =>
      Array.isArray(item.category) &&
      item.category.some((cat) => cat.id === category)
  );
}

// ---- 自治会活動 ----

export async function fetchCommunityActivities(): Promise<CommunityActivity[]> {
  const items = await fetchContents<MicroCMSCommunityActivity>(
    CONTENT_CATEGORIES.COMMUNITY_ACTIVITIES
  );
  return items.map((activity) => ({
    id: activity.id,
    createdAt: new Date(activity.createdAt),
    updatedAt: new Date(activity.updatedAt),
    title: activity.title,
    body: activity.body,
    icon: activity.icon,
    image: activity.image,
  }));
}

// ---- 住民サークル ----

function mapCircle(circle: MicroCMSResidentCircle): ResidentCircle {
  return {
    id: circle.id,
    createdAt: new Date(circle.createdAt),
    updatedAt: new Date(circle.updatedAt),
    name: circle.name ?? circle.title ?? '',
    category: circle.category?.[0]?.id ?? '',
    body: circle.body,
    icon: circle.icon,
  };
}

export async function fetchSportsCircles(): Promise<ResidentCircle[]> {
  const items = await fetchContents<MicroCMSResidentCircle>(
    CONTENT_CATEGORIES.COMMUNITY_CIRCLE_SPORTS
  );
  return items.map(mapCircle);
}

export async function fetchCultureCircles(): Promise<ResidentCircle[]> {
  const items = await fetchContents<MicroCMSResidentCircle>(
    CONTENT_CATEGORIES.COMMUNITY_CIRCLE_CULTURE
  );
  return items.map(mapCircle);
}

// ---- トップ画像 ----

export async function fetchTopImages(): Promise<Photo[]> {
  const endpoint = process.env.NEXT_PUBLIC_CONTENTS_API_ENDPOINT;
  if (!endpoint) {
    throw new Error('NEXT_PUBLIC_CONTENTS_API_ENDPOINT が設定されていません');
  }

  const url = new URL(endpoint);
  url.searchParams.append('category', CONTENT_CATEGORIES.TOP_IMAGE);
  url.searchParams.append('orders', 'order');
  url.searchParams.append('getAll', 'true');

  const response = await fetch(url.toString(), { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(
      `トップ画像の取得に失敗しました: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as MicroCMSTopImageListResponse;

  const fallback = { url: '/fallback.jpg', width: 0, height: 0 };

  return data.contents
    .filter((content: MicroCMSCommonTopImage) => {
      const img = content.photo ?? content.image;
      return img !== undefined;
    })
    .map((content: MicroCMSCommonTopImage) => {
      const img = content.photo ?? content.image ?? fallback;
      return {
        id: content.id,
        createdAt: new Date(content.createdAt),
        updatedAt: new Date(content.updatedAt),
        title: content.title,
        description: content.description,
        image: img,
        order: content.order ?? 0,
      };
    });
}

// ---- 四季 ----

export async function fetchSeasons(): Promise<Season[]> {
  const items = await fetchContents<MicroCMSSeason>(CONTENT_CATEGORIES.SEASON);
  return items.map((season) => ({
    id: season.id,
    createdAt: new Date(season.createdAt),
    updatedAt: new Date(season.updatedAt),
    title: season.title,
    description: season.description,
    body: season.body,
    order: season.order,
    icon: season.icon,
    image: season.image,
  }));
}

// ---- 共用施設 ----

export async function fetchCommonFacilities(): Promise<CommonFacility[]> {
  const items = await fetchContents<MicroCMSCommonFacility>(
    CONTENT_CATEGORIES.FACILITY
  );
  return items.map((facility) => ({
    id: facility.id,
    createdAt: new Date(facility.createdAt),
    updatedAt: new Date(facility.updatedAt),
    title: facility.title,
    description: facility.description,
    body: facility.body,
    icon: facility.icon,
    image: facility.image,
  }));
}

// ---- サービス ----

export async function fetchServices(): Promise<Service[]> {
  const items = await fetchContents<MicroCMSService>(
    CONTENT_CATEGORIES.SERVICE
  );
  return items.map((service) => ({
    id: service.id,
    createdAt: new Date(service.createdAt),
    updatedAt: new Date(service.updatedAt),
    title: service.title,
    description: service.description,
    body: service.body,
    icon: service.icon,
    image: service.image,
  }));
}
