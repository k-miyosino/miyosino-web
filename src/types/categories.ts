/**
 * MicroCMSコンテンツのカテゴリ定義
 *
 * MicroCMSのコンテンツAPIで使用するカテゴリIDを定義します。
 * カテゴリIDはMicroCMSの管理画面で設定したカテゴリのIDと一致させる必要があります。
 */

/**
 * コンテンツカテゴリID
 */
export const CONTENT_CATEGORIES = {
  /** */
  TOP_IMAGE: 'top-image',
  /** お知らせ */
  NEWS: 'news',
  /** 団地の四季 */
  SEASON: 'season',
  /** 自治会活動 */
  COMMUNITY_ACTIVITIES: 'community-activities',
  /** 住民サークル（スポーツ・運動） */
  COMMUNITY_CIRCLE_SPORTS: 'community-circle-sports',
  /** 住民サークル（文化活動） */
  COMMUNITY_CIRCLE_CULTURE: 'community-circle-culture',
  /** 共用施設 */
  FACILITY: 'facility',
  /** サービス */
  SERVICE: 'service',
} as const;

/**
 * カテゴリIDの型
 */
export type ContentCategoryId =
  | typeof CONTENT_CATEGORIES.TOP_IMAGE
  | typeof CONTENT_CATEGORIES.NEWS
  | typeof CONTENT_CATEGORIES.SEASON
  | typeof CONTENT_CATEGORIES.COMMUNITY_ACTIVITIES
  | typeof CONTENT_CATEGORIES.COMMUNITY_CIRCLE_SPORTS
  | typeof CONTENT_CATEGORIES.COMMUNITY_CIRCLE_CULTURE
  | typeof CONTENT_CATEGORIES.FACILITY
  | typeof CONTENT_CATEGORIES.SERVICE;

/**
 * カテゴリIDの配列（全カテゴリ）
 */
export const ALL_CATEGORY_IDS = Object.values(CONTENT_CATEGORIES);

/**
 * カテゴリIDが有効かどうかをチェック
 */
export function isValidCategoryId(
  categoryId: string
): categoryId is ContentCategoryId {
  return ALL_CATEGORY_IDS.includes(categoryId as ContentCategoryId);
}
