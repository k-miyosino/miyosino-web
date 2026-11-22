'use client';

import { useCallback, useEffect, useState } from 'react';
import { OpsChatSummary, OpsOverview, OpsWorkersSummary } from '@/types/ops';
import {
  GithubPullRequest,
  GithubWorkflowRun,
  OpsForbiddenError,
  fetchGithubStatus,
  fetchOpsChat,
  fetchOpsOverview,
  fetchOpsWorkers,
} from '@/repositories/ops/opsRepository';

export interface GithubStatus {
  runs: GithubWorkflowRun[];
  dependabotPulls: GithubPullRequest[];
}

/** 読み込みの状態。data が null で error も null なら読み込み中 */
export interface Loadable<T> {
  data: T | null;
  error: string | null;
}

const LOADING = { data: null, error: null };

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : '読み込めませんでした';
}

/**
 * ダッシュボードで使うデータをまとめて読み込む。
 * まとめの数字（上のカード）がタスク・GitHub・チャット・Worker のすべてを使うため、各タブではなくここで取る。
 */
export function useOpsData() {
  const [forbidden, setForbidden] = useState(false);
  const [overview, setOverview] = useState<Loadable<OpsOverview>>(LOADING);
  const [chat, setChat] = useState<Loadable<OpsChatSummary>>(LOADING);
  const [github, setGithub] = useState<Loadable<GithubStatus>>(LOADING);
  const [workers, setWorkers] = useState<Loadable<OpsWorkersSummary>>(LOADING);

  const reloadOverview = useCallback(() => {
    fetchOpsOverview()
      .then((data) => setOverview({ data, error: null }))
      .catch((e) => {
        if (e instanceof OpsForbiddenError) setForbidden(true);
        else setOverview({ data: null, error: toMessage(e) });
      });
  }, []);

  useEffect(() => {
    reloadOverview();
    fetchOpsChat()
      .then((data) => setChat({ data, error: null }))
      .catch((e) => {
        if (!(e instanceof OpsForbiddenError)) {
          setChat({ data: null, error: toMessage(e) });
        }
      });
    fetchOpsWorkers()
      .then((data) => setWorkers({ data, error: null }))
      .catch((e) => {
        if (!(e instanceof OpsForbiddenError)) {
          setWorkers({ data: null, error: toMessage(e) });
        }
      });
    fetchGithubStatus()
      .then((data) => setGithub({ data, error: null }))
      .catch(() =>
        setGithub({
          data: null,
          error:
            'GitHub の状態を読み込めませんでした（時間をおいて開き直してください）',
        })
      );
  }, [reloadOverview]);

  return { forbidden, overview, chat, github, workers, reloadOverview };
}
