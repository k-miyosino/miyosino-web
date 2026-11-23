/**
 * Cloudflare Workers - Kintone グリーンウェルネスファイルAPI プロキシ
 *
 * このWorkerは組合員専用ページからkintoneのグリーンウェルネスファイルデータを取得するための
 * プロキシとして機能します。
 *
 * エンドポイント:
 * - GET /greenwellness - グリーンウェルネスファイル一覧を取得
 * - GET /greenwellness/file?fileKey=xxx - ファイルをダウンロード
 *
 * 認証: JWTトークンで組合員認証を確認
 */

import { downloadKintoneFile } from './_file';

interface Env {
  KINTONE_DOMAIN: string; // 例: k-miyosino.cybozu.com
  KINTONE_API_TOKEN: string; // アプリID: 51用のAPIトークン
  JWT_SECRET: string; // JWT検証用のシークレット
}

interface KintoneRecord {
  $id: {
    value: string;
  };
  title: {
    value: string;
  };
  file: {
    value: Array<{
      fileKey: string;
      name: string;
      contentType: string;
      size: string;
    }>;
  };
  description: {
    value: string;
  };
  orderNumber: {
    value: string; // 数値文字列
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
    console.error('[GreenWellness] JWT verification error:', error);
    return null;
  }
}

// kintone APIからグリーンウェルネスファイルデータを取得
async function fetchKintoneRecords(
  env: Env
): Promise<KintoneRecordsResponse> {
  const appId = 51;
  // クエリなしで全レコードを取得（ソートは取得後に実行）

  const url = new URL(
    `https://${env.KINTONE_DOMAIN}/k/v1/records.json`
  );
  url.searchParams.append('app', appId.toString());

  console.log('[GreenWellness] Kintone API request:', {
    url: url.toString(),
    domain: env.KINTONE_DOMAIN,
    appId: appId,
    hasToken: !!env.KINTONE_API_TOKEN,
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Cybozu-API-Token': env.KINTONE_API_TOKEN,
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
    console.error('[GreenWellness] Kintone API error details:', {
      status: response.status,
      statusText: response.statusText,
      url: url.toString(),
      domain: env.KINTONE_DOMAIN,
      appId: appId,
      hasToken: !!env.KINTONE_API_TOKEN,
      tokenLength: env.KINTONE_API_TOKEN?.length || 0,
      errorBody: errorJson,
      errorText: errorText,
    });
    throw new Error(
      `Kintone API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorJson)}`
    );
  }

  const data = (await response.json()) as KintoneRecordsResponse;
  console.log('[GreenWellness] Kintone API success:', {
    recordCount: data.records.length,
    sampleRecordKeys: data.records[0] ? Object.keys(data.records[0]) : [],
    firstRecordFile: data.records[0]?.file?.value?.[0],
    firstRecordFileKeys: data.records[0]?.file?.value?.[0]
      ? Object.keys(data.records[0].file.value[0])
      : [],
    firstRecordFileSize: data.records[0]?.file?.value?.[0]?.size,
  });

  return data;
}

// kintoneのレコードをGreenWellnessFile型に変換
function convertKintoneRecordToGreenWellnessFile(
  record: KintoneRecord
): {
  id: string;
  title: string;
  description: string;
  orderNumber: number;
  file?: {
    name: string;
    fileKey: string;
    size?: string;
  };
} {
  // ファイル情報を取得（最初のファイルのみ使用）
  const fileInfo = record.file?.value?.[0];

  // デバッグ: ファイル情報の構造を確認
  if (fileInfo) {
    console.log('[GreenWellness] File info:', {
      hasFileInfo: !!fileInfo,
      fileInfoKeys: Object.keys(fileInfo),
      hasSize: 'size' in fileInfo,
      size: fileInfo.size,
      sizeType: typeof fileInfo.size,
    });
  }

  // orderNumberフィールドの値を取得（デバッグ用）
  const orderNumberValue = record.orderNumber?.value;
  const orderNumberParsed = parseInt(orderNumberValue || '0', 10);

  if (!orderNumberValue) {
    console.warn('[GreenWellness] orderNumber field is missing or empty:', {
      recordId: record.$id?.value,
      availableFields: Object.keys(record),
    });
  }

  return {
    id: record.$id.value,
    title: record.title.value,
    description: record.description.value,
    orderNumber: orderNumberParsed,
    file: fileInfo
      ? {
          name: fileInfo.name,
          fileKey: fileInfo.fileKey,
          size: fileInfo.size
            ? String(fileInfo.size)
            : undefined,
        }
      : undefined,
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
      console.error('[GreenWellness] Required environment variables are not set');
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
      if (path === '/greenwellness' || path === '/greenwellness/') {
        // グリーンウェルネスファイル一覧を取得
        console.log('[GreenWellness] Fetching records from Kintone app 51');
        const kintoneResponse = await fetchKintoneRecords(env);
        console.log('[GreenWellness] Received records:', {
          count: kintoneResponse.records.length,
          firstRecord: kintoneResponse.records[0]
            ? {
                id: kintoneResponse.records[0].$id?.value,
                title: kintoneResponse.records[0].title?.value,
                hasFile: !!kintoneResponse.records[0].file?.value,
                hasOrderNumber: !!kintoneResponse.records[0].orderNumber?.value,
                orderNumberValue: kintoneResponse.records[0].orderNumber?.value,
              }
            : null,
        });

        const files = kintoneResponse.records
          .map((record) => {
            try {
              return convertKintoneRecordToGreenWellnessFile(record);
            } catch (error) {
              console.error('[GreenWellness] Error converting record:', {
                recordId: record.$id?.value,
                error: error instanceof Error ? error.message : String(error),
                recordKeys: Object.keys(record),
              });
              throw error;
            }
          })
          .sort((a, b) => a.orderNumber - b.orderNumber); // orderNumberで昇順ソート（0から順）

        console.log('[GreenWellness] Converted files:', {
          count: files.length,
          files: files.map((f) => ({
            id: f.id,
            title: f.title,
            orderNumber: f.orderNumber,
            hasFile: !!f.file,
          })),
        });

        return new Response(JSON.stringify({ files }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        });
      } else if (path === '/greenwellness/file') {
        // ファイルをダウンロード
        return downloadKintoneFile(
          url.searchParams.get('fileKey'),
          env.KINTONE_DOMAIN,
          env.KINTONE_API_TOKEN,
          corsHeaders(origin)
        );
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
      console.error('[GreenWellness] Error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorDetails =
        error instanceof Error && error.stack
          ? error.stack
          : String(error);

      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: errorMessage,
          details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
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

