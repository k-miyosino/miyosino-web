/**
 * Google Places API (New) → Kintone 周辺施設同期スクリプト
 *
 * 使用方法:
 *   npm run sync:places
 *
 * 必要な環境変数:
 *   GOOGLE_PLACES_API_KEY    - Google Places API キー
 *   KINTONE_PLACES_DOMAIN    - Kintone ドメイン (例: your-domain.cybozu.com)
 *   KINTONE_PLACES_APP_ID    - Kintone アプリ ID
 *   KINTONE_PLACES_API_TOKEN - Kintone API トークン
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { KintoneRestAPIClient } from '@kintone/rest-api-client';

// ローカル開発用: .env.local を自動ロード（CI では GitHub Secrets が使われるためスキップ）
const envLocalPath = resolve(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  for (const line of readFileSync(envLocalPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#\s][^=]*)=(.*)/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["'](.*)["']$/, '$1');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

// ---------------------------------------------------------------------------
// 定数・設定
// ---------------------------------------------------------------------------

const CENTER = { latitude: 35.922196, longitude: 139.410215 };

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.types',
  'places.primaryType',
  'places.location',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
].join(',');

const KINTONE_CHUNK_SIZE = 100; // addRecords / updateRecords の上限

type SearchConfig = {
  includedTypes: string[];
  radius: number;
  category: string;
  // 名前の先頭N文字が同じ施設は Google の著名度順で最初の1件だけ残す
  deduplicateByNamePrefix?: number;
  // types 配列と施設名からカテゴリを自動判定する（教育系で有効化）
  useSmartCategory?: boolean;
  // primaryType がこれに含まれる施設を除外する
  excludedPrimaryTypes?: string[];
};

const SEARCH_CONFIGS: SearchConfig[] = [
  {
    includedTypes: ['primary_school', 'preschool'],
    radius: 1500,
    category: '教育（初等）',
    useSmartCategory: true,
  },
  {
    includedTypes: ['secondary_school', 'university', 'school'],
    radius: 3000,
    category: '教育（中等）', // 判定不能時のフォールバック
    deduplicateByNamePrefix: 4,
    useSmartCategory: true,
  },
  {
    includedTypes: ['hospital'],
    radius: 5000,
    category: '総合病院',
    deduplicateByNamePrefix: 4,
    excludedPrimaryTypes: ['veterinary_care', 'dentist', 'dental_clinic'],
  },
  {
    includedTypes: ['doctor', 'pharmacy', 'dentist', 'dental_clinic'],
    radius: 1500,
    category: '医療（診療所）',
  },
  {
    includedTypes: ['veterinary_care'],
    radius: 2000,
    category: '動物病院',
  },
  {
    includedTypes: [
      'library',
      'post_office',
      'bank',
      'community_center',
      'city_hall',
    ],
    radius: 1000,
    category: '公共・生活',
  },
];

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

type PlaceResult = {
  placeId: string;
  nameJa: string;
  nameEn: string;
  category: string;
  distance: number;
  address: string;
  phone: string;
  website: string;
  googleMapsUrl: string;
  primaryType: string;
};

type GooglePlace = {
  id: string;
  displayName?: { text: string; languageCode?: string };
  types?: string[];
  primaryType?: string;
  location?: { latitude: number; longitude: number };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
};

type GooglePlacesResponse = {
  places?: GooglePlace[];
};

type KintoneRecord = Record<string, { value: string | number }>;

// ---------------------------------------------------------------------------
// ユーティリティ関数
// ---------------------------------------------------------------------------

/**
 * Haversine 公式で2点間の直線距離を計算する（単位: メートル、整数）
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // 地球半径（メートル）
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * 配列を指定サイズのチャンクに分割する
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Google Places API 呼び出し
// ---------------------------------------------------------------------------

/**
 * 指定言語・カテゴリで施設を検索し、GooglePlace[] を返す
 */
async function fetchPlacesRaw(
  config: SearchConfig,
  apiKey: string,
  languageCode: string
): Promise<GooglePlace[]> {
  const body = {
    includedTypes: config.includedTypes,
    languageCode,
    locationRestriction: {
      circle: {
        center: CENTER,
        radius: config.radius,
      },
    },
  };

  const response = await fetch(PLACES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': PLACES_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Google Places API エラー [${response.status}] (${languageCode}): ${errorText}`
    );
  }

  const data = (await response.json()) as GooglePlacesResponse;
  return data.places ?? [];
}

/**
 * types 配列と施設名（日本語）から教育カテゴリを判定する
 * Google の汎用タイプ "school" を小学校/中学校に正しく分類するために使用
 */
