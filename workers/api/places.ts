/**
 * Cloudflare Workers - Kintone 周辺施設 API プロキシ
 *
 * 周辺施設（Google Places連携）データを公開エンドポイントで提供します。
 * 認証不要 — places データは非公開情報を含みません。
 *
 * エンドポイント:
 * - GET / — 全施設を距離昇順で返す
 */

import { corsHeaders, fetchAllKintoneRecords } from './_kintone';

interface Env {
  KINTONE_DOMAIN: string;          // 例: k-miyosino.cybozu.com
  KINTONE_APP_ID_PLACES: string;   // 周辺施設アプリの ID
  KINTONE_API_TOKEN_PLACES: string; // 周辺施設アプリ用の API トークン
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

    if (!env.KINTONE_DOMAIN || !env.KINTONE_APP_ID_PLACES || !env.KINTONE_API_TOKEN_PLACES) {
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
      const records = await fetchAllKintoneRecords<KintonePlace>(
        env.KINTONE_DOMAIN,
        env.KINTONE_APP_ID_PLACES,
        env.KINTONE_API_TOKEN_PLACES
      );

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
