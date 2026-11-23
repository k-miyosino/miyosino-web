/**
 * 添付ファイルのダウンロード（お知らせ・各種申請・回覧板・グリーンウェルネス・会議情報の /…/file）
 *
 * Workers のメモリ上限（128MB）を超える録音ファイルなども返せるよう、
 * kintone から受け取った中身をメモリに読み込まず、そのまま流して返すことを確かめる。
 */

import { describe, expect, it } from 'vitest';
import announcements from '../api/announcements';
import applications from '../api/applications';
import circulars from '../api/circulars';
import greenwellness from '../api/greenwellness';
import minutes from '../api/minutes';
import { TEST_SECRET, makeToken, silenceConsole, stubFetch } from './helpers';

silenceConsole();

const KINTONE_DOMAIN = 'example.cybozu.com';

const env = {
  KINTONE_DOMAIN,
  KINTONE_API_TOKEN: 'token',
  KINTONE_API_TOKEN_APPLICATIONS: 'token',
  KINTONE_API_TOKEN_CIRCULARS: 'token',
  KINTONE_API_TOKEN_MINUTES: 'token',
  JWT_SECRET: TEST_SECRET,
};

type Worker = { fetch: (request: Request, env: never) => Promise<Response> };

const workers: [string, Worker][] = [
  ['announcements', announcements as unknown as Worker],
  ['applications', applications as unknown as Worker],
  ['circulars', circulars as unknown as Worker],
  ['greenwellness', greenwellness as unknown as Worker],
  ['minutes', minutes as unknown as Worker],
];

/** 最初の一片だけ送り、close() を呼ぶまで終わらない中身 */
function openStream(first: Uint8Array) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      c.enqueue(first);
    },
  });
  return {
    stream,
    finish(last: Uint8Array) {
      controller.enqueue(last);
      controller.close();
    },
  };
}

describe.each(workers)('%s の /file', (name, worker) => {
  async function download(): Promise<Response> {
    const token = await makeToken();
    return worker.fetch(
      new Request(`https://miyosino-${name}.example.workers.dev/${name}/file?fileKey=abc`, {
        headers: { Authorization: `Bearer ${token}`, Origin: 'https://k-miyosino.com' },
      }),
      env as never
    );
  }

  it('kintone の中身を流し終わる前に返し始め、中身と見出しをそのまま渡す', async () => {
    const upstream = openStream(new TextEncoder().encode('ID3-前半'));
    const calls = stubFetch((url) =>
      url.hostname === KINTONE_DOMAIN && url.pathname === '/k/v1/file.json'
        ? new Response(upstream.stream, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Content-Disposition': 'attachment; filename="rec.mp3"',
              'Content-Length': '20',
            },
          })
        : undefined
    );

    // 中身を丸ごと読み込む作りだと、kintone 側が終わるまでここで止まる
    const response = await Promise.race([
      download(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('中身を読み終えるまで返さなかった')), 500)
      ),
    ]);

    expect(calls[0].url.searchParams.get('fileKey')).toBe('abc');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="rec.mp3"');
    expect(response.headers.get('Content-Length')).toBe('20');

    upstream.finish(new TextEncoder().encode('-後半'));
    expect(await response.text()).toBe('ID3-前半-後半');
  });

  it('kintone がエラーを返したら、その状態を返す', async () => {
    stubFetch((url) =>
      url.hostname === KINTONE_DOMAIN ? new Response('not found', { status: 404 }) : undefined
    );
    const response = await download();
    expect(response.status).toBe(404);
  });
});
