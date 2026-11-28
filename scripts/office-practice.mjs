#!/usr/bin/env node
/**
 * 事務員専用ページ・広報ページの「練習用」の起動（手元の PC で画面を操作して確かめるためのもの）。
 *
 * 本物の Worker・kintone の代わりに、架空のデータを返す練習用のサーバー（http://localhost:8787）を立て、
 * 画面の開発用サーバー（http://localhost:3000）をそこにつないで起動する。
 * ログインも練習用のサーバーが「事務員・広報委員としてログインした」ことにするので、kintone にはつながず、
 * 本物のデータにも触れない。入力した申請は、このサーバーを止めると消える。
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

const EMPTY_APPLICATION = {
  status: '申請中',
  method: '紙（代理入力）',
  applicantKind: '組合員',
  agent: '',
  newName: '',
  transferDate: '',
  switchDate: '',
  newAddress: '',
  newPhone: '',
  moveInDate: '',
  oldAddress: '',
  oldPhone: '',
  newLogin: '',
  enteredBy: '練習 事務員（practice-clerk）',
  approvedBy: '',
  approvedAt: '',
  returnReason: '',
};

const applications = [
  {
    ...EMPTY_APPLICATION,
    id: '1',
    type: '名義変更',
    submittedDate: '2026-11-20',
    propertyName: '01-101',
    memberDisplay: '01-101 山田 太郎',
    newName: '佐藤 次郎',
    transferDate: '2026-11-16',
    switchDate: '2026-12-01',
    oldAddress: '東京都練馬区（架空の住所）',
    newPhone: '049-000-0000',
    summary: '01-101 の名義を 01-101 山田 太郎 から 佐藤 次郎 様に変更（2026年12月1日から新組合員の負担）',
  },
];
const submitKeys = new Map();

function formatJapaneseDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

/** 本物の Worker（workers/api/_office-applications.ts）の確認のうち、主なものだけをまねる */
function checkProxyInput(input) {
  const errors = [];
  if (!['名義変更', '情報変更'].includes(input.type)) errors.push('申請の種類を選んでください');
  if (!input.propertyName) errors.push('お部屋を選んでください');
  if (!input.newName?.trim()) errors.push(input.type === '名義変更' ? '新しい組合員の氏名を入れてください' : '変更後の氏名を入れてください');
  if (input.applicantKind === '代理人' && !input.agent?.trim()) errors.push('代理人の氏名と続柄（または会社名）を入れてください');
  if (input.type === '名義変更') {
    if (!input.transferDate) errors.push('名義変更日を入れてください');
    if (!input.switchDate) errors.push('新しい組合員の負担となる日を入れてください');
  }
  return errors;
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

/** 紙の申請の代理入力（POST /office/applications/proxy） */
async function handleProxy(req, res) {
  const input = (await readBody(req)) ?? {};
  if (submitKeys.has(input.submitKey)) {
    return send(res, 200, { id: submitKeys.get(input.submitKey), duplicate: true });
  }
  const errors = checkProxyInput(input);
  if (errors.length > 0) return send(res, 400, { error: 'invalid', messages: errors });
  const unit = UNITS.find((u) => u.name === input.propertyName);
  if (!unit?.owner) {
    return send(res, 400, { error: 'invalid', messages: ['このお部屋には、いま所有している組合員が登録されていません。管理者に台帳の確認を頼んでください'] });
  }
  const id = String(applications.length + 1);
  applications.push({
    ...EMPTY_APPLICATION,
    ...input,
    id,
    memberDisplay: unit.owner.display,
    summary:
      input.type === '名義変更'
        ? `${input.propertyName} の名義を ${unit.owner.display} から ${input.newName} 様に変更（${formatJapaneseDate(input.switchDate)}から新組合員の負担）`
        : `${unit.owner.display} の氏名を「${input.newName}」に変更`,
  });
  submitKeys.set(input.submitKey, id);
  console.log(`[練習] 申請番号 ${id} を登録しました（${input.type}・${input.propertyName}）`);
  return send(res, 201, { id, duplicate: false });
}

/** 事務員専用ページの API（workers/api/office.ts と同じ形）。扱ったら true */
async function handleOffice(req, res, url, path) {
  if (path === '/office/me') {
    send(res, 200, { code: 'practice-clerk', name: '練習 事務員' });
    return true;
  }
  if (path === '/office/units') {
    send(res, 200, { date: new Date().toISOString().slice(0, 10), units: UNITS });
    return true;
  }
  if (path === '/office/applications' && req.method === 'GET') {
    const status = url.searchParams.get('status') ?? '申請中';
    send(res, 200, { status, applications: applications.filter((a) => a.status === status) });
    return true;
  }
  if (path === '/office/applications/proxy' && req.method === 'POST') {
    await handleProxy(req, res);
    return true;
  }
  const match = /^\/office\/applications\/(\d+)$/.exec(path);
  if (match && req.method === 'GET') {
    const application = applications.find((a) => a.id === match[1]);
    if (application) send(res, 200, { application });
    else send(res, 404, { error: 'Not found' });
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
