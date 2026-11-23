/**
 * kintone の添付ファイルを、そのまま利用者に返す（お知らせ・各種申請・回覧板・グリーンウェルネス・会議情報の /…/file）
 *
 * 中身はメモリに読み込まず、kintone から受け取りながらそのまま流す。
 * Workers のメモリ上限（128MB）を超える録音ファイルなどでも返せるようにするため。
 */

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

/** kintone から受け取ったファイルの中身を、見出しごとそのまま流して返す */
export function streamKintoneFile(
  fileResponse: Response,
  extraHeaders: Record<string, string>
): Response {
  const headers = new Headers({
    'Content-Type':
      fileResponse.headers.get('Content-Type') || 'application/octet-stream',
    ...extraHeaders,
  });
  for (const name of ['Content-Disposition', 'Content-Length']) {
    const value = fileResponse.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  return new Response(fileResponse.body, { headers });
}

/**
 * fileKey のファイルを kintone のファイル API から取り出して返す。
 * fileKey がなければ 400、kintone がエラーならその状態を JSON で返す
 */
export async function downloadKintoneFile(
  fileKey: string | null,
  domain: string,
  apiToken: string,
  extraHeaders: Record<string, string>
): Promise<Response> {
  if (!fileKey) {
    return jsonResponse({ error: 'fileKey is required' }, 400, extraHeaders);
  }

  const fileResponse = await fetch(
    `https://${domain}/k/v1/file.json?fileKey=${encodeURIComponent(fileKey)}`,
    { method: 'GET', headers: { 'X-Cybozu-API-Token': apiToken } }
  );

  if (!fileResponse.ok) {
    return jsonResponse(
      { error: 'Failed to fetch file', message: fileResponse.statusText },
      fileResponse.status,
      extraHeaders
    );
  }

  return streamKintoneFile(fileResponse, extraHeaders);
}
