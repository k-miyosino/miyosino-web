/**
 * Google Places Text Search API で施設の primaryType / types を確認する診断スクリプト
 *
 * 使用方法:
 *   npm run check:place "施設名"
 *
 * 例:
 *   npm run check:place "ウェルパーク川越かわつる店"
 */

import { loadEnvLocal, requireEnv } from './script-utils';

loadEnvLocal();

const query = process.argv[2];
if (!query) {
  console.error('使用方法: npm run check:place "施設名"');
  process.exit(1);
}

const apiKey = requireEnv('GOOGLE_PLACES_API_KEY');

async function main() {
  const response = await fetch(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.primaryType,places.types',
      },
      body: JSON.stringify({ textQuery: query }),
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
    }[];
  };

  if (!data.places?.length) {
    console.log('施設が見つかりませんでした');
    return;
  }

  for (const place of data.places) {
    console.log(`\n名前        : ${place.displayName?.text ?? '(不明)'}`);
    console.log(`place_id    : ${place.id}`);
    console.log(`primaryType : ${place.primaryType ?? '(なし)'}`);
    console.log(`types       : ${(place.types ?? []).join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
