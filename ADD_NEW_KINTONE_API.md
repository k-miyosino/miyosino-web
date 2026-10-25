# 新しいKintone API追加手順

このドキュメントは、新しいKintone API用のWorkerを追加する際の標準的な手順をまとめたものです。

## 目次

1. [概要](#概要)
2. [実装手順](#実装手順)
3. [各ファイルの更新内容](#各ファイルの更新内容)
4. [環境変数の設定](#環境変数の設定)
5. [デプロイと動作確認](#デプロイと動作確認)
6. [チェックリスト](#チェックリスト)

## 概要

新しいKintone APIを追加する場合、以下の作業が必要です：

- Cloudflare Workerの作成（バックエンドAPI）
- フロントエンドユーティリティの更新
- UIコンポーネントの更新
- 環境変数の設定
- ドキュメントの更新

## 実装手順

### 1. Cloudflare Workerの作成

#### 1-1. Workerファイルの作成

`workers/api/[worker-name].ts` を作成します。

既存のWorker（例: `circulars.ts`, `applications.ts`）を参考に、以下の要素を含めます：

- **インターフェース定義**:
  - `Env`: 環境変数の型定義
  - `KintoneRecord`: Kintoneレコードの型定義
  - `KintoneRecordsResponse`: Kintone APIレスポンスの型定義
  - `JWTPayload`: JWTペイロードの型定義

- **関数**:
  - `corsHeaders()`: CORSヘッダーの生成
  - `verifyJWT()`: JWT検証関数
  - `fetchKintoneRecords()`: Kintone APIからレコードを取得
  - `convertKintoneRecordTo[Type]()`: Kintoneレコードをアプリケーション型に変換

**注意**: ラジオボタンフィールドでフィルタリングする場合、クエリでは`=`演算子が使用できません。全レコードを取得してから`filter()`でフィルタリングしてください。

- **エンドポイント**:
  - `GET /[endpoint]`: データ取得
  - `GET /[endpoint]/file?fileKey=xxx`: ファイルダウンロード（必要な場合）

**実装例**:

```typescript
/**
 * Cloudflare Workers - Kintone [API名]API プロキシ
 *
 * このWorkerは組合員専用ページからkintoneの[データ名]を取得するための
 * プロキシとして機能します。
 *
 * エンドポイント:
 * - GET /[endpoint] - [データ名]を取得
 * - GET /[endpoint]/file?fileKey=xxx - 添付ファイルをダウンロード
 *
 * 認証: JWTトークンで組合員認証を確認
 */

interface Env {
  KINTONE_DOMAIN: string;
  KINTONE_API_TOKEN_[NAME]: string; // アプリID: [ID]用のAPIトークン
  JWT_SECRET: string;
}

// ... 実装
```

#### 1-2. wrangler設定ファイルの作成

`workers/wrangler.[worker-name].toml` を作成します。

既存の設定ファイル（例: `wrangler.circulars.toml`）をコピーして、以下を変更：

```toml
name = "miyosino-[worker-name]"
main = "api/[worker-name].ts"
compatibility_date = "2024-01-01"
account_id = "e6544c934cee9bfb0cdfc5b155ce8aeb"
```

### 2. フロントエンドユーティリティの更新

#### 2-1. `src/shared/utils/fileDownload.ts` の更新

ファイルダウンロード機能が必要な場合：

1. `FileDownloadEndpoint` 型に新しいエンドポイントを追加
2. `getApiEndpoint()` 関数に新しいケースを追加

```typescript
export type FileDownloadEndpoint =
  | 'greenwellness'
  | 'circulars'
  | 'minutes'
  | 'applications'
  | '[new-endpoint]'; // 追加

function getApiEndpoint(endpoint: FileDownloadEndpoint): string {
  // ... 既存のケース
  case '[new-endpoint]':
    return (
      process.env.NEXT_PUBLIC_[NAME]_API_URL ||
      'https://miyosino-[worker-name].anorimura-miyosino.workers.dev'
    );
  // ...
}
```

#### 2-2. `src/shared/utils/kintone.ts` の更新

1. APIエンドポイントの定数を追加

```typescript
const [NAME]_API_ENDPOINT =
  process.env.NEXT_PUBLIC_[NAME]_API_URL ||
  'https://miyosino-[worker-name].anorimura-miyosino.workers.dev';
```

2. 型定義を追加

```typescript
export interface [Type] {
  id: string;
  title: string;
  // ... その他のフィールド
  file?: {
    name: string;
    fileKey: string;
    size: string;
  };
}

interface [Type]sResponse {
  [items]: [Type][];
}
```

3. データ取得関数を追加

```typescript
/**
 * kintoneから[データ名]一覧を取得
 * @returns [データ名]の配列
 */
export async function fetch[Type]s(): Promise<[Type][]> {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('認証トークンがありません');
    }

    const url = new URL(`${[NAME]_API_ENDPOINT}/[endpoint]`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      // エラーハンドリング
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
        }
        throw new Error('認証に失敗しました');
      }
      throw new Error(`[データ名]の取得に失敗しました: ${response.status}`);
    }

    const data = (await response.json()) as [Type]sResponse;
    return data.[items];
  } catch (error) {
    console.error('[Kintone] fetch[Type]s error:', error);
    throw error;
  }
}
```

### 3. UIコンポーネントの更新

既存のコンポーネント（例: `ApplicationsContent.tsx`）を参考に、新しいコンポーネントを作成または更新します。

**実装パターン**:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { fetch[Type]s, [Type] } from '@/shared/utils/kintone';
import { redirectToLogin } from '@/shared/utils/auth';
import FileDownloadButton from '@/components/shared/FileDownloadButton';

export default function [Component]Content() {
  const [[items], set[Items]] = useState<[Type][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load[Items] = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetch[Type]s();
        set[Items](data);
      } catch (err) {
        // エラーハンドリング
        if (err instanceof Error && err.message.includes('認証')) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
          }
          redirectToLogin();
          return;
        }
        setError(err instanceof Error ? err.message : '[データ名]の取得に失敗しました');
        set[Items]([]);
      } finally {
        setLoading(false);
      }
    };

    load[Items]();
  }, []);

  // UI実装
}
```

### 4. package.jsonの更新（必要に応じて）

`workers/package.json` に開発・デプロイスクリプトを追加：

```json
{
  "scripts": {
    "dev:[worker-name]": "wrangler dev --config wrangler.[worker-name].toml",
    "deploy:[worker-name]": "wrangler deploy --config wrangler.[worker-name].toml"
  }
}
```

### 5. set-jwt-secret.shの更新

`workers/scripts/set-jwt-secret.sh` の `WORKERS` 配列に新しいWorkerを追加：

```bash
WORKERS=(
  "wrangler.auth.toml"
  "wrangler.announcements.toml"
  # ... 既存のWorker
  "wrangler.[worker-name].toml"  # 追加
)
```

`.github/workflows/deploy-workers.yml` の手動実行用の選択肢（`options`）にもWorker名を追加：

```yaml
        options:
          - all
          # ... 既存のWorker
          - [worker-name]  # 追加
```

※ main へのマージ時の自動デプロイは `wrangler.*.toml` から自動で対象を判定するため、追加作業は不要です。

### 6. Worker実装時の注意点

#### ラジオボタンフィールドのフィルタリング

Kintoneのラジオボタンフィールドは、クエリで`=`演算子を使用できません。以下のエラーが発生します：

```
Kintone APIエラー: publishedフィールドのフィールドタイプには演算子=を使用できません。
```

**解決方法**: 全レコードを取得してから、取得後にフィルタリングします。

```typescript
// ❌ 間違い: クエリでフィルタリング（エラーになる）
url.searchParams.append('query', 'published = "公開"');

// ✅ 正しい: 取得後にフィルタリング
const kintoneResponse = await fetchKintoneRecords(env);
const applications = kintoneResponse.records
  .filter((record) => {
    // 「公開」のみを表示対象とする
    return record.published?.value === '公開';
  })
  .map((record) => convertKintoneRecordToApplication(record));
```

参考実装: `workers/api/applications.ts` と `workers/api/announcements.ts`

### 7. ドキュメントの更新

#### 6-1. `workers/.dev.vars.example` の更新

新しいAPI用の環境変数設定例を追加：

```bash
# [API名]アプリ（アプリID: [ID]）用の設定
# ローカル開発でテストする場合のみ設定してください
# ドメイン: KINTONE_DOMAIN
# アプリID: [ID]（コード内でハードコード、環境変数なし）
# KINTONE_DOMAIN=your-subdomain.cybozu.com
# KINTONE_API_TOKEN_[NAME]=your-api-token-for-app-[ID]-here
#
# 【メモ】[API名]アプリ設定
# ドメイン:
# アプリID: [ID]
# APIトークン:
# 権限: レコードの閲覧
# 備考:
```

#### 6-2. `README.md` の更新

1. 環境変数の設定セクションに新しいWorkerの設定手順を追加
2. デプロイコマンドのリストに追加
3. WorkerのURLリストに追加
4. 環境変数の説明に `NEXT_PUBLIC_[NAME]_API_URL` を追加
5. `.env.local` の例に追加

#### 6-3. `UPDATE_ENV_VARS.md` の更新

1. 各Workerの環境変数一覧セクションに追加
2. デプロイコマンドのリストに追加

## 環境変数の設定

### ローカル開発環境

`workers/.dev.vars` に以下を追加：

```bash
KINTONE_DOMAIN=your-subdomain.cybozu.com
KINTONE_API_TOKEN_[NAME]=your-api-token-here
JWT_SECRET=your-jwt-secret-here
```

### 本番環境

```bash
cd workers

# 環境変数を設定
npx wrangler secret put KINTONE_DOMAIN --config wrangler.[worker-name].toml
npx wrangler secret put KINTONE_API_TOKEN_[NAME] --config wrangler.[worker-name].toml
npx wrangler secret put JWT_SECRET --config wrangler.[worker-name].toml
```

**重要**: JWT_SECRETはすべてのWorkerで同じ値を使用する必要があります。`npm run set-jwt-secret` を実行して一括設定してください。

## デプロイと動作確認

### 1. Workerのデプロイ

```bash
cd workers
npx wrangler deploy --config wrangler.[worker-name].toml
```

### 2. 環境変数の確認

```bash
cd workers
npx wrangler secret list --config wrangler.[worker-name].toml
```

### 3. 動作確認

1. ブラウザで該当ページを開く
2. 開発者ツールのNetworkタブでAPIリクエストを確認
3. エラーがないか確認

## チェックリスト

実装完了後、以下を確認してください：

### Worker実装

- [ ] `workers/api/[worker-name].ts` を作成
- [ ] `workers/wrangler.[worker-name].toml` を作成
- [ ] JWT認証を実装
- [ ] エラーハンドリングを実装
- [ ] CORSヘッダーを設定

### フロントエンド

- [ ] `src/shared/utils/fileDownload.ts` を更新（ファイルダウンロードが必要な場合）
- [ ] `src/shared/utils/kintone.ts` を更新
- [ ] UIコンポーネントを作成または更新

### 設定ファイル

- [ ] `workers/package.json` を更新（必要に応じて）
- [ ] `workers/scripts/set-jwt-secret.sh` を更新

### ドキュメント

- [ ] `workers/.dev.vars.example` を更新
- [ ] `README.md` を更新
- [ ] `UPDATE_ENV_VARS.md` を更新

### 環境変数

- [ ] ローカル開発環境（`.dev.vars`）に設定
- [ ] 本番環境に設定（`wrangler secret put`）
- [ ] JWT_SECRETがすべてのWorkerで同じ値になっているか確認

### デプロイとテスト

- [ ] Workerをデプロイ
- [ ] 環境変数が正しく設定されているか確認
- [ ] ブラウザで動作確認
- [ ] エラーログを確認

## 実装パターンと注意点

### Kintone API呼び出し

- **アプリID**: 通常はコード内でハードコード（例: `const appId = 56;`）
- **クエリ**: 必要に応じて `url.searchParams.append('query', '...')` でフィルタリング
- **ラジオボタンフィールドの制限**: ラジオボタンフィールドはクエリで`=`演算子を使用できないため、全レコードを取得してから`filter()`でフィルタリングする必要がある
  - 例: `kintoneResponse.records.filter((record) => record.published?.value === '公開')`
- **エラーハンドリング**: 詳細なエラーメッセージをログに出力

### ファイルダウンロード

- **エンドポイント**: `GET /[endpoint]/file?fileKey=xxx`
- **KintoneファイルAPI**: `https://${env.KINTONE_DOMAIN}/k/v1/file.json?fileKey=...`
- **Content-Type**: Kintoneのレスポンスから取得
- **Content-Disposition**: ファイル名を含むヘッダーを設定

### JWT認証

- **検証**: すべてのAPIエンドポイントでJWT検証を実装
- **JWT_SECRET**: すべてのWorkerで同じ値を使用
- **401エラー**: 認証失敗時は適切なエラーレスポンスを返す

### エラーハンドリング

- **Kintone APIエラー**: 詳細なエラー情報をログに出力
- **フロントエンド**: 認証エラーの場合は自動的にログインページにリダイレクト
- **ユーザーフレンドリー**: エラーメッセージを日本語で表示

## 参考実装

以下のファイルを参考にしてください：

- **Worker実装**: `workers/api/applications.ts`
- **フロントエンド**: `src/components/member/ApplicationsContent.tsx`
- **ユーティリティ**: `src/shared/utils/kintone.ts` の `fetchApplications()` 関数

## トラブルシューティング

### 401 Unauthorized エラー

1. JWT_SECRETがすべてのWorkerで同じ値になっているか確認
2. `npm run set-jwt-secret` を実行してJWT_SECRETを一括設定
3. 環境変数が正しく設定されているか確認

### 環境変数が設定されていないエラー

1. `wrangler secret list --config wrangler.[worker-name].toml` で確認
2. 必要な環境変数がすべて設定されているか確認
3. 変数名のスペルミスがないか確認

### ファイルダウンロードが動作しない

1. Workerのファイルダウンロードエンドポイントが正しく実装されているか確認
2. `FileDownloadButton` コンポーネントの `endpoint` プロパティが正しいか確認
3. `fileDownload.ts` に新しいエンドポイントが追加されているか確認