function inferEducationCategory(
  types: string[],
  nameJa: string
): string | null {
  if (types.some((t) => ['preschool'].includes(t))) return '幼児教育';
  if (types.some((t) => ['primary_school'].includes(t))) return '教育（初等）';
  if (types.some((t) => ['secondary_school'].includes(t)))
    return '教育（中等）';
  if (types.some((t) => ['university'].includes(t))) return '教育（高等）';
  if (/保育|幼稚/.test(nameJa)) return '幼児教育';
  if (/小学校/.test(nameJa)) return '教育（初等）';
  if (/中学校|高校|高等学校/.test(nameJa)) return '教育（中等）';
  if (/大学/.test(nameJa)) return '教育（高等）';
  return null; // 判定不能 → 検索設定のカテゴリを使用
}

/**
 * カテゴリ設定に基づいて施設を検索し、日本語名・英語名・距離を返す（API 2回）
 */
async function fetchPlaces(
  config: SearchConfig,
  apiKey: string
): Promise<PlaceResult[]> {
  // 日本語（ロケーション等の詳細も取得）と英語名を並列取得
  const [jaPlaces, enPlaces] = await Promise.all([
    fetchPlacesRaw(config, apiKey, 'ja'),
    fetchPlacesRaw(config, apiKey, 'en'),
  ]);

  // 英語名マップを構築（place_id → 英語名）
  const enNames = new Map<string, string>(
    enPlaces
      .filter((p) => p.id && p.displayName?.text)
      .map((p) => [p.id, p.displayName!.text])
  );

  const results = jaPlaces
    .filter((p) => p.id && p.location && p.displayName?.text)
    .filter(
      (p) =>
        !config.excludedPrimaryTypes ||
        !config.excludedPrimaryTypes.includes(p.primaryType ?? '')
    )
    .map((p) => ({
      placeId: p.id,
      nameJa: p.displayName!.text,
      nameEn: enNames.get(p.id) ?? '',
      category:
        (config.useSmartCategory
          ? inferEducationCategory(p.types ?? [], p.displayName!.text)
          : null) ?? config.category,
      distance: calculateDistance(
        CENTER.latitude,
        CENTER.longitude,
        p.location!.latitude,
        p.location!.longitude
      ),
      address: p.formattedAddress ?? '',
      phone: p.nationalPhoneNumber ?? '',
      website: p.websiteUri ?? '',
      googleMapsUrl: p.googleMapsUri ?? '',
      primaryType: p.primaryType ?? '',
    }));

  // 名前の先頭N文字が同じ施設は Google の著名度順（先頭）で1件のみ残す
  if (config.deduplicateByNamePrefix) {
    const n = config.deduplicateByNamePrefix;
    const seen = new Set<string>();
    return results.filter((p) => {
      const key = p.nameJa.slice(0, n);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Kintone Upsert
// ---------------------------------------------------------------------------

async function syncToKintone(
  places: PlaceResult[],
  client: KintoneRestAPIClient,
  appId: number
): Promise<void> {
  // 既存レコードを全件取得して place_id → record id のマップを構築
  console.log('Kintone から既存レコードを取得中...');
  const existingRecords = await client.record.getAllRecords({
    app: appId,
    fields: ['$id', 'place_id'],
  });

  const existingMap = new Map<string, string>();
  for (const record of existingRecords) {
    const placeId = (record['place_id'] as { value: string }).value;
    const recordId = (record['$id'] as { value: string }).value;
    if (placeId) {
      existingMap.set(placeId, recordId);
    }
  }

  console.log(`既存レコード数: ${existingMap.size}`);

  // 新規追加 / 既存更新 に分類
  const toAdd: KintoneRecord[] = [];
  const toUpdate: { id: string; record: KintoneRecord }[] = [];

  for (const place of places) {
    const fields: KintoneRecord = {
      place_id: { value: place.placeId },
      name_ja: { value: place.nameJa },
      name_en: { value: place.nameEn },
      category: { value: place.category },
      distance: { value: place.distance },
      address: { value: place.address },
      phone: { value: place.phone },
      website: { value: place.website },
      google_maps_url: { value: place.googleMapsUrl },
      primary_type: { value: place.primaryType },
    };

    if (existingMap.has(place.placeId)) {
      toUpdate.push({ id: existingMap.get(place.placeId)!, record: fields });
    } else {
      toAdd.push(fields);
    }
  }

  // 今回取得できなかった place_id を削除対象として抽出
  const newPlaceIds = new Set(places.map((p) => p.placeId));
  const toDelete = [...existingMap.entries()]
    .filter(([placeId]) => !newPlaceIds.has(placeId))
    .map(([, recordId]) => ({ id: recordId }));

  console.log(
    `新規追加: ${toAdd.length} 件 / 更新: ${toUpdate.length} 件 / 削除: ${toDelete.length} 件`
  );

  // デバッグ: Google データと Kintone 送信データを比較
  console.log('[DEBUG] Google サンプル (places[0]):', JSON.stringify(places[0], null, 2));
  if (toAdd.length > 0) {
    console.log('[DEBUG] Kintone 送信サンプル (toAdd[0]):', JSON.stringify(toAdd[0], null, 2));
  }

  // 新規追加（100件チャンク）
  if (toAdd.length > 0) {
    let addedCount = 0;
    for (const c of chunk(toAdd, KINTONE_CHUNK_SIZE)) {
      await client.record.addRecords({ app: appId, records: c });
      addedCount += c.length;
      console.log(`  追加中... ${addedCount}/${toAdd.length} 件`);
    }
    console.log(`${toAdd.length} 件を追加しました`);
  }

  // 既存更新（100件チャンク）
  if (toUpdate.length > 0) {
    let updatedCount = 0;
    for (const c of chunk(toUpdate, KINTONE_CHUNK_SIZE)) {
      await client.record.updateRecords({ app: appId, records: c });
      updatedCount += c.length;
      console.log(`  更新中... ${updatedCount}/${toUpdate.length} 件`);
    }
    console.log(`${toUpdate.length} 件を更新しました`);
  }

  // 削除（100件チャンク）
  if (toDelete.length > 0) {
    let deletedCount = 0;
    for (const c of chunk(toDelete, KINTONE_CHUNK_SIZE)) {
      await client.record.deleteRecords({
        app: appId,
        ids: c.map((r) => r.id),
      });
      deletedCount += c.length;
      console.log(`  削除中... ${deletedCount}/${toDelete.length} 件`);
    }
    console.log(`${toDelete.length} 件を削除しました`);
  }
}

// ---------------------------------------------------------------------------
// メイン処理
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const {
    GOOGLE_PLACES_API_KEY,
    KINTONE_PLACES_DOMAIN,
    KINTONE_PLACES_APP_ID,
    KINTONE_PLACES_API_TOKEN,
  } = process.env;

  if (
    !GOOGLE_PLACES_API_KEY ||
    !KINTONE_PLACES_DOMAIN ||
    !KINTONE_PLACES_APP_ID ||
    !KINTONE_PLACES_API_TOKEN
  ) {
    console.error(
      '環境変数が不足しています。GOOGLE_PLACES_API_KEY / KINTONE_PLACES_DOMAIN / KINTONE_PLACES_APP_ID / KINTONE_PLACES_API_TOKEN を設定してください。'
    );
    process.exit(1);
  }

  const appId = Number(KINTONE_PLACES_APP_ID);
  if (isNaN(appId)) {
    console.error(
      `KINTONE_PLACES_APP_ID が無効な値です: ${KINTONE_PLACES_APP_ID}`
    );
    process.exit(1);
  }

  // Google Places API から全カテゴリの施設を取得
  console.log('Google Places API から施設情報を取得中...');
  const allPlaces = new Map<string, PlaceResult>();

  for (const config of SEARCH_CONFIGS) {
    console.log(
      `  カテゴリ「${config.category}」(${config.includedTypes.join(', ')}) 半径 ${config.radius}m を検索中...`
    );
    const places = await fetchPlaces(config, GOOGLE_PLACES_API_KEY);
    console.log(`  → ${places.length} 件取得`);

    // 同一 place_id は先着のカテゴリを優先
    for (const place of places) {
      if (!allPlaces.has(place.placeId)) {
        allPlaces.set(place.placeId, place);
      }
    }
  }

  // 名前が重複する施設は住所を付加して区別する（例: セブン銀行ATM）
  const nameCounts = new Map<string, number>();
  for (const place of allPlaces.values()) {
    nameCounts.set(place.nameJa, (nameCounts.get(place.nameJa) ?? 0) + 1);
  }
  for (const place of allPlaces.values()) {
    if ((nameCounts.get(place.nameJa) ?? 0) > 1 && place.address) {
      place.nameJa = `${place.nameJa}（${place.address}）`;
    }
  }

  console.log(`\n合計 ${allPlaces.size} 件（重複排除済み）`);

  // Kintone クライアントを初期化
  const client = new KintoneRestAPIClient({
    baseUrl: `https://${KINTONE_PLACES_DOMAIN}`,
    auth: { apiToken: KINTONE_PLACES_API_TOKEN },
  });

  // Upsert 処理
  await syncToKintone(Array.from(allPlaces.values()), client, appId);

  console.log('\n同期完了');
}

main().catch((err) => {
  console.error('同期中にエラーが発生しました:', err?.message ?? err);
  if (err?.errors) {
    console.error('詳細:', JSON.stringify(err.errors, null, 2));
  }
  process.exit(1);
});
