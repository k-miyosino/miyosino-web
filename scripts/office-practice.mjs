#!/usr/bin/env node
/**
 * 事務員専用ページ・広報ページの「練習用」の起動（手元の PC で画面を操作して確かめるためのもの）。
 *
 * 本物の Worker・kintone の代わりに、架空のデータを返す練習用のサーバー（http://localhost:8787）を立て、
 * 画面の開発用サーバー（http://localhost:3000）をそこにつないで起動する。
 * ログインも練習用のサーバーが「事務員・広報委員としてログインした」ことにするので、kintone にはつながず、
 * 本物のデータにも触れない。台帳への反映・取り消しは、このサーバーを止めると消える。
 *
 * 使い方（リポジトリのいちばん上のフォルダで）:
 *   npm run office:practice
 *   → ブラウザで http://localhost:3000/member/office/（事務員専用ページ）か
 *     http://localhost:3000/member/koho/（広報ページ）を開く
 *   止めるときは Ctrl + C
 *
 * 本番のビルドやデプロイには使わない（このファイルは画面のコードから読み込まれない）
 */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const MOCK_PORT = 8787;
const SITE_PORT = 3000;
const MOCK_URL = `http://localhost:${MOCK_PORT}`;

// ---- 練習用のログイン（署名のない JWT。画面は署名を確かめないので、中身だけあればよい） ----

function base64Url(value) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64url');
}

function practiceToken() {
  const now = Math.floor(Date.now() / 1000);
  return `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url({
    sub: 'practice-clerk',
    name: '練習 事務員',
    email: 'member@example.com',
    clerk: true,
    koho: true,
    iat: now,
    exp: now + 12 * 60 * 60,
  })}.practice`;
}

// ---- 架空のデータ ----

const OWNERS = {
  '01-101': '山田 太郎',
  '01-102': '鈴木 花子',
  '01-103': '高橋 一郎',
  '01-201': '田中 次郎',
  '01-202': '伊藤 三郎',
  '02-101': '渡辺 四郎',
  '02-102': '小林 五郎',
  '02-201': '加藤 六郎',
  '03-101': '吉田 七郎',
  '03-102': '山本 八郎',
};

const UNITS = [];
for (const building of ['1', '2', '3']) {
  for (const room of ['101', '102', '103', '201', '202', '203']) {
    const name = `0${building}-${room}`;
    UNITS.push({
      id: name,
      name,
      building,
      room,
      owner: OWNERS[name]
        ? { display: `${name} ${OWNERS[name]}`, userCode: `${name.replace('-', '')}practice`, startDate: '2015-04-01' }
        : null,
      ownerConflict: false,
    });
  }
}

/** 台帳の更新記録（練習用。止めると消える） */
const logs = [];
const submitKeys = new Map();
const MONTHLY_FEE = 15000;

function formatJapaneseDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

function previousDay(value) {
  const time = Date.parse(`${value}T00:00:00Z`) - 24 * 60 * 60 * 1000;
  return new Date(time).toISOString().slice(0, 10);
}

