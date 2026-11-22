/**
 * 運用ダッシュボードの Worker（ops.ts）: 管理者だけに答えること
 */

import { describe, expect, it } from 'vitest';
import ops from '../api/ops';
import {
  TEST_SECRET,
  json,
  makeToken,
  silenceConsole,
  stubFetch,
} from './helpers';

silenceConsole();

const WORKER = 'https://miyosino-ops.example.workers.dev';

/** D1 の代わり。SELECT は空の結果、INSERT は記録して成功にする */
function fakeD1() {
  const inserts: { sql: string; params: unknown[] }[] = [];
  const db = {
    prepare(sql: string) {
      let params: unknown[] = [];
      const statement = {
        bind(...values: unknown[]) {
          params = values;
          return statement;
        },
        async all() {
          return { results: [] };
        },
        async first() {
          return null;
        },
        async run() {
          inserts.push({ sql, params });
          return { success: true };
        },
      };
      return statement;
    },
  };
  return { db: db as unknown as D1Database, inserts };
}

function makeEnv(extra: Record<string, unknown> = {}) {
  const { db, inserts } = fakeD1();
  return {
    env: { JWT_SECRET: TEST_SECRET, OPS_DB: db, ...extra },
    inserts,
  };
}

function request(
  path: string,
  token?: string,
  init: RequestInit = {}
): Request {
  return new Request(`${WORKER}${path}`, {
    ...init,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe('管理者の確認', () => {
  it('トークンが無ければ 401', async () => {
    const { env } = makeEnv();
    const response = await ops.fetch(request('/ops/overview'), env);
    expect(response.status).toBe(401);
  });

  it('違う鍵で署名されたトークンは 401', async () => {
    const { env } = makeEnv();
    const token = await makeToken({ admin: true }, 'another-secret');
    const response = await ops.fetch(request('/ops/overview', token), env);
    expect(response.status).toBe(401);
  });

  it('組合員でも管理者でなければ 403（中身を返さない）', async () => {
    const { env } = makeEnv();
    const token = await makeToken();
    for (const path of ['/ops/overview', '/ops/chat', '/ops/workers']) {
      const response = await ops.fetch(request(path, token), env);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'forbidden' });
    }
  });

  it('管理者でなければ、記録も残せない', async () => {
    const { env, inserts } = makeEnv();
    const token = await makeToken();
    const response = await ops.fetch(
      request('/ops/tasks/dependabot-prs/done', token, {
        method: 'POST',
        body: '{}',
      }),
      env
    );
    expect(response.status).toBe(403);
    expect(inserts).toHaveLength(0);
  });

  it('管理者なら一覧を返す', async () => {
    const { env } = makeEnv();
    const token = await makeToken({ admin: true });
    const response = await ops.fetch(request('/ops/overview', token), env);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      tasks: { id: string; status: string }[];
      secrets: { name: string }[];
    };
    expect(body.tasks.length).toBeGreaterThan(0);
    // 秘密情報は名前と手順だけ（値の項目は無い）
    expect(body.secrets.map((s) => s.name)).toContain('JWT_SECRET');
    expect(JSON.stringify(body.secrets)).not.toMatch(/"value"/);
  });
});

describe('対応の記録', () => {
  it('管理者が「対応した」を押すと、名前とメモが残る', async () => {
    const { env, inserts } = makeEnv();
    const token = await makeToken({ admin: true, name: '管理 花子' });
    const response = await ops.fetch(
      request('/ops/tasks/dependabot-prs/done', token, {
        method: 'POST',
        body: JSON.stringify({ note: '3件マージ' }),
      }),
      env
    );
    expect(response.status).toBe(200);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].params).toEqual([
      'dependabot-prs',
      '管理 花子',
      '3件マージ',
    ]);
  });

  it('知らないタスクには記録しない（404）', async () => {
    const { env, inserts } = makeEnv();
    const token = await makeToken({ admin: true });
    const response = await ops.fetch(
      request('/ops/tasks/no-such-task/done', token, { method: 'POST' }),
      env
    );
    expect(response.status).toBe(404);
    expect(inserts).toHaveLength(0);
  });
});

describe('Worker のエラー（/ops/workers）', () => {
  it('分析 API のトークンが無ければ available: false', async () => {
    const { env } = makeEnv();
    const token = await makeToken({ admin: true });
    const response = await ops.fetch(request('/ops/workers', token), env);
    expect(await response.json()).toEqual({ available: false });
  });

  it('分析 API が断ったら、理由を返す（500 にしない）', async () => {
    stubFetch(() =>
      json({ errors: [{ message: 'Authentication failed' }] }, 400)
    );
    const { env } = makeEnv({ CLOUDFLARE_ANALYTICS_TOKEN: 'wrong' });
    const token = await makeToken({ admin: true });
    const response = await ops.fetch(request('/ops/workers', token), env);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('Authentication failed');
  });
});
