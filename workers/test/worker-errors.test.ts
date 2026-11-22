/**
 * Worker のエラー数の集計（_worker-errors.ts）
 */

import { describe, expect, it } from 'vitest';
import { fetchWorkerErrors } from '../api/_worker-errors';
import { json, silenceConsole, stubFetch } from './helpers';

silenceConsole();

function row(
  scriptName: string,
  status: string,
  requests: number,
  errors: number
) {
  return { sum: { requests, errors }, dimensions: { scriptName, status } };
}

function graphqlResponse(rows: unknown[]) {
  return json({
    data: { viewer: { accounts: [{ workersInvocationsAdaptive: rows }] } },
    errors: null,
  });
}

describe('fetchWorkerErrors', () => {
  it('Worker ごとに合計し、エラーの内訳をまとめ、エラーの多い順に並べる', async () => {
    const calls = stubFetch(() =>
      graphqlResponse([
        row('miyosino-auth', 'success', 50, 0),
        row('miyosino-chat', 'success', 100, 0),
        row('miyosino-chat', 'scriptThrewException', 3, 3),
        row('miyosino-chat', 'exceededCpu', 1, 1),
        row('miyosino-ops', 'scriptThrewException', 2, 2),
      ])
    );
    const stats = await fetchWorkerErrors(
      'token',
      new Date('2026-11-22T00:00:00Z'),
      new Date('2026-11-23T00:00:00Z')
    );
    expect(stats).toEqual([
      {
        name: 'chat',
        requests: 104,
        errors: 4,
        errorStatuses: { scriptThrewException: 3, exceededCpu: 1 },
      },
      {
        name: 'ops',
        requests: 2,
        errors: 2,
        errorStatuses: { scriptThrewException: 2 },
      },
      { name: 'auth', requests: 50, errors: 0, errorStatuses: {} },
    ]);

    // 期間と Worker の名前の頭を渡している
    const body = JSON.parse(String(calls[0].init?.body)) as {
      variables: Record<string, string>;
    };
    expect(body.variables.since).toBe('2026-11-22T00:00:00.000Z');
    expect(body.variables.until).toBe('2026-11-23T00:00:00.000Z');
    expect(body.variables.prefix).toBe('miyosino-%');
    expect(calls[0].init?.headers).toMatchObject({
      Authorization: 'Bearer token',
    });
  });

  it('API がエラーを返したら、その理由つきで失敗する', async () => {
    stubFetch(() =>
      json({ errors: [{ message: 'Authentication failed' }] }, 400)
    );
    await expect(fetchWorkerErrors('wrong', new Date())).rejects.toThrow(
      'Cloudflare GraphQL API 400: Authentication failed'
    );
  });

  it('200 でも errors があれば失敗にする（権限が足りないときなど）', async () => {
    stubFetch(() =>
      json({ data: null, errors: [{ message: 'not authorized' }] })
    );
    await expect(fetchWorkerErrors('token', new Date())).rejects.toThrow(
      'not authorized'
    );
  });
});
