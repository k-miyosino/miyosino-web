# Cloudflare Workers デプロイと環境変数設定方法

## 目次

1. [初回セットアップ](#初回セットアップ)
2. [Workerのデプロイ方法](#workerのデプロイ方法)
3. [環境変数の設定方法](#環境変数の設定方法)
4. [各Workerの環境変数一覧](#各workerの環境変数一覧)
5. [トラブルシューティング](#トラブルシューティング)

## 初回セットアップ

### 1. Wrangler CLIのインストール

```bash
cd workers
npm install
```

### 2. Cloudflareへの認証

#### 方法1: ブラウザ経由のログイン（推奨）

```bash
cd workers
npx wrangler login
```

ブラウザが開き、Cloudflareアカウントでログインして認証を完了してください。

#### 方法2: APIトークンを使用（ブラウザログインが失敗する場合）

1. [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) でAPIトークンを作成
   - 「Create Token」をクリック
   - 「Edit Cloudflare Workers」テンプレートを選択、または以下の権限を設定:
     - Account: Cloudflare Workers: Edit
     - Zone: 必要な権限を設定
   - トークンを作成してコピー

2. 環境変数として設定:

```bash
# 一時的に設定（現在のシェルセッションのみ）
export CLOUDFLARE_API_TOKEN=your-api-token-here

# または、.envファイルや.bashrc/.zshrcに追加して永続化
echo 'export CLOUDFLARE_API_TOKEN=your-api-token-here' >> ~/.bashrc
source ~/.bashrc
```

3. 認証状態を確認:

```bash
cd workers
npx wrangler whoami
```

⚠️ **注意**: APIトークンは機密情報です。Gitにコミットしないでください。

### 3. 認証状態の確認

```bash
cd workers
npx wrangler whoami
```

## Workerのデプロイ方法

### GitHub Actionsによる自動デプロイ

`.github/workflows/deploy-workers.yml` により、`workers/` 配下の変更が main にマージされると、変更のあったWorkerだけが自動でデプロイされます。

- 共通処理（`api/_kintone.ts` など）を変更した場合は、それを import しているWorkerがすべて対象になります
- `package.json` / `package-lock.json` / `tsconfig.json` を変更した場合は、すべてのWorkerが対象になります
- GitHubの Actions 画面から「Deploy Workers」を手動実行すれば、Workerを選んでいつでもデプロイできます（staging で先に試したい場合など）
- 事前に GitHub Secrets に `CLOUDFLARE_API_TOKEN`（Cloudflareの「Edit Cloudflare Workers」テンプレートで作成）を登録しておく必要があります
- シークレット（`JWT_SECRET` 等）はデプロイで上書きされないため、変更する場合はこれまでどおり `wrangler secret put` で設定します

以下は手元から手動でデプロイする場合の方法です。

### 基本的なデプロイコマンド

```bash
cd workers

# 各Workerを個別にデプロイ
npx wrangler deploy --config wrangler.auth.toml                    # 認証用Worker
npx wrangler deploy --config wrangler.announcements.toml            # お知らせAPI用Worker
npx wrangler deploy --config wrangler.circulars.toml                 # 配布資料API用Worker
npx wrangler deploy --config wrangler.greenwellness.toml            # グリーンウェルネスAPI用Worker
npx wrangler deploy --config wrangler.minutes.toml                  # 会議情報API用Worker
npx wrangler deploy --config wrangler.events.toml                   # イベントAPI用Worker
npx wrangler deploy --config wrangler.applications.toml             # 申請書API用Worker
npx wrangler deploy --config wrangler.contact.toml                  # お問い合わせフォーム用Worker
npx wrangler deploy --config wrangler.contents.toml                 # コンテンツAPI用Worker
```

### package.jsonに定義されているデプロイスクリプトを使用する場合

```bash
cd workers
npm run deploy:auth          # 認証用Worker
npm run deploy:announcements # お知らせAPI用Worker
npm run deploy:circulars     # 配布資料API用Worker
npm run deploy:greenwellness # グリーンウェルネスAPI用Worker
npm run deploy:minutes       # 会議情報API用Worker
npm run deploy:events        # イベントAPI用Worker
npm run deploy:applications  # 申請書API用Worker
npm run deploy:contact       # お問い合わせフォーム用Worker
```

## 環境変数の設定方法

### 方法1: Wrangler CLI（推奨）

各Workerごとに環境変数を設定します。

```bash
cd workers

# 例: 申請書API用Workerの環境変数を設定
npx wrangler secret put KINTONE_DOMAIN --config wrangler.applications.toml
npx wrangler secret put KINTONE_API_TOKEN_APPLICATIONS --config wrangler.applications.toml
npx wrangler secret put JWT_SECRET --config wrangler.applications.toml
```

実行すると、対話的に値を入力するよう求められます。
値を入力してEnterキーを押してください。

### 方法2: Cloudflare Dashboard（Web UI）

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. 左側のメニューから「Workers & Pages」を選択
3. 対象のWorkerを選択（例: `miyosino-applications`）
4. 「Settings」タブをクリック
5. 「Variables」セクションまでスクロール
6. 「Environment Variables」または「Secrets」をクリック
7. 「Add variable」または既存の変数を編集
8. 変数名と値を入力して保存

### 現在の環境変数を確認する方法

```bash
cd workers
npx wrangler secret list --config wrangler.applications.toml
```

### 環境変数を削除する方法

```bash
cd workers
npx wrangler secret delete KINTONE_API_TOKEN_APPLICATIONS --config wrangler.applications.toml
```

## 各Workerの環境変数一覧

### 認証用Worker（miyosino-auth）

```bash
npx wrangler secret put KINTONE_DOMAIN --config wrangler.auth.toml
npx wrangler secret put KINTONE_CLIENT_ID --config wrangler.auth.toml
npx wrangler secret put KINTONE_CLIENT_SECRET --config wrangler.auth.toml
npx wrangler secret put JWT_SECRET --config wrangler.auth.toml
```

### お知らせAPI用Worker（miyosino-announcements）

```bash
npx wrangler secret put KINTONE_DOMAIN --config wrangler.announcements.toml
npx wrangler secret put KINTONE_API_TOKEN --config wrangler.announcements.toml
npx wrangler secret put JWT_SECRET --config wrangler.announcements.toml
```

**アプリID**: 53（コード内でハードコード）

### 配布資料API用Worker（miyosino-circulars）

```bash
npx wrangler secret put KINTONE_DOMAIN --config wrangler.circulars.toml
npx wrangler secret put KINTONE_API_TOKEN_CIRCULARS --config wrangler.circulars.toml
npx wrangler secret put JWT_SECRET --config wrangler.circulars.toml
```

**アプリID**: 54（コード内でハードコード）

### グリーンウェルネスAPI用Worker（miyosino-greenwellness）

```bash
npx wrangler secret put KINTONE_DOMAIN --config wrangler.greenwellness.toml
npx wrangler secret put KINTONE_API_TOKEN --config wrangler.greenwellness.toml
npx wrangler secret put JWT_SECRET --config wrangler.greenwellness.toml
```

**アプリID**: 51（コード内でハードコード）

### 会議情報API用Worker（miyosino-minutes）

```bash
npx wrangler secret put KINTONE_DOMAIN --config wrangler.minutes.toml
npx wrangler secret put KINTONE_API_TOKEN_MINUTES --config wrangler.minutes.toml
npx wrangler secret put JWT_SECRET --config wrangler.minutes.toml
```

**アプリID**: 48（コード内でハードコード）

### イベントAPI用Worker（miyosino-events）

```bash
npx wrangler secret put KINTONE_DOMAIN --config wrangler.events.toml
npx wrangler secret put KINTONE_API_TOKEN_EVENTS --config wrangler.events.toml
npx wrangler secret put JWT_SECRET --config wrangler.events.toml
```

**アプリID**: 49（コード内でハードコード）

### 申請書API用Worker（miyosino-applications）

```bash
npx wrangler secret put KINTONE_DOMAIN --config wrangler.applications.toml
npx wrangler secret put KINTONE_API_TOKEN_APPLICATIONS --config wrangler.applications.toml
npx wrangler secret put JWT_SECRET --config wrangler.applications.toml
```

**アプリID**: 56（コード内でハードコード）

### お問い合わせフォーム用Worker（miyosino-contact）

```bash
npx wrangler secret put TURNSTILE_SITE_KEY --config wrangler.contact.toml
npx wrangler secret put TURNSTILE_SECRET_KEY --config wrangler.contact.toml
npx wrangler secret put KINTONE_CONTACT_DOMAIN --config wrangler.contact.toml
npx wrangler secret put KINTONE_CONTACT_APP_ID --config wrangler.contact.toml
npx wrangler secret put KINTONE_API_CONTACT_TOKEN --config wrangler.contact.toml
```

**アプリID**: `KINTONE_CONTACT_APP_ID`（環境変数として設定）

## 重要な注意事項

### JWT_SECRETについて

- **すべてのWorkerで同じ値を使用する必要があります**
- 認証用Worker（miyosino-auth）で生成されたJWTトークンを、他のAPI用Workerで検証するため
- 生成方法: `openssl rand -base64 32`
- 一度設定したら変更しないでください（変更すると既存のトークンが無効になります）

### KINTONE_DOMAINについて

- 各Workerで個別に設定する必要があります
- 同じKintoneインスタンスを使用する場合でも、各Workerで同じ値を設定してください
- お問い合わせ保存用のみ`KINTONE_CONTACT_DOMAIN`という別の変数名を使用します

### 環境変数の更新について

- `wrangler secret put` で設定した値は暗号化されて保存されます
- 環境変数を更新した後、Workerは自動的に再デプロイされます
- 変更が反映されるまで数秒かかる場合があります

## トラブルシューティング

### Wrangler CLIがインストールされていない場合

```bash
npm install -g wrangler
# または
npm install wrangler --save-dev
```

### 認証が必要な場合

```bash
npx wrangler login
```

### 設定ファイルのパスが正しいか確認

```bash
cd workers
npx wrangler whoami
```

### Workerがデプロイできない場合

1. 設定ファイル（`wrangler.*.toml`）が正しい場所にあるか確認
2. `account_id`が正しく設定されているか確認
3. Cloudflare DashboardでWorkerが作成されているか確認

### 環境変数が設定されていないエラーが出る場合

1. `wrangler secret list --config wrangler.*.toml` で環境変数を確認
2. 必要な環境変数がすべて設定されているか確認
3. 変数名のスペルミスがないか確認（大文字小文字を区別）

### APIトークンの権限を確認

- kintone管理画面の「アプリ設定」→「API」から、各アプリのAPIトークンの権限を確認
- 「レコードの閲覧」権限が付与されているか確認（お問い合わせ保存用は「レコード追加」）
