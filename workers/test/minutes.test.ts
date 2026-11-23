/**
 * 会議情報 Worker（minutes.ts）: 録音ファイルを複数返す
 *
 * 総会などは1件の会議に録音ファイルを複数（No.1, No.2 …）付ける。
 * audios ですべてを返し、以前の画面のために audio で最初の1つも返す。
 */

import { describe, expect, it } from 'vitest';
import minutes from '../api/minutes';
import { TEST_SECRET, json, makeToken, silenceConsole, stubFetch } from './helpers';

silenceConsole();

const KINTONE_DOMAIN = 'example.cybozu.com';
const env = { KINTONE_DOMAIN, KINTONE_API_TOKEN_MINUTES: 'token', JWT_SECRET: TEST_SECRET };

const file = (n: number) => ({
  fileKey: `key-${n}`,
  name: `rec-${n}.mp3`,
  contentType: 'audio/mpeg',
  size: String(n * 1000),
});

function record(id: string, audio: ReturnType<typeof file>[]) {
  return {
    $id: { value: id },
    title: { value: `会議 ${id}` },
    StartDateTime: { value: '2024-03-24T00:51:00Z' },
    venue: { value: '集会所ホール' },
    category: { value: '臨時総会　管理組合' },
    materials: { value: [] },
    minutes: { value: [] },
    audio: { value: audio },
  };
}

async function listMeetings() {
  const token = await makeToken();
  const response = await minutes.fetch(
    new Request('https://miyosino-minutes.example.workers.dev/minutes', {
      headers: { Authorization: `Bearer ${token}`, Origin: 'https://k-miyosino.com' },
    }),
    env
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    meetings: { id: string; audio?: { fileKey: string }; audios?: { fileKey: string; name: string }[] }[];
  };
  return Object.fromEntries(body.meetings.map((m) => [m.id, m]));
}

describe('会議情報の録音ファイル', () => {
  it('付いている録音ファイルを順にすべて返し、audio には最初の1つを入れる', async () => {
    stubFetch((url) =>
      url.hostname === KINTONE_DOMAIN && url.pathname === '/k/v1/records.json'
        ? json({ records: [record('1', [file(1), file(2), file(3)]), record('2', [file(9)]), record('3', [])] })
        : undefined
    );

    const meetings = await listMeetings();

    expect(meetings['1'].audios?.map((a) => a.fileKey)).toEqual(['key-1', 'key-2', 'key-3']);
    expect(meetings['1'].audio?.fileKey).toBe('key-1');
    expect(meetings['2'].audios?.map((a) => a.name)).toEqual(['rec-9.mp3']);
    expect(meetings['3'].audios).toEqual([]);
    expect(meetings['3'].audio).toBeUndefined();
  });
});
