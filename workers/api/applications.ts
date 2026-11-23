/**
 * Cloudflare Workers - Kintone 申請書API プロキシ
 *
 * このWorkerは組合員専用ページからkintoneの申請書データを取得するための
 * プロキシとして機能します。
 *
 * エンドポイント:
 * - GET /applications - 申請書データを取得（公開状態が「公開」のもののみ）
 * - GET /applications/file?fileKey=xxx - 添付ファイルをダウンロード
 *
 * 認証: JWTトークンで組合員認証を確認
 */

import { downloadKintoneFile } from './_file';

interface Env {
  KINTONE_DOMAIN: string; // 例: k-miyosino.cybozu.com
  KINTONE_API_TOKEN_APPLICATIONS: string; // 申請書アプリ用のAPIトークン（アプリID: 56）
  JWT_SECRET: string; // JWT検証用のシークレット
}

interface KintoneRecord {
  $id: {
    value: string;
  };
  title: {
    value: string;
  };
  applicationFile?: {
    value: Array<{
      fileKey: string;
      name: string;
      contentType: string;
      size: string;
    }>;
  };
  published: {
    value: string; // "公開" | "非公開"
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
    console.error('[Applications] JWT verification error:', error);
    return null;
  }
}

// kintone APIから申請書データを取得
async function fetchKintoneRecords(env: Env): Promise<KintoneRecordsResponse> {
  const appId = 56;

  const url = new URL(`https://${env.KINTONE_DOMAIN}/k/v1/records.json`);
  url.searchParams.append('app', appId.toString());
  // 注意: ラジオボタンフィールドはクエリでフィルタリングできないため、
  // 全レコードを取得してからフィルタリングする

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Cybozu-API-Token': env.KINTONE_API_TOKEN_APPLICATIONS,
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
    console.error('[Applications] Kintone API error details:', {
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

// kintoneのレコードをApplication型に変換
function convertKintoneRecordToApplication(record: KintoneRecord): {
  id: string;
  title: string;
  file?: {
    name: string;
    fileKey: string;
    size: string;
  };
} {
  // ファイル情報を変換（最初のファイルのみ使用）
  const fileInfo = record.applicationFile?.value?.[0];
  const file = fileInfo
    ? {
        name: fileInfo.name,
        fileKey: fileInfo.fileKey,
        size: fileInfo.size,
      }
    : undefined;

  return {
    id: record.$id.value,
    title: record.title.value,
    file,
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
    if (
      !env.KINTONE_DOMAIN ||
      !env.KINTONE_API_TOKEN_APPLICATIONS ||
      !env.JWT_SECRET
    ) {
      console.error(
        '[Applications] Required environment variables are not set'
      );
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
      if (path === '/applications' || path === '/applications/') {
        // 申請書データを取得
        const kintoneResponse = await fetchKintoneRecords(env);
        const applications = kintoneResponse.records
          .filter((record) => {
            // 「公開」のみを表示対象とする
            // ラジオボタンフィールドはクエリでフィルタリングできないため、取得後にフィルタリング
            return record.published?.value === '公開';
          })
          .map((record) => convertKintoneRecordToApplication(record));

        return new Response(JSON.stringify({ applications }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        });
      } else if (path === '/applications/file') {
        // 添付ファイルをダウンロード
        return downloadKintoneFile(url, env.KINTONE_DOMAIN, env.KINTONE_API_TOKEN_APPLICATIONS, corsHeaders(origin));
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
      console.error('[Applications] Error:', error);

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
