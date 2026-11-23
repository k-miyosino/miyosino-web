/**
 * Cloudflare Workers - Kintone 会議情報API プロキシ
 *
 * このWorkerは組合員専用ページからkintoneの会議情報データを取得するための
 * プロキシとして機能します。
 *
 * エンドポイント:
 * - GET /minutes - 会議情報データを取得
 * - GET /minutes/file?fileKey=xxx - 添付ファイルをダウンロード
 *
 * 認証: JWTトークンで組合員認証を確認
 */

interface Env {
  KINTONE_DOMAIN: string; // 例: k-miyosino.cybozu.com
  KINTONE_API_TOKEN_MINUTES: string; // 会議情報アプリ用のAPIトークン（アプリID: 48）
  JWT_SECRET: string; // JWT検証用のシークレット
}

interface KintoneRecord {
  $id: {
    value: string;
  };
  title: {
    value: string;
  };
  StartDateTime: {
    value: string; // ISO 8601形式: YYYY-MM-DDTHH:mm:ss
  };
  venue: {
    value: string;
  };
  category: {
    value: string;
  };
  materials?: {
    value: Array<{
      value: {
        relatedMaterialTitle?: {
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
      };
    }>;
  };
  minutes?: {
    value: Array<{
      fileKey: string;
      name: string;
      contentType: string;
      size: string;
    }>;
  };
  audio?: {
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
    console.error('[Minutes] JWT verification error:', error);
    return null;
  }
}

// kintone APIから会議情報データを取得
async function fetchKintoneRecords(
  env: Env,
  year?: number,
  month?: number
): Promise<KintoneRecordsResponse> {
  const appId = 48;
  let query = '';

  if (year && month) {
    // 指定された年月のデータを取得
    const startDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00Z`;
    query = `StartDateTime >= "${startDate}" and StartDateTime < "${endDate}"`;
  }

  const url = new URL(`https://${env.KINTONE_DOMAIN}/k/v1/records.json`);
  url.searchParams.append('app', appId.toString());
  if (query) {
    url.searchParams.append('query', query);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Cybozu-API-Token': env.KINTONE_API_TOKEN_MINUTES,
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
    console.error('[Minutes] Kintone API error details:', {
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

  const data = (await response.json()) as KintoneRecordsResponse;

  // デバッグ: Kintone APIからのレスポンスをログ出力
  if (data.records.length > 0) {
    const firstRecord = data.records[0];
    // ファイル添付フィールドを探す
    const fileFields = Object.keys(firstRecord).filter((key) => {
      const field = (firstRecord as any)[key];
      return field?.value && Array.isArray(field.value);
    });

    // materialsフィールドの詳細な構造を確認
    const materialsField = firstRecord.materials;
    console.log(
      '[Minutes] Kintone API response - materials field structure:',
      JSON.stringify(
        {
          hasMaterials: !!materialsField,
          materialsValue: materialsField?.value,
          materialsValueLength: materialsField?.value?.length,
          firstRow: materialsField?.value?.[0],
          firstRowType: typeof materialsField?.value?.[0],
          firstRowKeys: materialsField?.value?.[0]
            ? Object.keys(materialsField.value[0])
            : [],
          firstRowValue: materialsField?.value?.[0]?.value,
          firstRowValueType: typeof materialsField?.value?.[0]?.value,
          firstRowValueKeys: materialsField?.value?.[0]?.value
            ? Object.keys(materialsField.value[0].value)
            : [],
          firstRowTitle: materialsField?.value?.[0]?.value?.relatedMaterialTitle,
          firstRowTitleValue: materialsField?.value?.[0]?.value?.relatedMaterialTitle?.value,
          firstRowFile: materialsField?.value?.[0]?.value?.file,
          firstRowFileValue: materialsField?.value?.[0]?.value?.file?.value,
          firstRowFileValueLength:
            materialsField?.value?.[0]?.value?.file?.value?.length,
          firstFile: materialsField?.value?.[0]?.value?.file?.value?.[0],
        },
        null,
        2
      )
    );
  }

  return data;
}

// kintoneのレコードをMeeting型に変換
function convertKintoneRecordToMeeting(record: KintoneRecord): {
  id: string;
  title: string;
  StartDateTime: string;
  venue: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
  materials?: Array<{
    fileKey: string;
    name: string;
    contentType?: string;
    size?: string;
    title?: string;
  }>;
  minutes?: {
    fileKey: string;
    name: string;
    contentType?: string;
    size?: string;
  };
  audio?: {
    fileKey: string;
    name: string;
    contentType?: string;
    size?: string;
  };
  audios?: Array<{
    fileKey: string;
    name: string;
    contentType?: string;
    size?: string;
  }>;
} {
  // 必須フィールドのチェック
  if (!record.$id?.value) {
    throw new Error('Record ID is missing');
  }
  if (!record.title?.value) {
    throw new Error('Title is missing');
  }
  if (!record.StartDateTime?.value) {
    throw new Error('StartDateTime is missing');
  }
  if (!record.venue?.value) {
    throw new Error('Venue is missing');
  }
  if (!record.category?.value) {
    throw new Error('Category is missing');
  }

  // 資料（複数件）
  // materialsはテーブルフィールドで、各要素にfile（添付ファイル）フィールドがある
  const materialsField = record.materials;

  // デバッグ: materialsフィールドの構造を確認
  if (materialsField?.value) {
    const firstRow = materialsField.value[0];
    console.log(
      '[Minutes] Materials field debug:',
      JSON.stringify(
        {
          hasValue: !!materialsField.value,
          valueLength: materialsField.value.length,
          firstRowId: firstRow?.id,
          firstRowKeys: firstRow ? Object.keys(firstRow) : [],
          firstRowValue: firstRow?.value,
          firstRowValueType: typeof firstRow?.value,
          firstRowValueKeys: firstRow?.value ? Object.keys(firstRow.value) : [],
          firstRowFile: firstRow?.value?.file,
          firstRowFileType: typeof firstRow?.value?.file,
          firstRowFileKeys: firstRow?.value?.file
            ? Object.keys(firstRow.value.file)
            : [],
          firstRowFileValue: firstRow?.value?.file?.value,
          firstRowFileValueType: typeof firstRow?.value?.file?.value,
          firstRowFileValueIsArray: Array.isArray(firstRow?.value?.file?.value),
          firstRowFileValueLength: firstRow?.value?.file?.value?.length,
          firstFile: firstRow?.value?.file?.value?.[0],
          firstFileKeys: firstRow?.value?.file?.value?.[0]
            ? Object.keys(firstRow.value.file.value[0])
            : [],
        },
        null,
        2
      )
    );
  }

  // テーブルフィールドの各要素から、fileフィールドのファイルを取得
  const materials =
    materialsField?.value
      ?.flatMap((row: any, rowIndex: number) => {
        // デバッグ: 各行の構造を確認
        console.log(`[Minutes] Processing row ${rowIndex}:`, {
          row: row,
          rowType: typeof row,
          rowKeys: row ? Object.keys(row) : [],
          hasValue: !!row?.value,
          valueType: typeof row?.value,
          valueKeys: row?.value ? Object.keys(row.value) : [],
          hasTitle: !!row?.value?.relatedMaterialTitle,
          titleValue: row?.value?.relatedMaterialTitle?.value,
          titleType: typeof row?.value?.relatedMaterialTitle,
          hasFile: !!row?.value?.file,
          fileType: typeof row?.value?.file,
          fileKeys: row?.value?.file ? Object.keys(row.value.file) : [],
          fileValue: row?.value?.file?.value,
          fileValueType: typeof row?.value?.file?.value,
          fileValueIsArray: Array.isArray(row?.value?.file?.value),
          fileValueLength: row?.value?.file?.value?.length,
        });

        // テーブルの各行からfileフィールドを取得
        // 構造: row.value.file.value (配列)
        // 注意: テーブルの行にデータがない場合、row.valueが空オブジェクトになる可能性がある
        if (!row || !row.value || typeof row.value !== 'object') {
          console.log(`[Minutes] Row ${rowIndex} - invalid row structure`);
          return [];
        }

        const fileField = row.value.file;
        if (
          !fileField ||
          !fileField.value ||
          !Array.isArray(fileField.value) ||
          fileField.value.length === 0
        ) {
          console.log(
            `[Minutes] Row ${rowIndex} - no file field or empty file array`
          );
          return [];
        }

        // 各行のtitleを取得
        const rowTitle = row.value.relatedMaterialTitle?.value;
        console.log(
          `[Minutes] Row ${rowIndex} title:`,
          rowTitle,
          'type:',
          typeof rowTitle,
          'hasTitle:',
          !!row.value.relatedMaterialTitle
        );

        // 各ファイルを変換
        return fileField.value
          .map((file: any, fileIndex: number) => {
            console.log(
              `[Minutes] Processing file ${rowIndex}-${fileIndex}:`,
              file
            );
            if (!file || !file.fileKey) {
              console.warn(
                `[Minutes] Invalid file object at row ${rowIndex}, file ${fileIndex}:`,
                file
              );
              return null;
            }
            const material = {
              fileKey: file.fileKey || '',
              name: file.name || '',
              contentType: file.contentType || '',
              size: file.size || '',
            };
            // titleが存在し、空文字列でない場合のみ追加
            if (rowTitle && rowTitle.trim() !== '') {
              (material as any).title = rowTitle;
            }
            return material;
          })
          .filter((f: any) => f !== null);
      })
      .filter((f: any) => f && f.fileKey) || undefined;

  console.log('[Minutes] Final materials:', materials);

  // 議事録（最初のファイルのみ）
  const minutesFile = record.minutes?.value?.[0];
  const minutes = minutesFile
    ? {
        fileKey: minutesFile.fileKey,
        name: minutesFile.name,
        contentType: minutesFile.contentType,
        size: minutesFile.size,
      }
    : undefined;

  // 録音ファイル。総会などは1件の会議に複数のファイル（No.1, No.2 …）を付けるので、すべて返す。
  // audio は以前の画面のために最初のファイルだけを返す（Worker と画面は別々に公開されるため）
  const audios = (record.audio?.value ?? []).map((file) => ({
    fileKey: file.fileKey,
    name: file.name,
    contentType: file.contentType,
    size: file.size,
  }));
  const audio = audios[0];

  // createdAtとupdatedAtはKintoneのレコード作成日時を使用
  // Kintoneには$revisionフィールドがあるが、作成日時は別途取得が必要
  // ここでは現在時刻をデフォルトとして使用
  const now = new Date();

  return {
    id: record.$id.value,
    title: record.title.value,
    StartDateTime: record.StartDateTime.value,
    venue: record.venue.value,
    category: record.category.value,
    createdAt: now,
    updatedAt: now,
    materials,
    minutes,
    audio,
    audios,
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
      !env.KINTONE_API_TOKEN_MINUTES ||
      !env.JWT_SECRET
    ) {
      console.error('[Minutes] Required environment variables are not set');
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
      if (path === '/minutes' || path === '/minutes/') {
        // クエリパラメータから年月を取得
        const yearParam = url.searchParams.get('year');
        const monthParam = url.searchParams.get('month');
        const year = yearParam ? parseInt(yearParam, 10) : undefined;
        const month = monthParam ? parseInt(monthParam, 10) : undefined;

        // 会議情報データを取得
        const kintoneResponse = await fetchKintoneRecords(env, year, month);

        // デバッグ: 最初のレコードの構造を確認
        if (kintoneResponse.records.length > 0) {
          const firstRecord = kintoneResponse.records[0];
          console.log('[Minutes] First record keys:', Object.keys(firstRecord));
          console.log(
            '[Minutes] All fields with file attachments:',
            Object.keys(firstRecord).filter((key) => {
              const field = (firstRecord as any)[key];
              return (
                field?.value &&
                Array.isArray(field.value) &&
                field.value.length > 0 &&
                field.value[0]?.fileKey
              );
            })
          );
          console.log('[Minutes] Materials field check:', {
            hasMaterials: !!firstRecord.materials,
            materialsValue: firstRecord.materials?.value,
            materialsLength: firstRecord.materials?.value?.length,
            allFields: Object.keys(firstRecord),
          });
        }

        const meetings = kintoneResponse.records
          .map((record) => {
            try {
              return convertKintoneRecordToMeeting(record);
            } catch (error) {
              console.error('[Minutes] Error converting record:', {
                recordId: record.$id?.value,
                error: error instanceof Error ? error.message : String(error),
                recordKeys: Object.keys(record),
              });
              // エラーが発生したレコードはスキップ
              return null;
            }
          })
          .filter(
            (meeting): meeting is NonNullable<typeof meeting> =>
              meeting !== null
          );

        // 開催日時の降順でソート（新しい順）
        meetings.sort((a, b) => {
          const dateA = new Date(a.StartDateTime);
          const dateB = new Date(b.StartDateTime);
          return dateB.getTime() - dateA.getTime();
        });

        return new Response(JSON.stringify({ meetings }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        });
      } else if (path === '/minutes/years') {
        // 会議情報が存在する年月の一覧を取得
        const kintoneResponse = await fetchKintoneRecords(env);
        const yearMonths = new Set<string>();

        kintoneResponse.records.forEach((record) => {
          const startDateTime = record.StartDateTime?.value;
          if (!startDateTime) {
            return;
          }

          const date = new Date(startDateTime);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          yearMonths.add(`${year}-${month}`);
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
      } else if (path === '/minutes/file') {
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
            'X-Cybozu-API-Token': env.KINTONE_API_TOKEN_MINUTES,
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

        // ファイルのContent-Typeを取得
        const contentType =
          fileResponse.headers.get('Content-Type') ||
          'application/octet-stream';
        const contentDisposition = fileResponse.headers.get(
          'Content-Disposition'
        );

        // ファイルデータを取得
        const fileData = await fileResponse.arrayBuffer();

        // ファイルを返す
        const headers = new Headers({
          'Content-Type': contentType,
          ...corsHeaders(origin),
        });

        if (contentDisposition) {
          headers.set('Content-Disposition', contentDisposition);
        }

        return new Response(fileData, {
          headers,
        });
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
      console.error('[Minutes] Error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: path,
        method: request.method,
      });
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