/** ISO の日時の、日本時間の日付（'YYYY-MM-DD'） */
function jstDateOf(iso) {
  return new Date(Date.parse(iso) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 日本時間の今日 */
function todayJst() {
  return jstDateOf(new Date().toISOString());
}

/** 本物の Worker（workers/api/_office-ledger.ts）の確認のうち、主なものだけをまねる */
function checkLedgerInput(input) {
  const errors = [];
  if (!['名義変更', '氏名の変更'].includes(input.type)) errors.push('手続きを選んでください');
  const unit = UNITS.find((u) => u.name === input.propertyName);
  if (!unit) errors.push('お部屋を選んでください');
  else if (!unit.owner) errors.push('このお部屋には、いま所有している組合員が登録されていません。管理者に台帳の確認を頼んでください');
  if (!input.newName?.trim()) errors.push('氏名を入れてください');
  if (input.type === '名義変更') {
    const code = String(input.propertyName ?? '').replace('-', '');
    if (!/^[A-Za-z0-9._@-]{1,64}$/.test(input.newLogin ?? '') || !input.newLogin.startsWith(code)) {
      errors.push(`ログイン名は、お部屋の番号（${code}）で始まる半角の英数字です`);
    }
    if (!input.switchDate) errors.push('新しい組合員の負担となる日を入れてください');
    if (!input.transferDate) errors.push('名義変更日を入れてください');
  }
  if (input.type === '氏名の変更' && unit?.owner && `${unit.name} ${input.newName.trim()}` === unit.owner.display) {
    errors.push('変更後の氏名が、いまの登録と同じです');
  }
  return { errors, unit };
}

/** 確認画面に出す「台帳がこう変わります」（本物と同じことばに近づける） */
function planLedger(input, unit) {
  const oldDisplay = unit.owner.display;
  const newDisplay = `${unit.name} ${input.newName.trim()}`;
  if (input.type === '氏名の変更') {
    return {
      summary: [
        `組合員の表示を「${oldDisplay}」から「${newDisplay}」に変えます`,
        '所有状況の「組合員」を、新しい表示に写し直します（1 件）',
      ],
      warnings: [],
      notices: [],
      proration: null,
    };
  }
  const day = Number(input.switchDate.slice(8, 10));
  const [y, m] = input.switchDate.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const proration =
    day === 1
      ? null
      : {
          daysInMonth,
          oldDays: day - 1,
          newDays: daysInMonth - day + 1,
          monthlyFee: MONTHLY_FEE,
          oldAmount: Math.floor((MONTHLY_FEE * (day - 1)) / daysInMonth),
          newAmount: Math.floor((MONTHLY_FEE * (daysInMonth - day + 1)) / daysInMonth),
        };
  const notices = [
    `管理者へ: ${formatJapaneseDate(input.switchDate)} に、旧組合員のアカウント（${unit.owner.userCode}）を止めてください`,
    `会計担当へ: 新しい組合員（${newDisplay} 様、ログイン名 ${input.newLogin}）の口座振替の登録をお願いします（口座振替の依頼書は紙で回します）`,
  ];
  if (proration) {
    notices.push(
      `会計担当へ: ${y}年${m}月分の管理費・修繕積立費を日割りに直してください（旧組合員 ${proration.oldDays} 日・新しい組合員 ${proration.newDays} 日、参考の金額 ${proration.oldAmount} 円・${proration.newAmount} 円。月額 ${MONTHLY_FEE} 円をその月の ${daysInMonth} 日で割り、円未満を切り捨て）`
    );
  }
  return {
    summary: [
      `${oldDisplay} 様の所有を ${formatJapaneseDate(previousDay(input.switchDate))} で終えます（譲渡済）`,
      `${oldDisplay} 様の組合員の登録を「無効」にします`,
      `新しい組合員「${newDisplay}」（ログイン名 ${input.newLogin}）を登録します`,
      `${newDisplay} 様の所有を ${formatJapaneseDate(input.switchDate)} から始めます`,
    ],
    // 練習用: 01-101 には駐車場の契約がある、ことにする
    warnings:
      unit.name === '01-101'
        ? [`${oldDisplay} 様には、続いている駐車場の契約が 1 件あります。駐車場の契約は、この手続きでは変わりません`]
        : [],
    notices,
    proration,
  };
}
// ---- 練習用のサーバー ----

function send(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body === null ? '' : JSON.stringify(body));
}

async function readBody(req) {
  let text = '';
  for await (const chunk of req) text += chunk;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** ログイン・お知らせ（組合員専用ページの共通の部分）。扱ったら true */
function handleCommon(req, res, url, path) {
  // ログイン: kintone の代わりに、すぐに事務員・広報委員の練習用トークンを持たせて元の画面に戻す
  if (path === '/login') {
    const redirect = url.searchParams.get('redirect_uri') || `http://localhost:${SITE_PORT}/member/`;
    const target = new URL(redirect);
    if (target.hostname !== 'localhost') {
      send(res, 400, { error: 'localhost だけに戻します' });
      return true;
    }
    target.hash = new URLSearchParams({ token: practiceToken(), refresh_token: 'practice' }).toString();
    res.writeHead(302, { Location: target.toString() });
    res.end();
    return true;
  }
  const fixed = {
    '/verify': { authenticated: true, user: { id: 'practice-clerk', name: '練習 事務員', email: 'member@example.com' } },
    '/logout': { ok: true },
    // 組合員専用ページのほかの部分（お知らせ）は空で返す
    '/announcements/years': { yearMonths: [] },
    '/announcements': { announcements: [] },
  };
  if (path === '/refresh') {
    send(res, 200, { token: practiceToken(), refresh_token: 'practice' });
    return true;
  }
  if (fixed[path]) {
    send(res, 200, fixed[path]);
    return true;
  }
  return false;
}

/** 広報ページの API（workers/api/koho.ts と同じ形。リンク先は練習用の仮のもの）。扱ったら true */
function handleKoho(req, res, path) {
  if (path !== '/koho/links') return false;
  const app = (key, name, appId, where, note = '') => ({
    key, name, appId, where, note,
    listUrl: `https://example.cybozu.com/k/${appId}/`,
    addUrl: `https://example.cybozu.com/k/${appId}/edit`,
  });
  send(res, 200, {
    me: { code: 'practice-clerk', name: '練習 事務員' },
    kintone: [
      app('announcements', 'お知らせ', '53', '組合員専用ページのトップと「お知らせ」に、日付の新しい順に出ます', '「公開」にしたものだけが出ます（「準備中」のあいだは出ません）'),
      app('circulars', '回覧板・配布資料', '54', '組合員専用ページの「回覧板・配布資料」に出ます'),
      app('events', 'イベント', '49', '組合員専用ページの「イベント情報」に出ます'),
      app('applications', '届出・申請書', '56', '組合員専用ページの「各種申請」に、ダウンロードできる様式として出ます', '「公開」にしたものだけが出ます（「非公開」は出ません）'),
    ],
    microcms: {
      url: 'https://example.microcms.io/apis/contents',
      items: [
        { name: 'トップの写真', where: 'ホームのいちばん上の写真' },
        { name: '共有施設・サービス', where: '「共有施設・サービス」のページ' },
      ],
    },
    guide: [
      { area: 'ホームのいちばん上の写真', editIn: 'microCMS', target: 'トップの写真' },
      { area: '組合員専用ページのお知らせ', editIn: 'kintone', target: 'お知らせ' },
      { area: '各ページの文章（アクセスの説明・団地の紹介など）', editIn: 'ソース', target: 'いまはシステム管理者に頼む（言葉で頼むと直せるしくみは準備中）' },
    ],
  });
  return true;
}

/** 台帳を更新する（POST /office/ledger/preview と POST /office/ledger） */
async function handleLedger(req, res, apply) {
  const input = (await readBody(req)) ?? {};
  if (apply && submitKeys.has(input.submitKey)) {
    return send(res, 200, { logId: submitKeys.get(input.submitKey), duplicate: true });
  }
  const { errors, unit } = checkLedgerInput(input);
  if (errors.length > 0) return send(res, 400, { error: 'invalid', messages: errors });
  const plan = planLedger(input, unit);
  if (!apply) return send(res, 200, plan);

  const id = String(logs.length + 1);
  const oldOwner = unit.owner;
  const newDisplay = `${unit.name} ${input.newName.trim()}`;
  logs.push({
    id,
    type: input.type,
    status: '反映済み',
    propertyName: unit.name,
    oldMember: oldOwner.display,
    newName: input.newName.trim(),
    newLogin: input.newLogin ?? '',
    switchDate: input.switchDate ?? '',
    transferDate: input.transferDate ?? '',
    enteredBy: '練習 事務員（practice-clerk）',
    enteredAt: new Date().toISOString(),
    canceledBy: '',
    canceledAt: '',
    restore: { unit: unit.name, owner: oldOwner },
  });
  unit.owner =
    input.type === '名義変更'
      ? { display: newDisplay, userCode: input.newLogin, startDate: input.switchDate }
      : { ...oldOwner, display: newDisplay };
  submitKeys.set(input.submitKey, id);
  console.log(`[練習] 記録番号 ${id}: ${input.type}を台帳に反映しました（${unit.name}）`);
  return send(res, 201, { logId: id, duplicate: false, summary: plan.summary, notices: plan.notices });
}

/** 取り消し（POST /office/ledger/logs/:id/cancel）。本物と同じく、今日・反映済みのものだけ */
function handleCancel(res, id) {
  const log = logs.find((l) => l.id === id);
  if (!log) return send(res, 404, { error: 'Not found' });
  if (log.status !== '反映済み') {
    return send(res, 400, { error: 'invalid', messages: ['この更新は、もう取り消されています'] });
  }
  if (jstDateOf(log.enteredAt) !== todayJst()) {
    return send(res, 400, { error: 'invalid', messages: ['取り消せるのは、今日の更新だけです。管理者に頼んでください'] });
  }
  const unit = UNITS.find((u) => u.name === log.restore.unit);
  unit.owner = log.restore.owner;
  log.status = '取り消し';
  log.canceledBy = '練習 事務員（practice-clerk）';
  log.canceledAt = new Date().toISOString();
  console.log(`[練習] 記録番号 ${id} を取り消しました`);
  return send(res, 200, { ok: true });
}

/** 事務員専用ページの API（workers/api/office.ts と同じ形）。扱ったら true */
async function handleOffice(req, res, url, path) {
  if (path === '/office/me') {
    send(res, 200, { code: 'practice-clerk', name: '練習 事務員' });
    return true;
  }
  if (path === '/office/units') {
    send(res, 200, { date: todayJst(), units: UNITS });
    return true;
  }
  if ((path === '/office/ledger/preview' || path === '/office/ledger') && req.method === 'POST') {
    await handleLedger(req, res, path === '/office/ledger');
    return true;
  }
  if (path === '/office/ledger/logs' && req.method === 'GET') {
    const date = url.searchParams.get('date') ?? todayJst();
    // restore は練習用の中身なので返さない
    const view = logs.filter((l) => jstDateOf(l.enteredAt) === date).map(({ restore, ...rest }) => rest);
    send(res, 200, { date, logs: view.reverse() });
    return true;
  }
  const match = /^\/office\/ledger\/logs\/(\d+)\/cancel$/.exec(path);
  if (match && req.method === 'POST') {
    handleCancel(res, match[1]);
    return true;
  }
  return false;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, MOCK_URL);
  const path = url.pathname.replace(/\/$/, '');
  if (req.method === 'OPTIONS') return send(res, 204, null);
  if (handleCommon(req, res, url, path) || handleKoho(req, res, path)) return;
  if (await handleOffice(req, res, url, path)) return;
  return send(res, 404, { error: 'Not found' });
});

