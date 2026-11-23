/**
 * kintone の添付ファイルを、そのまま利用者に返す（お知らせ・各種申請・回覧板・グリーンウェルネス・会議情報の /…/file）
 *
 * 中身はメモリに読み込まず、kintone から受け取りながらそのまま流す。
 * Workers のメモリ上限（128MB）を超える録音ファイルなどでも返せるようにするため。
 */
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
