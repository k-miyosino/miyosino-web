/**
 * Cloudflare Workers - Kintone お知らせAPI プロキシ
 *
 * このWorkerは組合員専用ページからkintoneのお知らせデータを取得するための
 * プロキシとして機能します。
 *
 * エンドポイント:
 * - GET /announcements?year=YYYY&month=MM - お知らせデータを取得
 * - GET /announcements/years - お知らせが存在する年月の一覧を取得
 * - GET /announcements/file?fileKey=xxx - 添付ファイルをダウンロード
 *
 * 認証: JWTトークンで組合員認証を確認
 */

import { streamKintoneFile } from './_file';

interface Env {
  KINTONE_DOMAIN: string; // 例: k-miyosino.cybozu.com
  KINTONE_API_TOKEN: string; // アプリID: 53用のAPIトークン
  JWT_SECRET: string; // JWT検証用のシークレット
}

interface KintoneRecord {
  $id: {
    value: string;
  };
  title: {
    value: string;
  };
  body: {
    value: string;
  };
  date: {
    value: string;
  };
  importance: {
    value: string; // "必須" | "推奨" | "任意"
  };
  publish?: {
    value: string; // "公開" | "準備中"
  };
  destination?: {
    value: string;
  };
  attachment?: {
    value: Array<{
      fileKey: string;
      name: string;
      contentType: string;
      size: string;
    }>;
  };
}

interface KintoneRecordsResponse {
  records: KintoneRecord[];
}

interface JWTPayload {
  sub: string;
  name: string;
  email: string;
  iat: number;
  exp: number;
}

function corsHeaders(origin?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// JWT検証関数
async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(
      atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(data)
    );

    if (!valid) {
      return null;
    }

    const payload = JSON.parse(
      atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'))
    ) as JWTPayload;

    // 有効期限チェック
    if (payload.exp < Date.now() / 1000) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('[Announcements] JWT verification error:', error);
    return null;
  }
}

// kintone APIからお知らせデータを取得
async function fetchKintoneRecords(
  env: Env,
  year?: number,
  month?: number
): Promise<KintoneRecordsResponse> {
  const appId = 53;
  let query = '';

  if (year && month) {
    // 指定された年月のデータを取得
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    query = `date >= "${startDate}" and date < "${endDate}"`;
  }

  const url = new URL(
    `https://${env.KINTONE_DOMAIN}/k/v1/records.json`
  );
  url.searchParams.append('app', appId.toString());
  if (query) {
    url.searchParams.append('query', query);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Cybozu-API-Token': env.KINTONE_API_TOKEN,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Kintone API error: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as KintoneRecordsResponse;
}

// kintoneのレコードをAnnouncement型に変換
function convertKintoneRecordToAnnouncement(
  record: KintoneRecord,
  env: Env
): {
  id: string;
  title: string;
  description: string;
  importance: 1 | 2 | 3;
  date: Date;
  publish?: string;
  destination?: string;
  attachment?: Array<{ name: string; fileKey: string }>;
} {
  // importanceの文字列を数値に変換
  let importanceValue: 1 | 2 | 3 = 3; // デフォルトは"任意"
  const importanceStr = record.importance?.value || '';
  if (importanceStr === '必須') {
    importanceValue = 1;
  } else if (importanceStr === '推奨') {
    importanceValue = 2;
  } else if (importanceStr === '任意') {
    importanceValue = 3;
  }

  // 添付ファイルの情報を保存（fileKeyのみ保存、URLはフロントエンドで構築）
  const attachments =
    record.attachment?.value?.map((file) => ({
      name: file.name,
      fileKey: file.fileKey,
    })) || undefined;

  return {
    id: record.$id.value,
    title: record.title.value,
    description: record.body.value,
    importance: importanceValue,
    date: new Date(record.date.value),
    publish: record.publish?.value,
    destination: record.destination?.value,
    attachment: attachments,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || undefined;
    const path = url.pathname;

    // CORSプリフライトリクエストの処理
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(origin),
      });
    }

    // GETリクエストのみ許可
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      });
    }

    // 環境変数チェック
    if (!env.KINTONE_DOMAIN || !env.KINTONE_API_TOKEN || !env.JWT_SECRET) {
      console.error('[Announcements] Required environment variables are not set');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        }
      );
    }

    try {
      // JWTトークンで認証確認
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        });
      }

      const token = authHeader.substring(7);
      const payload = await verifyJWT(token, env.JWT_SECRET);
      if (!payload) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        });
      }

      // ルーティング
      if (path === '/announcements' || path === '/announcements/') {
        // お知らせデータを取得
        const year = url.searchParams.get('year')
          ? parseInt(url.searchParams.get('year')!, 10)
          : undefined;
        const month = url.searchParams.get('month')
          ? parseInt(url.searchParams.get('month')!, 10)
          : undefined;

        const kintoneResponse = await fetchKintoneRecords(env, year, month);
        const announcements = kintoneResponse.records
          .map((record) => convertKintoneRecordToAnnouncement(record, env))
          .filter((announcement) => {
            // 「公開」のみを表示対象とする
            return announcement.publish === '公開';
          });

        return new Response(JSON.stringify({ announcements }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        });
      } else if (path === '/announcements/years') {
        // お知らせが存在する年月の一覧を取得（未来の日付を除外）
        const kintoneResponse = await fetchKintoneRecords(env);
        const yearMonths = new Set<string>();
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        kintoneResponse.records.forEach((record) => {
          // 「公開」のみを対象とする
          const publishValue = record.publish?.value || '';
          if (publishValue !== '公開') {
            return;
          }

          const date = new Date(record.date.value);
          // 日付のみを比較（時刻は無視）
          date.setHours(0, 0, 0, 0);
          
          // 未来の日付のお知らせは除外
          if (date <= today) {
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            yearMonths.add(`${year}-${month}`);
          }
        });

        const yearMonthList = Array.from(yearMonths)
          .map((ym) => {
            const [year, month] = ym.split('-').map(Number);
            return { year, month };
          })
          .sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
          });

        return new Response(JSON.stringify({ yearMonths: yearMonthList }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        });
      } else if (path === '/announcements/file') {
        // 添付ファイルをダウンロード
        const fileKey = url.searchParams.get('fileKey');
        if (!fileKey) {
          return new Response(JSON.stringify({ error: 'fileKey is required' }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders(origin),
            },
          });
        }

        // kintoneのファイルAPIを呼び出し
        const fileUrl = `https://${env.KINTONE_DOMAIN}/k/v1/file.json?fileKey=${encodeURIComponent(fileKey)}`;
        const fileResponse = await fetch(fileUrl, {
          method: 'GET',
          headers: {
            'X-Cybozu-API-Token': env.KINTONE_API_TOKEN,
          },
        });

        if (!fileResponse.ok) {
          return new Response(
            JSON.stringify({
              error: 'Failed to fetch file',
              message: fileResponse.statusText,
            }),
            {
              status: fileResponse.status,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders(origin),
              },
            }
          );
        }

        return streamKintoneFile(fileResponse, corsHeaders(origin));
      } else {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        });
      }
    } catch (error) {
      console.error('[Announcements] Error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        }
      );
    }
  },
};