server.listen(MOCK_PORT, () => {
  console.log(`練習用のサーバーを ${MOCK_URL} で起動しました（架空のデータ。止めると入力は消えます）`);

  const env = {
    ...process.env,
    NEXT_PUBLIC_AUTH_API_URL: MOCK_URL,
    NEXT_PUBLIC_ANNOUNCEMENTS_API_URL: MOCK_URL,
    NEXT_PUBLIC_OFFICE_API_URL: MOCK_URL,
    NEXT_PUBLIC_KOHO_API_URL: MOCK_URL,
    // kintone のログアウトの画面は開かない
    NEXT_PUBLIC_KINTONE_LOGOUT_URL: '',
  };
  // PATH から npx を探さず、いま動いている Node でこのリポジトリの Next.js を直接起動する
  const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
  const site = spawn(process.execPath, [nextBin, 'dev', '-p', String(SITE_PORT)], {
    env,
    stdio: 'inherit',
  });
  console.log(
    `\n画面の起動を待って、ブラウザで http://localhost:${SITE_PORT}/member/office/（事務員専用ページ）か http://localhost:${SITE_PORT}/member/koho/（広報ページ）を開いてください。止めるときは Ctrl + C\n`
  );
  const stop = () => {
    site.kill();
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  site.on('exit', (code) => {
    server.close();
    process.exit(code ?? 0);
  });
});
