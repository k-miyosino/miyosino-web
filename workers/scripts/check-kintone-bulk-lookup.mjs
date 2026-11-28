#!/usr/bin/env node
/**
 * kintone の bulkRequest で、「新しく作る M_組合員」と「それをルックアップで参照する所有状況」を
 * 1 回の書き込みで作れるかを確かめる（OFFICE.md 0-4）。結果で、名義変更の書き込みを 1 回にするか 2 回に分けるかを決める。
 *
 * **開発用の kintone で実行する**（本番の台帳に確認用のレコードを作らないため）。管理者の PC で一度だけ実行する。
 * cybozu.com のログイン名とパスワード（環境変数）で認証する。パスワードは画面にもファイルにも出さない。
 *
 * することと、台帳への影響:
 *   1. 確認用の M_組合員（状況「無効」、表示「<物件名> bulkRequest確認用-<時刻>」）と、それを参照する所有状況
 *      （状況「所有前」、期間 2099-12-01〜2099-12-31）を、1 回の bulkRequest で作ってみる
 *   2. 作れたら、所有状況の「Kintoneユーザ」に組合員のユーザーが写ったかを確かめる
 *   3. 1 回で作れなければ、2 回に分けて（組合員 → 所有状況）作れるかを確かめる
 *   4. 最後に、作った確認用のレコードを消す（消せなければ、消すレコードの番号を表示する）
 *   請求は所有状況の期間で決まるので、2099 年 12 月の期間にしておけば今の請求には入らない
 *
 * 使い方（workers/ で。PowerShell の例）:
 *   $env:KINTONE_USERNAME = "管理者のログイン名"; $env:KINTONE_PASSWORD = "パスワード"
 *   node scripts/check-kintone-bulk-lookup.mjs --domain example.cybozu.com --member-app 131 --ownership-app 132 --property 01-101 --user 管理者のログイン名 --dev
 *   Remove-Item Env:KINTONE_PASSWORD
 *
 * 引数:
 *   --domain         開発用の cybozu.com のドメイン
 *   --member-app     開発用の M_組合員のアプリ ID
 *   --ownership-app  開発用の M_組合員物件所有状況のアプリ ID
 *   --property       M_物件にある物件名（例: 01-101）。確認用の所有状況の物件に使う
 *   --user           cybozu.com にいるユーザーのログイン名（確認用の組合員の Kintoneユーザに使う。管理者自身でよい）
 *   --dev            開発用の kintone で実行することの確認（付けないと動かない）
 *   --dry-run        kintone に送らず、送る内容（パスワードを除く）を表示する
 */

import { KintoneCliError, makeClient, oneLine, parseArgs, toDomain, toId } from './_kintone-cli.mjs';

const FAR_START = '2099-12-01';
const FAR_END = '2099-12-31';

function memberRecord(display, userCode) {
  return {
    display: { value: display },
    user: { value: [{ code: userCode }] },
    status: { value: '無効' },
    備考: { value: 'bulkRequest の確認用（check-kintone-bulk-lookup.mjs）。消してよい' },
  };
}

function ownershipRecord(display, propertyName) {
  return {
    member: { value: display },
    property: { value: propertyName },
    start_date: { value: FAR_START },
    end_date: { value: FAR_END },
    status: { value: '所有前' },
  };
}

/** 作った所有状況に、組合員の表示とユーザーが写ったか */
async function verifyOwnership(request, args, ownershipId, display) {
  const data = await request('GET', '/k/v1/record.json', { app: args['ownership-app'], id: ownershipId });
  const record = data.record ?? {};
  const member = record.member?.value;
  const userCode = record.user?.value?.[0]?.code;
  const ok = member === display && userCode === args.user;
  console.log(
    ok
      ? '  所有状況の「組合員」と「Kintoneユーザ」が、作った組合員から正しく写った'
      : `  所有状況に写った値が想定と違う（組合員: ${oneLine(member)} ／ Kintoneユーザ: ${oneLine(userCode)}）`
  );
  return ok;
}

async function tryOneBulk(request, args, display) {
  console.log('\n[1] M_組合員と所有状況を、1 回の bulkRequest で作ってみる');
  try {
    const data = await request('POST', '/k/v1/bulkRequest.json', {
      requests: [
        { method: 'POST', api: '/k/v1/record.json', payload: { app: args['member-app'], record: memberRecord(display, args.user) } },
        { method: 'POST', api: '/k/v1/record.json', payload: { app: args['ownership-app'], record: ownershipRecord(display, args.property) } },
      ],
    });
    const memberId = toId(String(data.results?.[0]?.id), 'kintone が返した組合員のレコード番号');
    const ownershipId = toId(String(data.results?.[1]?.id), 'kintone が返した所有状況のレコード番号');
    console.log(`  作れた（組合員 ${memberId}、所有状況 ${ownershipId}）`);
    return { memberId, ownershipId };
  } catch (error) {
    if (!(error instanceof KintoneCliError)) throw error;
    console.log(`  作れなかった: ${error.message}`);
    return null;
  }
}

