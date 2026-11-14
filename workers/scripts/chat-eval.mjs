// チャットボットの評価スクリプト
//
// 使い方（workers/ で）:
//   npm run chat:eval                       # eval/chat-questions.md の全問を送る
//   npm run chat:eval -- --model claude-sonnet-5-5   # モデルを変えて試す
//   npm run chat:eval -- --dry-run          # API を呼ばず、読み込んだ質問と案内文の長さだけ表示する
//
// Worker（api/chat.ts）と同じ部品（api/_chat-core.ts、api/_chat-knowledge.ts）を esbuild でまとめて読み込み、
// 同じ案内文・道具・設定で質問を1問ずつ送る。公開ページの中身は、公開の URL（SITE_URL と各 Worker）から読む。
// 答えと文字数などを eval/results/<日時>.md に保存する。D1 は使わず、利用回数にも数えない。
// API キーは環境変数 ANTHROPIC_API_KEY か、.dev.vars の ANTHROPIC_API_KEY を使う（表示はしない）。
// Windows でも動くよう Node で書いている。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workersDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 公開ページに表示される中身を取る Worker の公開 URL（環境変数で変えられる。公開サイトは CHAT_EVAL_SITE_URL）
const CONTENTS_URL = process.env.CHAT_EVAL_CONTENTS_URL || 'https://miyosino-contents-api.anorimura-miyosino.workers.dev';
const PLACES_URL = process.env.CHAT_EVAL_PLACES_URL || 'https://miyosino-places-api.anorimura-miyosino.workers.dev';
const HISTORY_URL = process.env.CHAT_EVAL_HISTORY_URL || 'https://miyosino-history-api.anorimura-miyosino.workers.dev';

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { model: undefined, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--model') args.model = argv[++i];
    else fail(`知らない引数です: ${argv[i]}`);
  }
  return args;
}

// Worker と同じ部品を esbuild でまとめて読み込む（esbuild は wrangler に含まれている）
async function loadCore() {
  const esbuild = createRequire(import.meta.url)('esbuild');
  const outfile = path.join(workersDir, 'eval', '.cache', 'chat-core.mjs');
  await esbuild.build({
    stdin: {
      contents: [
        "export { runChat, DEFAULT_MODEL } from './api/_chat-core.ts';",
        "export { getPageContent } from './api/_chat-knowledge.ts';",
        "export { CHAT_SYSTEM_PROMPT } from './api/chat-guide.ts';",
      ].join('\n'),
      resolveDir: workersDir,
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    outfile,
    logLevel: 'error',
  });
  return import(pathToFileURL(outfile).href);
}

// wrangler.chat.toml の [vars] の値（CHAT_MODEL、SITE_URL）
function loadVar(name) {
  const toml = readFileSync(path.join(workersDir, 'wrangler.chat.toml'), 'utf8');
  for (const line of toml.split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq === -1 || line.slice(0, eq).trim() !== name) continue;
    return line.slice(eq + 1).trim().replace(/^"|"$/g, '');
  }
  return undefined;
}

function trimTrailingSlash(url) {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') end--;
  return url.slice(0, end);
}

// 公開の URL から読む取り方（Worker ではサービスバインディングを使う）
function createEvalFetchers(siteUrl) {
  const site = trimTrailingSlash(siteUrl);
  return {
    sitePage: (p) => fetch(`${site}${p === '/' ? '/' : `${p}/`}`),
    contents: (query) => fetch(`${trimTrailingSlash(CONTENTS_URL)}/?${query.toString()}`),
    places: () => fetch(PLACES_URL),
    history: () => fetch(HISTORY_URL),
  };
}

function loadApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const devVars = path.join(workersDir, '.dev.vars');
  if (existsSync(devVars)) {
    for (const line of readFileSync(devVars, 'utf8').split(/\r?\n/)) {
      const eq = line.indexOf('=');
      if (eq === -1 || line.slice(0, eq).trim() !== 'ANTHROPIC_API_KEY') continue;
      const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (value) return value;
    }
  }
  fail('API キーがありません。.dev.vars に ANTHROPIC_API_KEY=... を書いてください（コミットしないこと）');
}

// eval/chat-questions.md の「## 分類」と「- 質問」
function loadQuestions() {
  const text = readFileSync(path.join(workersDir, 'eval', 'chat-questions.md'), 'utf8');
  const questions = [];
  let category = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      category = line.slice(3).trim();
      continue;
    }
    const question = line.startsWith('- ') ? line.slice(2).trim() : '';
    if (category && question) questions.push({ category, question });
  }
  if (questions.length === 0) fail('eval/chat-questions.md に質問がありません');
  return questions;
}

