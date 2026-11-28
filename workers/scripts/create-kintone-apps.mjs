#!/usr/bin/env node
/**
 * 事務員専用ページで使う kintone の「組合員申請」アプリを、定義の JSON（workers/kintone/member-application.json）から作る。
 * 管理者の PC で一度だけ実行する。Worker からは使わない（OFFICE.md 4-3-2）。
 * （事務員の判定に使う空の「事務員判定」アプリは、手で作る。OFFICE.md 3-2）
 *
 * アプリを作る操作は API トークンではできないので、cybozu.com のログイン名とパスワードで認証する。
 * パスワードは環境変数で渡し、ファイルには書かない・画面にも出さない。
 *
 * 使い方（workers/ で。まず開発用の kintone で試す）:
 *
 *   PowerShell:
 *     $env:KINTONE_USERNAME = "admin"; $env:KINTONE_PASSWORD = "..."
 *     node scripts/create-kintone-apps.mjs --domain example.cybozu.com --clerk-group clerks --property-app 133 --member-app 131
 *     Remove-Item Env:KINTONE_PASSWORD
 *
 *   bash:
 *     KINTONE_USERNAME=admin KINTONE_PASSWORD=... node scripts/create-kintone-apps.mjs --domain ... --clerk-group ... --property-app 133 --member-app 131
 *
 * 引数:
 *   --domain        cybozu.com のドメイン（例: example.cybozu.com）。環境変数 KINTONE_DOMAIN でもよい
 *   --clerk-group   「事務員」グループのグループコード（cybozu.com 共通管理 → 組織/グループ で確かめる）
 *   --admin-group   管理者のグループコード（既定: Administrators）
 *   --property-app  M_物件のアプリ ID（組合員申請の「物件」のルックアップ先）
 *   --member-app    M_組合員のアプリ ID（組合員申請の「組合員」のルックアップ先）
 *   --space         アプリを作るスペースの ID（任意。無ければスペースに入れず、ポータルの「アプリ」の一覧に作る）。
 *                   スペースの ID は、スペースを開いたときの URL の /k/#/space/ のあとの数字
 *   --thread        スペースの中のスレッドの ID（任意。無ければそのスペースの既定のスレッド）
 *   --dry-run       kintone に送らず、送る内容（パスワードを除く）を表示する
 *
 * できあがったら、kintone の画面で次を行う（API ではできない）:
 *   - 組合員申請アプリの API トークンを作る（レコード閲覧・追加・編集）
 *   - 表示されたアプリ ID を、Worker のシークレットに設定する（最後に表示するコマンド）
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeClient, parseArgs, toDomain, toId } from './_kintone-cli.mjs';

const DEFINITIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'kintone');
const DEFINITION_FILE = 'member-application.json';

function loadDefinition(file, replacements) {
  let text = readFileSync(join(DEFINITIONS_DIR, file), 'utf8');
  for (const [placeholder, value] of Object.entries(replacements)) {
    text = text.split(placeholder).join(value);
  }
  return JSON.parse(text);
}

/** アクセス権: 事務員グループ・管理者グループに定義どおり、ほかの人（everyone）にはなし */
function buildRights(definition, args) {
  const none = {
    recordViewable: false,
    recordAddable: false,
    recordEditable: false,
    recordDeletable: false,
    recordImportable: false,
    recordExportable: false,
    appEditable: false,
  };
  return [
    { entity: { type: 'GROUP', code: args['admin-group'] }, includeSubs: false, ...definition.rights.adminGroup },
    { entity: { type: 'GROUP', code: args['clerk-group'] }, includeSubs: false, ...definition.rights.clerkGroup },
    { entity: { type: 'GROUP', code: 'everyone' }, includeSubs: false, ...none },
  ];
}

