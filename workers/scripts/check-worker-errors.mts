/**
 * 直近24時間の Worker のエラーを調べ、1件でもあれば失敗で終わる（GitHub Actions の check-workers.yml から毎日実行）。
 * 失敗すると GitHub からメールが届く。結果の表は実行結果の Summary に出す。
 *
 * 実行: CLOUDFLARE_ANALYTICS_TOKEN=... node workers/scripts/check-worker-errors.mts
 * （Node.js 24 は .ts をそのまま実行できる）
 */

import { appendFileSync } from 'node:fs';
import { fetchWorkerErrors } from '../api/_worker-errors.ts';

/**
 * API から来た文字列をログと表に出せる形にする。
 * 改行や制御文字で偽のログ行を作られないよう空白にし、表を崩す | もエスケープする
 */
function toLogText(value: unknown): string {
  // eslint-disable-next-line no-control-regex
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\|/g, String.raw`\|`);
}

// process.exit() は Windows で通信の後始末と重なると落ちるので、終了コードだけを決めて最後まで進む
async function main(token: string): Promise<boolean> {
  const until = new Date();
  const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);
  const stats = await fetchWorkerErrors(token, since, until);
  const failed = stats.filter((stat) => stat.errors > 0);

  const lines = [
    '## Worker のエラー（直近24時間）',
    '',
    failed.length === 0
      ? 'エラーはありませんでした。'
      : `${failed.length} 個の Worker でエラーがありました。Cloudflare の各 Worker の「Logs」で中身を確かめてください。`,
    '',
    '| Worker | リクエスト | エラー | 内訳 |',
    '| --- | ---: | ---: | --- |',
    ...stats.map(
      (stat) =>
        `| ${toLogText(stat.name)} | ${stat.requests} | ${stat.errors} | ${Object.entries(
          stat.errorStatuses
        )
          .map(([status, count]) => `${toLogText(status)}: ${count}`)
          .join(', ')} |`
    ),
  ];
  const summary = lines.join('\n');
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }
  return failed.length === 0;
}

const token = process.env.CLOUDFLARE_ANALYTICS_TOKEN;
if (token) {
  try {
    if (!(await main(token))) process.exitCode = 1;
  } catch (error) {
    console.error(toLogText(error instanceof Error ? error.message : error));
    process.exitCode = 1;
  }
} else {
  console.error(
    'CLOUDFLARE_ANALYTICS_TOKEN がありません（GitHub の Settings → Secrets and variables → Actions に登録する。手順は OPS.md）'
  );
  process.exitCode = 1;
}