// 答えの形を数える（案内文の「書き方」の決まりに沿っているかの目安）
function measure(answer, question) {
  const lines = answer.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const steps = lines.filter((l) => /^\d+[.．]/.test(l));
  const prose = lines.filter((l) => !/^\d+[.．]/.test(l)).join('');
  const sentences = prose.split(/(?<=[。！？])/).map((s) => s.trim()).filter(Boolean);
  const allSentences = [...sentences, ...steps];
  const longest = Math.max(0, ...allSentences.map((s) => s.length));
  const notes = [];
  if (steps.length === 0 && sentences.length > 3) notes.push('文が3つより多い');
  if (steps.length > 0 && sentences.length > 2) notes.push('手順の前後の文が多い');
  if (steps.length > 5) notes.push('手順が5つより多い');
  if (longest > 60) notes.push('長い文がある');
  if (/[*#—]|\p{Extended_Pictographic}/u.test(answer)) notes.push('記号・絵文字');
  if (/ありがとうございます|幸いです|お気軽に/.test(answer)) notes.push('挨拶・締め');
  const phone = question.match(/\d{2,4}-\d{2,4}-\d{3,4}/);
  if (phone && answer.includes(phone[0])) notes.push('電話番号をくり返した');
  const room = question.match(/\d{1,4}号棟\d{1,4}号室/);
  if (room && answer.includes(room[0])) notes.push('部屋番号をくり返した');
  return {
    chars: answer.replace(/\s/g, '').length,
    sentences: sentences.length,
    steps: steps.length,
    longest,
    notes,
  };
}

function timestamp() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000); // 日本時間
  const iso = d.toISOString();
  return { file: iso.slice(0, 16).replace(/[-:]/g, '').replace('T', '-'), label: `${iso.slice(0, 16).replace('T', ' ')}（日本時間）` };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const core = await loadCore();
  const systemPrompt = core.CHAT_SYSTEM_PROMPT;
  const model = args.model ?? loadVar('CHAT_MODEL') ?? core.DEFAULT_MODEL;
  const siteUrl = process.env.CHAT_EVAL_SITE_URL || loadVar('SITE_URL');
  if (!siteUrl) fail('wrangler.chat.toml に SITE_URL がありません');
  const questions = loadQuestions();

  console.log(`モデル: ${model} / 案内文: ${systemPrompt.length} 文字 / 質問: ${questions.length} 問 / 公開サイト: ${siteUrl}`);
  if (args.dryRun) {
    for (const [i, q] of questions.entries()) console.log(`${i + 1}. [${q.category}] ${q.question}`);
    return;
  }

  const apiKey = loadApiKey();
  const fetchers = createEvalFetchers(siteUrl);
  const readPage = (p) => core.getPageContent(p, fetchers);
  const results = [];
  for (const [i, q] of questions.entries()) {
    process.stdout.write(`(${i + 1}/${questions.length}) ${q.question} ... `);
    try {
      // 1問ずつ順番に送る（同時に送るとレート制限に当たりやすく、進み具合の表示と結果の順もそろわない）
      const r = await core.runChat({ apiKey, model, messages: [{ role: 'user', content: q.question }], readPage }); // NOSONAR: 順番に送るため、わざとループの中で待つ
      const answer = r.outcome === 'refused' ? '（安全上の理由で断られた）' : r.reply;
      const m = measure(answer, q.question);
      results.push({ ...q, ...r, answer, ...m });
      console.log(m.notes.length ? `⚠️  ${m.notes.join('、')}` : 'OK');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ ...q, error: message });
      console.log(`❌ ${message}`);
    }
  }

  const ok = results.filter((r) => !r.error);
  const avg = (key) => (ok.length ? Math.round(ok.reduce((s, r) => s + r[key], 0) / ok.length) : 0);
  const sum = (key) => ok.reduce((s, r) => s + r[key], 0);
  const { file, label } = timestamp();
  const lines = [
    `# チャットボットの評価結果 ${label}`,
    '',
    `- モデル: ${model}`,
    `- 案内文: ${systemPrompt.length} 文字`,
    `- 質問: ${questions.length} 問（失敗 ${results.length - ok.length} 問）`,
    `- 平均: ${avg('chars')} 文字、最長の文 ${avg('longest')} 字`,
    `- 公開サイト: ${siteUrl}`,
    `- トークン: 入力 ${sum('inputTokens')}、出力 ${sum('outputTokens')}`,
    `- 注意の付いた答え: ${ok.filter((r) => r.notes.length).length} 問`,
    '',
    '| # | 分類 | 質問 | 文字数 | 文 | 手順 | 最長の文 | 読んだページ | 注意 |',
    '|---|---|---|---|---|---|---|---|---|',
    ...results.map((r, i) =>
      r.error
        ? `| ${i + 1} | ${r.category} | ${r.question} | - | - | - | - | - | 失敗 |`
        : `| ${i + 1} | ${r.category} | ${r.question} | ${r.chars} | ${r.sentences} | ${r.steps} | ${r.longest} | ${r.pagesRead.join(' ') || '-'} | ${r.notes.join('、')} |`
    ),
    '',
    '## 答え',
    '',
    ...results.flatMap((r, i) => [
      `### ${i + 1}. ${r.question}`,
      '',
      `分類: ${r.category}`,
      '',
      r.error ? `失敗: ${r.error}` : r.answer,
      '',
    ]),
  ];

  const outDir = path.join(workersDir, 'eval', 'results');
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${file}.md`);
  writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log(`\n✅ 保存しました: ${path.relative(workersDir, outFile)}`);
}

try {
  await main();
} catch (error) {
  fail(String(error));
}