async function waitForDeploy(request, appId) {
  for (let i = 0; i < 60; i++) {
    const data = await request('GET', '/k/v1/preview/app/deploy.json', { 'apps[0]': appId });
    const status = data.apps?.[0]?.status;
    if (status === 'SUCCESS') return;
    if (status === 'FAIL' || status === 'CANCEL') {
      throw new Error(`アプリ ${appId} の運用環境への反映が ${status} になりました`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`アプリ ${appId} の運用環境への反映が終わりません。kintone の画面で確かめてください`);
}

/** スペースに作るときの space・thread。スレッドの指定がなければ、スペースの既定のスレッドを問い合わせる */
async function resolvePlace(request, args) {
  if (!args.space) {
    if (args.thread) throw new Error('--thread を使うときは --space も指定してください');
    return {};
  }
  const thread =
    args.thread ??
    toId(String((await request('GET', '/k/v1/space.json', { id: args.space })).defaultThread), 'kintone が返したスレッドの ID');
  return { space: args.space, thread };
}

async function createApp(request, definition, args) {
  const place = await resolvePlace(request, args);
  const created = await request('POST', '/k/v1/preview/app.json', {
    name: definition.name,
    ...place,
  });
  // kintone の応答も、数字だけかを確かめてから使う（ログ・以後のリクエストに入れるため）
  const appId = toId(String(created.app), 'kintone が返したアプリの ID');
  console.log(
    `- 「${definition.name}」アプリを作りました（アプリ ID: ${appId}。${
      place.space ? `スペース ${place.space} のスレッド ${place.thread}` : 'スペースに入れず、ポータルのアプリ一覧'
    }）`
  );

  await request('PUT', '/k/v1/preview/app/settings.json', {
    app: appId,
    description: definition.description,
  });
  if (Object.keys(definition.properties).length > 0) {
    await request('POST', '/k/v1/preview/app/form/fields.json', {
      app: appId,
      properties: definition.properties,
    });
    console.log(`  フィールドを ${Object.keys(definition.properties).length} 個足しました`);
  }
  await request('PUT', '/k/v1/preview/app/acl.json', {
    app: appId,
    rights: buildRights(definition, args),
  });
  console.log('  アクセス権を設定しました');
  await request('POST', '/k/v1/preview/app/deploy.json', { apps: [{ app: appId }] });
  await waitForDeploy(request, appId);
  console.log('  運用環境に反映しました');
  return appId;
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { 'admin-group': 'Administrators' });
  args.domain = toDomain(args.domain ?? process.env.KINTONE_DOMAIN);
  args.space = toId(args.space, '--space');
  args.thread = toId(args.thread, '--thread');
  args['property-app'] = toId(args['property-app'], '--property-app');
  args['member-app'] = toId(args['member-app'], '--member-app');
  if (!args['clerk-group']) throw new Error('--clerk-group（「事務員」グループのグループコード）を指定してください');
  if (!args['property-app'] || !args['member-app']) {
    throw new Error('--property-app（M_物件）と --member-app（M_組合員）のアプリ ID を指定してください');
  }

  // ドライランでは、仮の ID（0）を返す
  const request = makeClient(args, (method, path) => {
    if (path === '/k/v1/preview/app.json') return { app: '0' };
    if (path === '/k/v1/space.json') return { defaultThread: '0' };
    return { apps: [{ status: 'SUCCESS' }] };
  });
  const definition = loadDefinition(DEFINITION_FILE, {
    '{{PROPERTY_APP_ID}}': args['property-app'],
    '{{MEMBER_APP_ID}}': args['member-app'],
  });
  const appId = await createApp(request, definition, args);

  console.log('\n次に行うこと:');
  console.log('- kintone の画面で、組合員申請アプリの API トークンを作る（アプリの設定 → API トークン。レコード閲覧・追加・編集。削除は付けない）');
  console.log('- office Worker の KINTONE_API_TOKEN_OFFICE に、そのトークンをカンマでつないで設定し直す');
  console.log(`- office Worker に組合員申請アプリの ID を設定する: npx wrangler secret put KINTONE_APP_ID_MEMBER_APPLICATION --config wrangler.office.toml   （値: ${appId}）`);
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
