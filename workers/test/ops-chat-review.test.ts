/**
 * チャットの見直しの一覧（_ops-chat-review.ts と ops.ts の /ops/chat・/ops/chat/review）
 */

import { describe, expect, it } from 'vitest';
import ops from '../api/ops';
import { CHAT_SYSTEM_PROMPT } from '../api/chat-guide';
import {
  CANNOT_ANSWER_PHRASE,
  OFF_TOPIC_PHRASE,
  isValidReviewKey,
} from '../api/_ops-chat-review';
import { TEST_SECRET, makeToken, silenceConsole } from './helpers';

silenceConsole();

const WORKER = 'https://miyosino-ops.example.workers.dev';

/**
 * D1 の代わり。SQL に含まれる言葉で返す結果を選ぶ（tables のキーが SQL に含まれていれば、その結果）。
 * INSERT は記録して成功にする
 */
function fakeD1(tables: Record<string, unknown[]> = {}) {
  const inserts: { sql: string; params: unknown[] }[] = [];
  const db = {
    prepare(sql: string) {
      let params: unknown[] = [];
      const results = () =>
        Object.entries(tables).find(([word]) => sql.includes(word))?.[1] ?? [];
      const statement = {
        bind(...values: unknown[]) {
          params = values;
          return statement;
        },
        async all() {
          return { results: results() };
        },
        async first() {
          return results()[0] ?? null;
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

// 見直しの候補（chat_logs と chat_feedback を UNION した結果の形）
const CANDIDATES = [
  {
    cid: 'conv-a',
    turn: 1,
    at: '2026-11-22 10:00:00',
    page: '/facilities',
    question: '集会所は何時まで使えますか',
    answer: `すみません、${CANNOT_ANSWER_PHRASE}。`,
    outcome: 'answered',
    rating: null,
  },
  // 同じ質問に「わからなかった」の評価も付いている（1件にまとめる）
  {
    cid: 'conv-a',
    turn: 1,
    at: '2026-11-22 10:01:00',
    page: '/facilities',
    question: '集会所は何時まで使えますか',
    answer: `すみません、${CANNOT_ANSWER_PHRASE}。`,
    outcome: 'answered',
    rating: 'not',
  },
  // 質問ログを保存しなかった会話の評価（質問と答えは無い）
  {
    cid: 'conv-b',
    turn: 2,
    at: '2026-11-21 09:00:00',
    page: '/',
    question: null,
    answer: null,
    outcome: null,
    rating: 'partly',
  },
  {
    cid: 'conv-c',
    turn: 1,
    at: '2026-11-20 08:00:00',
    page: '/',
    question: '天気は？',
    answer: `${OFF_TOPIC_PHRASE}。`,
    outcome: 'answered',
    rating: null,
  },
];

function makeEnv(reviews: unknown[] = []) {
  const chat = fakeD1({ 'FROM chat_logs l': CANDIDATES });
  const opsDb = fakeD1({ ops_chat_review: reviews });
  return {
    env: { JWT_SECRET: TEST_SECRET, OPS_DB: opsDb.db, CHAT_DB: chat.db },
    inserts: opsDb.inserts,
  };
}

interface ReviewResponse {
  review: {
    openCount: number;
    items: {
      key: string;
      reasons: string[];
      question: string | null;
      review: { status: string; done_by: string } | null;
    }[];
  };
}

async function getReview(env: ReturnType<typeof makeEnv>['env']) {
  const token = await makeToken({ admin: true });
  const response = await ops.fetch(
    new Request(`${WORKER}/ops/chat`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    env
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as ReviewResponse).review;
}

async function postReview(
  env: ReturnType<typeof makeEnv>['env'],
  body: unknown,
  admin = true
) {
  const token = await makeToken(
    admin ? { admin: true, name: '管理 花子' } : {}
  );
  return ops.fetch(
    new Request(`${WORKER}/ops/chat/review`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),
    env
  );
}

describe('見直しの一覧', () => {
  it('評価と答えの両方で当てはまった質問は1件にまとめ、理由を全部付ける', async () => {
    const { env } = makeEnv();
    const review = await getReview(env);
    expect(review.items.map((item) => item.key)).toEqual([
      'conv-a:1',
      'conv-b:2',
      'conv-c:1',
    ]);
    expect(review.items[0].reasons).toEqual(['cannot', 'not']);
    expect(review.items[1]).toMatchObject({
      question: null,
      reasons: ['partly'],
    });
    expect(review.items[2].reasons).toEqual(['offtopic']);
    expect(review.openCount).toBe(3);
  });

  it('いちばん新しい記録がその質問の状態になり、未対応の数から外れる', async () => {
    const { env } = makeEnv([
      // 新しい順に返る（SQL の ORDER BY done_at DESC）
      {
        item_key: 'conv-a:1',
        status: 'fixed',
        note: '',
        done_by: '管理 花子',
        done_at: '2026-11-22 12:00:00',
      },
      {
        item_key: 'conv-a:1',
        status: 'skipped',
        note: '',
        done_by: '管理 太郎',
        done_at: '2026-11-22 11:00:00',
      },
      {
        item_key: 'conv-c:1',
        status: 'open',
        note: '',
        done_by: '管理 花子',
        done_at: '2026-11-22 12:00:00',
      },
    ]);
    const review = await getReview(env);
    expect(review.items[0].review).toMatchObject({
      status: 'fixed',
      done_by: '管理 花子',
    });
    // 「未対応に戻した」ものは未対応に数える
    expect(review.openCount).toBe(2);
  });
});

describe('見直しの記録（POST /ops/chat/review）', () => {
  it('管理者の記録は、名前・状態・メモつきで残る', async () => {
    const { env, inserts } = makeEnv();
    const response = await postReview(env, {
      key: 'conv-a:1',
      status: 'fixed',
      note: ' 案内文に集会所の時間を足した ',
    });
    expect(response.status).toBe(200);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].params).toEqual([
      'conv-a:1',
      'fixed',
      '管理 花子',
      '案内文に集会所の時間を足した',
    ]);
  });

  it('管理者でなければ 403 で、記録も残らない', async () => {
    const { env, inserts } = makeEnv();
    const response = await postReview(
      env,
      { key: 'conv-a:1', status: 'fixed' },
      false
    );
    expect(response.status).toBe(403);
    expect(inserts).toHaveLength(0);
  });

  it.each([
    [{ key: 'conv-a', status: 'fixed' }, 'Invalid key'],
    [{ key: "x'; DROP TABLE x;--:1", status: 'fixed' }, 'Invalid key'],
    [{ key: 'conv-a:1', status: 'done' }, 'Invalid status'],
    [{ key: 'conv-a:1', status: 'fixed', note: 1 }, 'Invalid note'],
  ])('形の正しくない記録（%o）は 400', async (body, error) => {
    const { env, inserts } = makeEnv();
    const response = await postReview(env, body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error });
    expect(inserts).toHaveLength(0);
  });
});

describe('決まり文句', () => {
  it('案内文（chat-guide.ts）に、見直しで探す決まり文句が入っている', () => {
    // 案内文の言い回しを変えたら、_ops-chat-review.ts の決まり文句も直す
    expect(CHAT_SYSTEM_PROMPT).toContain(CANNOT_ANSWER_PHRASE);
    expect(CHAT_SYSTEM_PROMPT).toContain(OFF_TOPIC_PHRASE);
  });

  it('キーの形', () => {
    expect(isValidReviewKey('a1B2-c3:12')).toBe(true);
    expect(isValidReviewKey(':1')).toBe(false);
    expect(isValidReviewKey('a:12345')).toBe(false);
    expect(isValidReviewKey(1)).toBe(false);
  });
});
