/**
 * Cloudflare Workers - Kintone 団地のあゆみ・修繕履歴 API プロキシ
 *
 * 団地の歴史イベントと修繕履歴データを公開エンドポイントで提供します。
 * 認証不要 — あゆみ・修繕データは非公開情報を含みません。
 *
 * エンドポイント:
 * - GET / — 全イベントを表示順昇順で返す
 */

import { corsHeaders, fetchAllKintoneRecords } from './_kintone';

interface Env {
  KINTONE_DOMAIN: string; // 例: k-miyosino.cybozu.com
  KINTONE_APP_ID_HISTORY: string; // 団地のあゆみ・修繕履歴アプリの ID
  KINTONE_API_TOKEN_HISTORY: string; // 団地のあゆみ・修繕履歴アプリ用の API トークン
}

interface KintoneTagRow {
  id: string;
  value: {
    tag_value: { value: string };
  };
}

interface KintoneHistoryRecord {
  $id: { value: string };
  year: { value: string };
  sort_order: { value: string }; // 数値フィールドは文字列で返る
  type: { value: string }; // "一般" | "修繕"
  event: { value: string };
  description: { value: string };
  tag_0: { value: KintoneTagRow[] }; // サブテーブル
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

    if (
      !env.KINTONE_DOMAIN ||
      !env.KINTONE_APP_ID_HISTORY ||
      !env.KINTONE_API_TOKEN_HISTORY
    ) {
      console.error('[History] Required environment variables are not set');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        }
      );
    }

    try {
      const records = await fetchAllKintoneRecords<KintoneHistoryRecord>(
        env.KINTONE_DOMAIN,
        env.KINTONE_APP_ID_HISTORY,
        env.KINTONE_API_TOKEN_HISTORY
      );

      // 表示順昇順にソート
      records.sort(
        (a, b) => parseInt(a.sort_order.value) - parseInt(b.sort_order.value)
      );

      const events = records.map((r) => ({
        id: r.$id.value,
        year: r.year.value,
        sortOrder: parseInt(r.sort_order.value),
        type: r.type.value,
        event: r.event.value,
        description: r.description.value,
        tag: r.tag_0.value
          .map((row) => row.value.tag_value.value)
          .filter(Boolean),
      }));

      console.log(`[History] Returning ${events.length} records`);

      return new Response(JSON.stringify({ events }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(),
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch (error) {
      console.error('[History] Error:', error);
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
