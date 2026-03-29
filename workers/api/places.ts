/**
 * Cloudflare Workers - Kintone 周辺施設 API プロキシ (アプリ #120)
 *
 * 周辺施設（Google Places連携）データを公開エンドポイントで提供します。
 * 認証不要 — places データは非公開情報を含みません。
 *
 * エンドポイント:
 * - GET / — 全施設を距離昇順で返す
 */

interface Env {
  KINTONE_DOMAIN: string;    // 例: k-miyosino.cybozu.com
  KINTONE_API_TOKEN: string; // アプリ #120 用の API トークン
}

interface KintonePlace {
  $id: { value: string };
  place_id: { value: string };
  name_ja: { value: string };
  name_en: { value: string };
  category: { value: string };
  distance: { value: string }; // Kintone の数値フィールドは文字列で返る
  address: { value: string };
  phone: { value: string };
  website: { value: string };
  google_maps_url: { value: string };
  primary_type: { value: string };
}

interface KintoneRecordsResponse {
  records: KintonePlace[];
  totalCount?: string;
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

async function fetchAllKintoneRecords(env: Env): Promise<KintonePlace[]> {
  const APP_ID = 120;
  const PAGE_SIZE = 500;
  let offset = 0;
  const all: KintonePlace[] = [];

  while (true) {
    const url = new URL(`https://${env.KINTONE_DOMAIN}/k/v1/records.json`);
    url.searchParams.set('app', String(APP_ID));
    url.searchParams.set('totalCount', 'true');
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(offset));

    const response = await fetch(url.toString(), {
      headers: { 'X-Cybozu-API-Token': env.KINTONE_API_TOKEN },
      // @ts-expect-error cf は Cloudflare Workers 固有のプロパティ
      cf: { cacheTtl: 300, cacheEverything: true },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Kintone API error: ${response.status} ${response.statusText} - ${text}`
      );
    }

    const data = (await response.json()) as KintoneRecordsResponse;
    all.push(...data.records);

    if (data.records.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    if (!env.KINTONE_DOMAIN || !env.KINTONE_API_TOKEN) {
      console.error('[Places] Required environment variables are not set');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        }
      );
    }

    try {
      const records = await fetchAllKintoneRecords(env);

      // 距離昇順にソート
      records.sort(
        (a, b) => parseFloat(a.distance.value) - parseFloat(b.distance.value)
      );

      const places = records.map((r) => ({
        id: r.$id.value,
        placeId: r.place_id.value,
        nameJa: r.name_ja.value,
        nameEn: r.name_en.value,
        category: r.category.value,
        distance: parseFloat(r.distance.value),
        address: r.address.value,
        phone: r.phone.value,
        website: r.website.value,
        googleMapsUrl: r.google_maps_url.value,
        primaryType: r.primary_type.value,
      }));

      console.log(`[Places] Returning ${places.length} records`);

      return new Response(JSON.stringify({ places }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(),
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch (error) {
      console.error('[Places] Error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        }
      );
    }
  },
};
