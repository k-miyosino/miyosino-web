// チャットボットの質問ログと評価の管理コマンド（本番の D1 miyosino-chat に対して実行する）
//
// 使い方（workers/ で）:
//   npm run chat:log -- on|off               質問ログを保存する／しない
//   npm run chat:log-days -- 180             質問ログと評価を残す日数（1〜3650）
//   npm run chat:rating -- on|off            答えの下に評価のボタンを出す／出さない
//   npm run chat:logs                        直近の質問ログを表示する（20件）
//   npm run chat:logs -- --limit 100 --csv logs.csv   件数を変える／CSV に書き出す（Excel で開ける）
//   npm run chat:ratings                     直近30日の評価の集計と、「わからなかった」の質問と答え
//   npm run chat:ratings -- --days 7         集計する日数を変える
// どれも --local を付けると、ローカルの D1（wrangler dev 用）に対して実行する。
//
// 保存期間を変えたら、プライバシーポリシー（src/app/privacy/page.tsx）の日数も直すこと。
// Windows でも動くよう Node で書き、wrangler はシェルを通さずに起動する。

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workersDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wranglerBin = createRequire(import.meta.url).resolve('wrangler/bin/wrangler.js');

const RATING_LABELS = { understood: 'わかった', partly: '少しわかった', not: 'わからなかった' };

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function parseOptions(args) {
  const options = { local: false, limit: 20, days: 30, csv: undefined, rest: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--local') options.local = true;
    else if (arg === '--limit') options.limit = toCount(args[++i], '--limit', 1, 10000);
    else if (arg === '--days') options.days = toCount(args[++i], '--days', 1, 3650);
    else if (arg === '--csv') options.csv = args[++i] ?? fail('--csv のあとにファイル名を書いてください');
    else options.rest.push(arg);
  }
  return options;
}

function toCount(value, name, min, max) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) fail(`${name} には ${min}〜${max} の整数を書いてください`);
  const n = Number(value);
  if (n < min || n > max) fail(`${name} には ${min}〜${max} の整数を書いてください`);
  return n;
}

