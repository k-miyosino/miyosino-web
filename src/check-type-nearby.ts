/**
 * Google Places Nearby Search API で指定タイプの近隣施設を確認する診断スクリプト
 *
 * 使用方法:
 *   npm run check:type <タイプ名> [半径m]
 *
 * 例:
 *   npm run check:type physiotherapist
 *   npm run check:type physiotherapist 2000
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

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

const placeType = process.argv[2];
const radius = Number(process.argv[3] ?? 2000);

if (!placeType) {
  console.error('使用方法: npm run check:type <タイプ名> [半径m]');
  process.exit(1);
}

const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!apiKey) {
  console.error('GOOGLE_PLACES_API_KEY が設定されていません');
  process.exit(1);
}

const CENTER = { latitude: 35.922196, longitude: 139.410215 };

async function main() {
  console.log(`タイプ「${placeType}」を半径 ${radius}m で検索中...\n`);

  const response = await fetch(
    'https://places.googleapis.com/v1/places:searchNearby',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.primaryType,places.types,places.formattedAddress',
      },
      body: JSON.stringify({
        includedTypes: [placeType],
        languageCode: 'ja',
        locationRestriction: {
          circle: { center: CENTER, radius },
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    console.error(`API エラー [${response.status}]: ${err}`);
    process.exit(1);
  }

  const data = (await response.json()) as {
    places?: {
      id: string;
      displayName?: { text: string };
      primaryType?: string;
      types?: string[];
      formattedAddress?: string;
    }[];
  };

  if (!data.places?.length) {
    console.log('該当する施設が見つかりませんでした');
    return;
  }

  console.log(`${data.places.length} 件見つかりました:`);
  for (const place of data.places) {
    console.log(`\n名前        : ${place.displayName?.text ?? '(不明)'}`);
    console.log(`primaryType : ${place.primaryType ?? '(なし)'}`);
    console.log(`住所        : ${place.formattedAddress ?? '(なし)'}`);
    console.log(`types       : ${(place.types ?? []).join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
