/**
 * 管理者の PC で実行する kintone のスクリプト（create-kintone-apps.mjs など）で共通の部品。
 * cybozu.com のログイン名とパスワード（環境変数）で認証する。パスワードは画面にもファイルにも出さない。
 */

/** 「--name 値」と「--flag」の形の引数を読む。flags に挙げた名前は値を取らない */
export function parseArgs(argv, defaults = {}, flags = ['dry-run']) {
  const args = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new Error(`知らない引数です: ${key}`);
    const name = key.slice(2);
    if (flags.includes(name)) {
      args[name] = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${key} の値がありません`);
    }
    args[name] = value;
  }
  return args;
}

/** アプリ・スペース・スレッド・レコードの ID は数字だけ。数値にして返す（ログ・JSON・URL にそのまま入れても安全なように） */
export function toId(value, option) {
  if (value === undefined) return undefined;
  if (!/^\d{1,10}$/.test(value)) {
    throw new Error(`${option} が数字ではありません`);
  }
  return String(Number.parseInt(value, 10));
}

/** kintone の応答の文字列を、ログに出せる 1 行にする（改行などの制御文字を空白にし、長さも切る） */
export function oneLine(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .slice(0, 200);
}

/** cybozu.com のドメイン（例: example.cybozu.com）だけを受け付ける */
export function toDomain(value) {
  if (!value) throw new Error('--domain を指定してください');
  if (!/^[a-z0-9-]{1,63}\.(cybozu\.com|kintone\.com|cybozu\.cn)$/.test(value)) {
    throw new Error('--domain は「example.cybozu.com」の形で指定してください');
  }
  return value;
}

/** kintone の失敗。状態コードとエラーコードを持つ（メッセージは 1 行にしたもの） */
export class KintoneCliError extends Error {
  constructor(method, path, status, code, message) {
    super(`${method} ${path} が失敗しました（${status} ${oneLine(code)} ${oneLine(message)}）`);
    this.status = status;
    this.code = oneLine(code);
  }
}

/**
 * kintone に送る関数を作る。args['dry-run'] のときは送らずに内容を表示し、dryRun(method, path, body) の結果を返す
 */
export function makeClient(args, dryRun = () => ({})) {
  const username = process.env.KINTONE_USERNAME;
  const password = process.env.KINTONE_PASSWORD;
  if (!args['dry-run'] && (!username || !password)) {
    throw new Error('環境変数 KINTONE_USERNAME と KINTONE_PASSWORD を設定してください');
  }
  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  return async function request(method, path, body) {
    if (args['dry-run']) {
      console.log(`\n[dry-run] ${method} ${path}`);
      console.log(JSON.stringify(body, null, 2));
      return dryRun(method, path, body);
    }
    const url = new URL(`https://${args.domain}${path}`);
    const init = { method, headers: { 'X-Cybozu-Authorization': auth } };
    if (method === 'GET') {
      for (const [key, value] of Object.entries(body ?? {})) url.searchParams.set(key, value);
    } else {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const response = await fetch(url, init);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // kintone のエラーコードとメッセージだけを出す（認証の情報は出さない）。
      // bulkRequest の失敗は results の中の、失敗した書き込みにコードとメッセージが入る
      const failedIndex = Array.isArray(data.results) ? data.results.findIndex((r) => r?.code) : -1;
      const failed = failedIndex >= 0 ? data.results[failedIndex] : data;
      const where = failedIndex >= 0 ? `${failedIndex + 1} 番目の書き込み: ` : '';
      throw new KintoneCliError(method, path, response.status, failed.code, `${where}${failed.message ?? ''}`);
    }
    return data;
  };
}