async function tryTwoSteps(request, args, display) {
  console.log('\n[2] 2 回に分けて（組合員 → 所有状況）作ってみる');
  const member = await request('POST', '/k/v1/record.json', { app: args['member-app'], record: memberRecord(display, args.user) });
  const memberId = toId(String(member.id), 'kintone が返した組合員のレコード番号');
  try {
    const ownership = await request('POST', '/k/v1/record.json', { app: args['ownership-app'], record: ownershipRecord(display, args.property) });
    const ownershipId = toId(String(ownership.id), 'kintone が返した所有状況のレコード番号');
    console.log(`  作れた（組合員 ${memberId}、所有状況 ${ownershipId}）`);
    return { memberId, ownershipId };
  } catch (error) {
    if (!(error instanceof KintoneCliError)) throw error;
    console.log(`  所有状況を作れなかった: ${error.message}`);
    return { memberId, ownershipId: null };
  }
}

async function cleanUp(request, args, created) {
  console.log('\n[後片付け] 確認用のレコードを消す');
  const targets = [
    [args['ownership-app'], created.ownershipId, '所有状況'],
    [args['member-app'], created.memberId, '組合員'],
  ];
  for (const [app, id, label] of targets) {
    if (!id) continue;
    try {
      await request('DELETE', '/k/v1/records.json', { app, ids: [id] });
      console.log(`  ${label} ${id} を消した`);
    } catch (error) {
      if (!(error instanceof KintoneCliError)) throw error;
      console.log(`  ${label} ${id} を消せなかった。kintone の画面で消してください（アプリ ${app}）: ${error.message}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {}, ['dry-run', 'dev']);
  if (!args.dev) {
    throw new Error('開発用の kintone で実行してください。確かめたら --dev を付けて実行します');
  }
  args.domain = toDomain(args.domain ?? process.env.KINTONE_DOMAIN);
  args['member-app'] = toId(args['member-app'], '--member-app');
  args['ownership-app'] = toId(args['ownership-app'], '--ownership-app');
  if (!args['member-app'] || !args['ownership-app']) {
    throw new Error('--member-app と --ownership-app を指定してください');
  }
  if (!/^\d{2}-\d{3,4}$/.test(args.property ?? '')) {
    throw new Error('--property は M_物件の物件名（例: 01-101）で指定してください');
  }
  if (!/^[A-Za-z0-9._@-]{1,64}$/.test(args.user ?? '')) {
    throw new Error('--user は cybozu.com のログイン名で指定してください');
  }

  const request = makeClient(args, (method, path) => {
    if (path === '/k/v1/bulkRequest.json') return { results: [{ id: '0' }, { id: '0' }] };
    if (path === '/k/v1/record.json' && method === 'POST') return { id: '0' };
    if (path === '/k/v1/record.json') {
      return { record: { member: { value: '(dry-run)' }, user: { value: [{ code: args.user }] } } };
    }
    return {};
  });

  const display = `${args.property} bulkRequest確認用-${Date.now()}`;
  let created = await tryOneBulk(request, args, display);
  let result;
  if (created) {
    result = (await verifyOwnership(request, args, created.ownershipId, display))
      ? '1 回の bulkRequest で作れる（名義変更の書き込みは 1 回にまとめられる）'
      : '1 回の bulkRequest で作れたが、所有状況に写った値が想定と違う（書き込みは 2 回に分ける）';
  } else {
    created = await tryTwoSteps(request, args, display);
    result = created.ownershipId
      ? '1 回では作れず、2 回に分ければ作れる（名義変更の書き込みは 2 回に分け、2 回目が失敗したら 1 回目を取り消す）'
      : '2 回に分けても所有状況を作れない（ルックアップやアクセス権の設定を確かめる必要がある）';
  }
  await cleanUp(request, args, created);
  if (args['dry-run']) {
    console.log('\n（ドライランなので kintone には送っていません。結果は、--dry-run を外して実行すると出ます）');
    return;
  }
  console.log(`\n結果: ${result}`);
  console.log('この「結果」の行を、そのまま知らせてください。');
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
