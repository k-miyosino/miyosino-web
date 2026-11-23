/**
 * Cloudflare Workers - Kintone 配布資料API プロキシ
 *
 * このWorkerは組合員専用ページからkintoneの配布資料データを取得するための
 * プロキシとして機能します。
 *
 * エンドポイント:
 * - GET /circulars - 配布資料データを取得
 * - GET /circulars/file?fileKey=xxx - 添付ファイルをダウンロード
 *
 * 認証: JWTトークンで組合員認証を確認
 */

import { streamKintoneFile } from './_file';

interface Env {
  KINTONE_DOMAIN: string; // 例: k-miyosino.cybozu.com
  KINTONE_API_TOKEN_CIRCULARS: string; // 配布資料アプリ用のAPIトークン（アプリID: 54）
  JWT_SECRET: string; // JWT検証用のシークレット
}

interface KintoneRecord {
  $id: {
    value: string;
  };
  title: {
    value: string;
  };
  distributionDate: {
    value: string; // YYYY-MM-DD形式
  };
  category: {
    value: string;
  };
  file?: {
    value: Array<{
      fileKey: string;
      name: string;
      contentType: string;
      size: string;
    }>;
  };
  distributor: {
    value: string;
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
    console.error('[Circulars] JWT verification error:', error);
    return null;
  }
}

// kintone APIから配布資料データを取得
async function fetchKintoneRecords(
  env: Env
): Promise<KintoneRecordsResponse> {
  const appId = 54;

  const url = new URL(
    `https://${env.KINTONE_DOMAIN}/k/v1/records.json`
  );
  url.searchParams.append('app', appId.toString());

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Cybozu-API-Token': env.KINTONE_API_TOKEN_CIRCULARS,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson;
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      errorJson = errorText;
    }
    console.error('[Circulars] Kintone API error details:', {
      status: response.status,
      statusText: response.statusText,
      url: url.toString(),
      domain: env.KINTONE_DOMAIN,
      appId: appId,
      errorBody: errorJson,
    });
    throw new Error(
      `Kintone API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorJson)}`
    );
  }

  return (await response.json()) as KintoneRecordsResponse;
}

// kintoneのレコードをCircular型に変換
function convertKintoneRecordToCircular(
  record: KintoneRecord
): {
  id: string;
  title: string;
  distributionDate: string;
  category: string;
  file?: {
    url: string;
    name: string;
    contentType: string;
    size: number;
    fileKey: string;
  };
  distributor: string;
} {
  // ファイル情報を変換（最初のファイルのみ使用）
  const fileInfo = record.file?.value?.[0];
  const file = fileInfo
    ? {
        url: '', // URLはフロントエンドで構築
        name: fileInfo.name,
        contentType: fileInfo.contentType,
        size: parseInt(fileInfo.size, 10),
        fileKey: fileInfo.fileKey,
      }
    : undefined;

  return {
    id: record.$id.value,
    title: record.title.value,
    distributionDate: record.distributionDate.value,
    category: record.category.value,
    file,
    distributor: record.distributor.value,
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
    if (!env.KINTONE_DOMAIN || !env.KINTONE_API_TOKEN_CIRCULARS || !env.JWT_SECRET) {
      console.error('[Circulars] Required environment variables are not set');
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
      if (path === '/circulars' || path === '/circulars/') {
        // 配布資料データを取得
        const kintoneResponse = await fetchKintoneRecords(env);
        const circulars = kintoneResponse.records.map((record) =>
          convertKintoneRecordToCircular(record)
        );

        // 配布日の降順でソート（新しい順）
        circulars.sort((a, b) => {
          const dateA = new Date(a.distributionDate);
          const dateB = new Date(b.distributionDate);
          return dateB.getTime() - dateA.getTime();
        });

        return new Response(JSON.stringify({ circulars }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        });
      } else if (path === '/circulars/years') {
        // 配布資料が存在する年月の一覧を取得（未来の日付を除外）
        const kintoneResponse = await fetchKintoneRecords(env);
        const yearMonths = new Set<string>();
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        kintoneResponse.records.forEach((record) => {
          const date = new Date(record.distributionDate.value);
          // 日付のみを比較（時刻は無視）
          date.setHours(0, 0, 0, 0);

          // 未来の日付の資料は除外
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
      } else if (path === '/circulars/file') {
        // 添付ファイルをダウンロード
        const fileKey = url.searchParams.get('fileKey');
        if (!fileKey) {
          return new Response(
            JSON.stringify({ error: 'fileKey is required' }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders(origin),
              },
            }
          );
        }

        // kintoneのファイルAPIを呼び出し
        const fileUrl = `https://${env.KINTONE_DOMAIN}/k/v1/file.json?fileKey=${encodeURIComponent(fileKey)}`;
        const fileResponse = await fetch(fileUrl, {
          method: 'GET',
          headers: {
            'X-Cybozu-API-Token': env.KINTONE_API_TOKEN_CIRCULARS,
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
      console.error('[Circulars] Error:', error);
      
      // エラーの詳細を取得
      let errorMessage = 'Internal server error';
      let errorDetails: any = {};
      
      if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = {
          name: error.name,
          stack: error.stack,
        };
      }
      
      // Kintone APIエラーの場合は詳細を追加
      if (errorMessage.includes('Kintone API error')) {
        errorDetails.kintoneError = true;
      }
      
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: errorMessage,
          details: errorDetails,
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

