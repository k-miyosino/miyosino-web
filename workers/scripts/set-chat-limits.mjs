// チャットボットの1日の回数上限を本番の D1（miyosino-chat）に設定するスクリプト
//
// 使い方（workers/ で）:
//   npm run chat:limits -- <1人1日の上限> <全員合計の1日の上限>
//   例: npm run chat:limits -- 30 500
//
// すぐに反映され、デプロイし直しても戻りません。0 にするとその上限で誰も使えなくなります。
// Windows でも動くよう、bash ではなく Node で書き、wrangler もシェルを通さずに起動する。

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const [perUser, total] = process.argv.slice(2);
const isCount = (value) => typeof value === 'string' && /^\d+$/.test(value);

if (!isCount(perUser) || !isCount(total)) {
  console.error(
    '❌ 使い方: npm run chat:limits -- <1人1日の上限> <全員合計の1日の上限>（0以上の整数）'
  );
  console.error('   例: npm run chat:limits -- 30 500');
  process.exit(1);
}

if (Number(perUser) > Number(total)) {
  console.warn(
    `⚠️  1人の上限（${perUser}）が全員の上限（${total}）より大きくなっています。`
  );
}

// 値は上で整数だと確かめているので、SQL に直接埋め込んでよい
const sql =
  `INSERT INTO chat_settings (key, value) VALUES ('limit_per_user', '${perUser}'), ('limit_total', '${total}') ` +
  'ON CONFLICT (key) DO UPDATE SET value = excluded.value';

const workersDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wranglerBin = createRequire(import.meta.url).resolve('wrangler/bin/wrangler.js');

const result = spawnSync(
  process.execPath,
  [
    wranglerBin,
    'd1',
    'execute',
    'miyosino-chat',
    '--remote',
    '--config',
    'wrangler.chat.toml',
    '--command',
    sql,
  ],
  { cwd: workersDir, stdio: 'inherit' }
);

if (result.status !== 0) {
  console.error('❌ 設定できませんでした（上の wrangler のメッセージを確認してください）');
  process.exit(result.status ?? 1);
}

console.log(`✅ 1人1日 ${perUser} 回、全員合計で1日 ${total} 回に設定しました`);
