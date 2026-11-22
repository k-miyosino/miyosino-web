# 運用ダッシュボード

ホームページの運用で定期的に必要な作業と、サービスの状態を1ページで確かめるための、管理者だけのページです。

- ページ: `/member/ops`（組合員専用ページのトップに、管理者にだけリンクが出ます）
- API: Cloudflare Worker `miyosino-ops`（`workers/api/ops.ts`）
- 記録: D1 `miyosino-ops`（だれが・いつ対応したか。秘密情報の**値は保存しません**）

## 目次

1. [載っているもの](#1-載っているもの)
2. [管理者のしくみ](#2-管理者のしくみ)
3. [初回の設定](#3-初回の設定)
4. [タスク・秘密情報・リンクを足す](#4-タスク秘密情報リンクを足す)

## 1. 載っているもの

| 区画 | 中身 | データの出どころ |
|---|---|---|
| 定期タスク | 月1・年1・期限付き・担当交代時の作業。最後に対応した日と次の期限、状態（期限切れ・もうすぐ・対応済み）。「対応した」で記録 | `workers/api/_ops-catalog.ts` の `OPS_TASKS`＋D1 の記録 |
| GitHub の状態 | Deploy・Deploy Workers・Sync Places の最新の結果、開いている Dependabot の PR | GitHub の API（公開リポジトリなので、ブラウザから認証なしで取る） |
| チャット | 設定、直近7日の回数、利用料の目安、直近30日の評価と「わからなかった」の質問、直近の質問ログ | D1 `miyosino-chat`（読むだけ） |
| アクセス解析 | Looker Studio のレポートの埋め込み | Looker Studio（GA をデータソースにしたもの） |
| 秘密情報 | 漏れたとき・担当交代のときに払い出し直すものを、種類ごとの表で。用途・登録先（設定し直す場所）・発行元（作り直す場所）・入れ替え手順。「入れ替えた」で記録 | `_ops-catalog.ts` の `OPS_SECRET_CATEGORIES`・`OPS_SECRETS`＋D1 の記録 |
| リンク集 | GA・Cloudflare・Anthropic・Google Cloud・さくら・microCMS・kintone・GitHub | `_ops-catalog.ts` の `buildLinkGroups` |

利用料の目安は、直近7日のチャットの回数 × 1回あたりの目安（`wrangler.ops.toml` の `CHAT_YEN_PER_REQUEST`、既定 0.1 円）から1か月分を見積もったものです。実際の金額は Anthropic コンソールで確かめてください。回数はチャット Worker が7日で消すので、直近7日分だけが見られます。

ページの HTML は静的エクスポートなので、だれでも取得できます。タスクや秘密情報の一覧はページのコードには書かず、`miyosino-ops` が管理者にだけ返します。

## 2. 管理者のしくみ

kintone の OAuth では所属グループを直接読めないため、**アプリのアクセス権でグループを判定**します。

1. kintone に空のアプリ「運用管理者」を作り、アクセス権を **「システム管理」グループ（グループコード `Administrators`）だけ閲覧可、Everyone はなし** にします
2. 認証 Worker（`miyosino-auth`）は、ログインとトークンの更新のたびに、本人のトークンでこのアプリのレコードを読みます。読めれば管理者として、JWT に `admin: true` を入れます
3. `miyosino-ops` は、JWT の `admin` が `true` でなければ 403 を返します

- **管理者を足す・外す**: cybozu.com 共通管理で「システム管理」グループのメンバーを変えます。コードの変更はいりません
- **反映のタイミング**: 次にログインしたとき（またはトークンを更新したとき）。JWT は7日有効なので、グループから外しても、最長7日は見られることがあります。すぐに止めたいときは `JWT_SECRET` を入れ替えます（全員がログアウトされます）
- 利用者を識別できなかった人（ログイン記録アプリが使えないとき）は、管理者にしません

## 3. 初回の設定

### 3-1. kintone

1. アプリ「運用管理者」を作る（フィールドは不要。空のアプリでよい）
2. アプリの設定 → アクセス権 → アプリ: 「システム管理」グループに「レコード閲覧」、Everyone はすべて外す
3. アプリを公開し、アプリ ID を控える
4. cybozu.com 共通管理の OAuth クライアントのスコープに「アプリのレコード閲覧」（`k:app_record:read`）が入っていることを確かめる（認証 Worker が既に使っているスコープ）

### 3-2. Cloudflare（`workers/` で実行）

```bash
# D1 を作り、表示された database_id を wrangler.ops.toml の REPLACE_WITH_MIYOSINO_OPS_DATABASE_ID と置き換える
npx wrangler d1 create miyosino-ops

# テーブルを作る
npx wrangler d1 migrations apply miyosino-ops --remote --config wrangler.ops.toml

# ops Worker に JWT_SECRET を設定する（ほかの Worker と同じ値。新しく作ると全員がログアウトされるので注意）
npx wrangler secret put JWT_SECRET --config wrangler.ops.toml

# （任意）リンク集に kintone を出す
npx wrangler secret put KINTONE_DOMAIN --config wrangler.ops.toml

# 認証 Worker に「運用管理者」アプリの ID を設定する
npx wrangler secret put KINTONE_OPS_ADMIN_APP_ID --config wrangler.auth.toml
```

`wrangler.ops.toml` の `database_id` を書き換えた変更は、PR でマージしてください。`REPLACE_WITH_...` のまま main にマージすると、Deploy Workers の ops のデプロイが失敗します。

### 3-3. Looker Studio（アクセス解析）

1. [Looker Studio](https://lookerstudio.google.com/) で、Google Analytics をデータソースにしたレポートを作る（ユーザー数・表示回数・よく見られたページなど）
2. 「ファイル → 埋め込みレポート」で「埋め込みを有効にする」をオンにし、埋め込み URL をコピーする
3. `wrangler.ops.toml` の `LOOKER_STUDIO_EMBED_URL` に書き、PR でマージする
4. レポートの共有は「特定のユーザー」にしておく（見る人は、その Google アカウントでログインしているとダッシュボードに表示される）

### 3-4. デプロイと確認

1. 上の変更を develop → staging → main とマージすると、Deploy Workers が `miyosino-auth` と `miyosino-ops` をデプロイする
2. 管理者は一度ログアウトしてログインし直す（JWT に `admin` が入る）
3. 組合員専用ページのトップに「運用ダッシュボード（管理者）」が出ることと、各区画が表示されることを確かめる
4. 管理者でないアカウントで `/member/ops` を開き、「このページは管理者だけが見られます」と出ることを確かめる

## 4. タスク・秘密情報・リンクを足す

`workers/api/_ops-catalog.ts` を書き換えて PR を出します。main にマージすると ops Worker がデプロイされ、ダッシュボードに反映されます。

- **タスク**（`OPS_TASKS`）: `id`（英小文字とハイフン。記録と結びつくので、あとから変えない）、`title`、`cadence`（`monthly`・`yearly`・`deadline`（`date` に期限日）・`event`（`when` にきっかけ））、`steps`、`links`
- **秘密情報**（`OPS_SECRETS`）: `id`、`category`（種類。`OPS_SECRET_CATEGORIES` の `id`）、`name`、`purpose`（用途）、`registeredIn`（登録先。入れ替えたあとに新しい値を設定し直す場所を、「Cloudflare Workers：chat」「GitHub Secrets」「各自の PC：…」のような短いラベルで）、`issuer`（発行元。新しい値を作る場所。`label` と、あれば `url`）、`rotate`（入れ替え手順）、`after`（入れ替えたあとに起きること）。**値は絶対に書かない**
- **秘密情報の種類**（`OPS_SECRET_CATEGORIES`）: 画面ではこの順に表を分ける。新しい種類を足すときは `OpsSecretCategoryId` にも足す
- **リンク**（`buildLinkGroups`）: 見出しごとのリンクの一覧

秘密情報を新しく増やしたとき（Worker に secret を足した、GitHub Secrets を足したなど）は、ここにも足してください。
