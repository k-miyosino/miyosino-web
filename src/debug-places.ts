/**
 * 周辺施設の Google Places API レスポンスをデバッグ確認するスクリプト
 *
 * 使用方法:
 *   npx tsx src/debug-places.ts [キーワード]
 *
 * 例:
 *   npx tsx src/debug-places.ts 幼稚
 *   npx tsx src/debug-places.ts ひばり
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

const CENTER = { latitude: 35.922196, longitude: 139.410215 };
const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchNearby';

const keyword = process.argv[2] ?? '';

const SEARCH_TARGETS = [
  { label: '教育（初等）系', includedTypes: ['primary_school', 'preschool', 'child_care_agency'], radius: 1500 },
  { label: '教育（中等）系', includedTypes: ['secondary_school', 'university', 'school'], radius: 3000 },
];

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY が未設定です');
    process.exit(1);
  }

  for (const target of SEARCH_TARGETS) {
    console.log(`\n=== ${target.label} (${target.includedTypes.join(', ')}) ===`);

    const res = await fetch(PLACES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.types,places.primaryType',
      },
      body: JSON.stringify({
        includedTypes: target.includedTypes,
        languageCode: 'ja',
        locationRestriction: {
          circle: { center: CENTER, radius: target.radius },
        },
      }),
    });

    if (!res.ok) {
      console.error(`API エラー [${res.status}]:`, await res.text());
      continue;
    }

    const data = (await res.json()) as { places?: { id: string; displayName?: { text: string }; types?: string[]; primaryType?: string }[] };
    const places = data.places ?? [];

    const filtered = keyword
      ? places.filter((p) => p.displayName?.text?.includes(keyword))
      : places;

    if (filtered.length === 0) {
      console.log(`  該当なし${keyword ? `（"${keyword}" を含む施設）` : ''}`);
      continue;
    }

    for (const p of filtered) {
      console.log(`\n  名前        : ${p.displayName?.text}`);
      console.log(`  primaryType : ${p.primaryType}`);
      console.log(`  types       : ${p.types?.join(', ')}`);
    }
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
