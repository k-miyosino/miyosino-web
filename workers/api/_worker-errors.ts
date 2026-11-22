/**
 * Cloudflare の分析 API（GraphQL）から、Worker ごとのリクエスト数とエラー数を取る。
 *
 * 運用ダッシュボード（ops.ts）と、毎日のエラー確認（scripts/check-worker-errors.ts、GitHub Actions）の両方で使う。
 * scripts からは Node.js の型の取り除き（type stripping）でそのまま読み込むので、
 * このファイルは import を持たず、enum などの TypeScript だけの書き方を使わない。
 *
 * エラーに数えられるのは、Worker の中で例外が起きた・CPU 時間などの上限を超えた、といった失敗。
 * Worker が自分でエラーを受け止めて 500 を返したものは数えられない。
 * API トークンには「アカウント分析 読み取り（Account Analytics: Read）」の権限が必要。
 */

export const CLOUDFLARE_ACCOUNT_ID = 'e6544c934cee9bfb0cdfc5b155ce8aeb';
// 調べる Worker の名前の頭（このリポジトリの Worker はすべて miyosino- で始まる）
const SCRIPT_PREFIX = 'miyosino-';

export interface WorkerErrorStat {
  /** Worker の名前（miyosino-… の後ろ） */
  name: string;
  requests: number;
  errors: number;
  /** エラーの内訳（scriptThrewException など） */
  errorStatuses: Record<string, number>;
}

interface GraphqlRow {
  sum: { requests: number; errors: number };
  dimensions: { scriptName: string; status: string };
}

interface GraphqlResponse {
  data?: {
    viewer?: {
      accounts?: { workersInvocationsAdaptive?: GraphqlRow[] }[];
    };
  } | null;
  errors?: { message: string }[] | null;
}

const QUERY = `
query WorkerErrors($accountTag: string, $since: Time, $until: Time, $prefix: string) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(
        limit: 10000
        filter: { datetime_geq: $since, datetime_leq: $until, scriptName_like: $prefix }
      ) {
        sum { requests errors }
        dimensions { scriptName status }
      }
    }
  }
}`;

/** since から until まで（ISO 8601）の、Worker ごとのリクエスト数とエラー数（エラーの多い順） */
export async function fetchWorkerErrors(
  token: string,
  since: Date,
  until: Date = new Date()
): Promise<WorkerErrorStat[]> {
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        accountTag: CLOUDFLARE_ACCOUNT_ID,
        since: since.toISOString(),
        until: until.toISOString(),
        prefix: `${SCRIPT_PREFIX}%`,
      },
    }),
  });
  // トークンが違うときなども JSON の errors に理由が入っている（例: Authentication failed）
  const body = (await response.json().catch(() => ({}))) as GraphqlResponse;
  if (!response.ok || (body.errors && body.errors.length > 0)) {
    const reasons = (body.errors ?? []).map((e) => e.message).join(' / ');
    throw new Error(`Cloudflare GraphQL API ${response.status}: ${reasons}`);
  }
  const rows = body.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];

  const byName = new Map<string, WorkerErrorStat>();
  for (const row of rows) {
    const name = row.dimensions.scriptName.replace(SCRIPT_PREFIX, '');
    const stat = byName.get(name) ?? {
      name,
      requests: 0,
      errors: 0,
      errorStatuses: {},
    };
    stat.requests += row.sum.requests;
    stat.errors += row.sum.errors;
    if (row.sum.errors > 0) {
      const status = row.dimensions.status;
      stat.errorStatuses[status] = (stat.errorStatuses[status] ?? 0) + row.sum.errors;
    }
    byName.set(name, stat);
  }
  return [...byName.values()].sort(
    (a, b) => b.errors - a.errors || a.name.localeCompare(b.name)
  );
}
