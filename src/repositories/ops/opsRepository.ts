import { OpsChatSummary, OpsOverview, OpsWorkersSummary } from '@/types/ops';
import { getToken } from '@/shared/utils/auth';

const OPS_API_ENDPOINT =
  process.env.NEXT_PUBLIC_OPS_API_URL ||
  'https://miyosino-ops.anorimura-miyosino.workers.dev';

/** 管理者でないとき（ops Worker が 403 を返したとき）に投げる */
export class OpsForbiddenError extends Error {
  constructor() {
    super('このページは管理者だけが見られます');
    this.name = 'OpsForbiddenError';
  }
}

async function requestOpsApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) {
    throw new Error('認証トークンがありません');
  }
  const response = await fetch(`${OPS_API_ENDPOINT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  if (response.status === 403) {
    throw new OpsForbiddenError();
  }
  if (!response.ok) {
    throw new Error(
      `運用ダッシュボードの読み込みに失敗しました（${response.status}）`
    );
  }
  return (await response.json()) as T;
}

export function fetchOpsOverview(): Promise<OpsOverview> {
  return requestOpsApi<OpsOverview>('/ops/overview');
}

export function fetchOpsChat(): Promise<OpsChatSummary> {
  return requestOpsApi<OpsChatSummary>('/ops/chat');
}

export function fetchOpsWorkers(): Promise<OpsWorkersSummary> {
  return requestOpsApi<OpsWorkersSummary>('/ops/workers');
}

export async function recordTaskDone(
  taskId: string,
  note: string
): Promise<void> {
  await requestOpsApi(`/ops/tasks/${encodeURIComponent(taskId)}/done`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

export async function recordSecretRotated(
  secretId: string,
  note: string
): Promise<void> {
  await requestOpsApi(`/ops/secrets/${encodeURIComponent(secretId)}/rotated`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

/** GitHub の公開リポジトリの状態（認証なしの GitHub API で、ブラウザから直接取る） */
const GITHUB_API = 'https://api.github.com/repos/k-miyosino/miyosino-web';

export interface GithubWorkflowRun {
  workflow: string;
  label: string;
  status: string;
  conclusion: string | null;
  branch: string;
  createdAt: string;
  url: string;
}

export interface GithubPullRequest {
  number: number;
  title: string;
  url: string;
  createdAt: string;
}

const WATCHED_WORKFLOWS = [
  { file: 'deploy.yml', label: 'Deploy（GitHub Pages）', branch: 'staging' },
  { file: 'deploy-workers.yml', label: 'Deploy Workers', branch: 'main' },
  { file: 'sync.yml', label: 'Sync Places', branch: undefined },
  {
    file: 'check-workers.yml',
    label: 'Check Worker Errors',
    branch: undefined,
  },
];

export async function fetchGithubStatus(): Promise<{
  runs: GithubWorkflowRun[];
  dependabotPulls: GithubPullRequest[];
}> {
  const runs = await Promise.all(
    WATCHED_WORKFLOWS.map(async ({ file, label, branch }) => {
      const query = new URLSearchParams({ per_page: '1' });
      if (branch) query.set('branch', branch);
      const response = await fetch(
        `${GITHUB_API}/actions/workflows/${file}/runs?${query}`
      );
      // 404 はワークフローがまだ main に無い（足したばかり）とき。その行だけ出さない
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`GitHub API ${response.status}`);
      const data = (await response.json()) as {
        workflow_runs: {
          status: string;
          conclusion: string | null;
          head_branch: string;
          created_at: string;
          html_url: string;
        }[];
      };
      const run = data.workflow_runs[0];
      return run
        ? {
            workflow: file,
            label,
            status: run.status,
            conclusion: run.conclusion,
            branch: run.head_branch,
            createdAt: run.created_at,
            url: run.html_url,
          }
        : null;
    })
  );

  const pullsResponse = await fetch(
    `${GITHUB_API}/pulls?state=open&per_page=50`
  );
  if (!pullsResponse.ok) throw new Error(`GitHub API ${pullsResponse.status}`);
  const pulls = (await pullsResponse.json()) as {
    number: number;
    title: string;
    html_url: string;
    created_at: string;
    user: { login: string };
  }[];

  return {
    runs: runs.filter((run): run is GithubWorkflowRun => run !== null),
    dependabotPulls: pulls
      .filter((pull) => pull.user.login === 'dependabot[bot]')
      .map((pull) => ({
        number: pull.number,
        title: pull.title,
        url: pull.html_url,
        createdAt: pull.created_at,
      })),
  };
}