// SQL を D1 で実行し、結果の行を返す。値はすべて呼び出し側で確かめた整数か決まった文字列だけを埋め込む
function runSql(sql, { local }) {
  const result = spawnSync(
    process.execPath,
    [
      wranglerBin,
      'd1',
      'execute',
      'miyosino-chat',
      local ? '--local' : '--remote',
      '--config',
      'wrangler.chat.toml',
      '--json',
      '--command',
      sql,
    ],
    { cwd: workersDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    process.stdout.write(result.stdout ?? '');
    fail('D1 で実行できませんでした（上の wrangler のメッセージを確認してください）');
  }
  const out = result.stdout ?? '';
  const start = out.indexOf('[');
  if (start === -1) fail('wrangler の出力を読めませんでした');
  const data = JSON.parse(out.slice(start));
  return Array.isArray(data) ? data.flatMap((d) => d.results ?? []) : [];
}

function setSetting(key, value, options) {
  runSql(
    `INSERT INTO chat_settings (key, value) VALUES ('${key}', '${value}') ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    options
  );
}

function onOff(value, command) {
  if (value === 'on') return '1';
  if (value === 'off') return '0';
  return fail(`使い方: npm run ${command} -- on|off`);
}

function shorten(text, max) {
  const oneLine = String(text ?? '').replace(/\s+/g, ' ');
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

function toCsv(rows, columns) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [columns.map(([, label]) => escape(label)).join(',')];
  for (const row of rows) lines.push(columns.map(([key]) => escape(row[key])).join(','));
  return `﻿${lines.join('\r\n')}\r\n`; // BOM 付き（Excel で文字化けしないように）
}

function showLogs(options) {
  const rows = runSql(
    `SELECT datetime(created_at, '+9 hours') AS jst, conversation_id, turn, page, question, answer, outcome
       FROM chat_logs ORDER BY id DESC LIMIT ${options.limit}`,
    options
  );
  if (options.csv) {
    const columns = [
      ['jst', '日時（日本時間）'],
      ['conversation_id', '会話ID'],
      ['turn', '何番目'],
      ['page', 'ページ'],
      ['question', '質問'],
      ['answer', '答え'],
      ['outcome', '結果'],
    ];
    writeFileSync(options.csv, toCsv(rows, columns), 'utf8');
    console.log(`✅ ${rows.length} 件を ${options.csv} に書き出しました`);
    return;
  }
  if (rows.length === 0) return console.log('質問ログはまだありません');
  for (const row of rows.reverse()) {
    console.log(`[${row.jst}] ${row.page || '-'}（会話 ${String(row.conversation_id).slice(0, 8)} の ${row.turn} 問目）`);
    console.log(`  質問: ${shorten(row.question, 120)}`);
    console.log(`  答え: ${shorten(row.answer, 200)}${row.outcome === 'refused' ? '（断られた）' : ''}`);
  }
}

function showRatings(options) {
  const since = `-${options.days} days`;
  const counts = runSql(
    `SELECT rating, COUNT(*) AS n FROM chat_feedback WHERE created_at >= datetime('now', '${since}') GROUP BY rating`,
    options
  );
  const total = counts.reduce((s, r) => s + Number(r.n), 0);
  console.log(`直近 ${options.days} 日の評価: ${total} 件`);
  for (const key of Object.keys(RATING_LABELS)) {
    const n = Number(counts.find((r) => r.rating === key)?.n ?? 0);
    const pct = total ? Math.round((n / total) * 100) : 0;
    console.log(`  ${RATING_LABELS[key]}: ${n} 件（${pct}%）`);
  }
  const notUnderstood = runSql(
    `SELECT datetime(f.created_at, '+9 hours') AS jst, f.page, l.question, l.answer
       FROM chat_feedback f
       LEFT JOIN chat_logs l ON l.conversation_id = f.conversation_id AND l.turn = f.turn
      WHERE f.rating = 'not' AND f.created_at >= datetime('now', '${since}')
      ORDER BY f.id DESC LIMIT 50`,
    options
  );
  if (notUnderstood.length === 0) return;
  console.log('\n「わからなかった」の質問と答え（新しい順、50件まで）:');
  for (const row of notUnderstood) {
    console.log(`[${row.jst}] ${row.page || '-'}`);
    if (row.question === null || row.question === undefined) {
      console.log('  （質問ログなし: ログがオフか、「この会話を保存しない」が選ばれていた）');
    } else {
      console.log(`  質問: ${shorten(row.question, 120)}`);
      console.log(`  答え: ${shorten(row.answer, 200)}`);
    }
  }
}

const [command, ...args] = process.argv.slice(2);
const options = parseOptions(args);

switch (command) {
  case 'log':
    setSetting('log_enabled', onOff(options.rest[0], 'chat:log'), options);
    console.log(`✅ 質問ログを${options.rest[0] === 'on' ? '保存する' : '保存しない'}ようにしました`);
    break;
  case 'log-days': {
    const days = toCount(options.rest[0], '日数', 1, 3650);
    setSetting('log_retention_days', String(days), options);
    console.log(`✅ 質問ログと評価を ${days} 日間残すようにしました`);
    console.log('   プライバシーポリシー（src/app/privacy/page.tsx）の日数も直してください');
    break;
  }
  case 'rating':
    setSetting('feedback_enabled', onOff(options.rest[0], 'chat:rating'), options);
    console.log(`✅ 評価のボタンを${options.rest[0] === 'on' ? '出す' : '出さない'}ようにしました`);
    break;
  case 'logs':
    showLogs(options);
    break;
  case 'ratings':
    showRatings(options);
    break;
  default:
    fail('使い方: node scripts/chat-admin.mjs log|log-days|rating|logs|ratings（npm run chat:log などから呼ぶ）');
}
