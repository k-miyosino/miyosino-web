/**
 * テキスト検索で施設名から types / primaryType を確認するスクリプト
 *
 * 使用方法:
 *   npx tsx src/debug-place-lookup.ts "川鶴ひばり幼稚園"
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

const query = process.argv[2];
if (!query) {
  console.error('使用方法: npx tsx src/debug-place-lookup.ts "施設名"');
  process.exit(1);
}

const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!apiKey) {
  console.error('GOOGLE_PLACES_API_KEY が未設定です');
  process.exit(1);
}

async function main() {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey!,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.types,places.primaryType,places.location,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'ja' }),
  });

  if (!res.ok) {
    console.error(`API エラー [${res.status}]:`, await res.text());
    process.exit(1);
  }

  const data = (await res.json()) as {
    places?: {
      id: string;
      displayName?: { text: string };
      types?: string[];
      primaryType?: string;
      location?: { latitude: number; longitude: number };
      formattedAddress?: string;
      nationalPhoneNumber?: string;
      websiteUri?: string;
      googleMapsUri?: string;
    }[];
  };

  for (const p of data.places ?? []) {
    console.log(`id          : ${p.id}`);
    console.log(`名前        : ${p.displayName?.text}`);
    console.log(`primaryType : ${p.primaryType}`);
    console.log(`types       : ${p.types?.join(', ')}`);
    console.log(`location    : ${p.location?.latitude}, ${p.location?.longitude}`);
    console.log(`住所        : ${p.formattedAddress}`);
    console.log(`電話        : ${p.nationalPhoneNumber}`);
    console.log(`website     : ${p.websiteUri}`);
    console.log(`maps URL    : ${p.googleMapsUri}`);
    console.log();
  }
}

main().catch((err) => { console.error(err?.message ?? err); process.exit(1); });
