# microCMS MCP 設定手順

Claude Code などの AI アシスタントから、microCMS のコンテンツを読み取るための設定手順です。

## 目次

1. [概要](#概要)
2. [APIキーの準備](#apiキーの準備)
3. [Claude Codeでの設定](#claude-codeでの設定)
4. [Claude Desktop / claude.aiでの設定](#claude-desktop--claudeaiでの設定)
5. [使い方の例](#使い方の例)
6. [注意事項](#注意事項)

## 概要

microCMS が提供するリモート MCP サーバー（ベータ版）を使います。ローカルでサーバーを起動する必要はありません。

- エンドポイント: `https://mcp.microcms.io/mcp/k-miyoshino`
- 認証: microCMS の APIキーを `Authorization: Bearer <APIキー>` ヘッダーで送ります（OAuth には未対応）
- このサイトのサイト表示（Cloudflare Workers 経由の取得）とは別の経路です。サイトの動作には影響しません

> ローカル版の `microcms-mcp-server`（npm パッケージ）は今後原則として更新されないため、リモート版を使います。

## APIキーの準備

MCP からは **読み取りのみ** 行い、コンテンツの更新は microCMS の管理画面で手動で行う運用とします。

そのため、Cloudflare Workers で使っている **読み取り専用 APIキー（`MICROCMS_API_KEY` と同じもの）を共用** します（Hobby プランは APIキーが 1 つのため）。

1. [microCMS](https://microcms.io/) にログインし、サービス `k-miyoshino` を選択
2. **API設定** > **APIキー** で既存のキーを確認（GET 権限のみであることを確認）
3. 後述の環境変数 `MICROCMS_MCP_API_KEY` にこのキーを設定

> このキーに書き込み権限を追加しないでください。Workers 側のキーも書き込み可能になってしまいます。
> MCP から更新したくなった場合は、Team プラン（APIキー 3 個）で MCP 専用キーを分けることを検討してください。

## Claude Codeでの設定

リポジトリ直下の `.mcp.json` に設定済みです。APIキーは環境変数 `MICROCMS_MCP_API_KEY` から読み込むため、キーをファイルに書く必要はありません。

```json
{
  "mcpServers": {
    "microcms": {
      "type": "http",
      "url": "https://mcp.microcms.io/mcp/k-miyoshino",
      "headers": {
        "Authorization": "Bearer ${MICROCMS_MCP_API_KEY}"
      }
    }
  }
}
```

### 手順

1. 環境変数を設定します（`~/.bashrc` や `~/.zshrc` などに追記）

   ```bash
   export MICROCMS_MCP_API_KEY="作成したAPIキー"
   ```

2. このリポジトリで Claude Code を起動します。初回はプロジェクトの MCP サーバーを使うか確認されるので、許可します
3. `/mcp` で `microcms` が接続済み（connected）になっていることを確認します

### Claude Code on the web（クラウド環境）で使う場合

クラウド環境の設定で、環境変数 `MICROCMS_MCP_API_KEY` を追加してください。あわせて、ネットワーク設定で `mcp.microcms.io` への通信を許可する必要があります。

### 自分だけで使いたい場合

`.mcp.json` を使わず、ユーザー単位で追加することもできます。

```bash
claude mcp add --transport http --scope user microcms \
  https://mcp.microcms.io/mcp/k-miyoshino \
  --header "Authorization: Bearer ${MICROCMS_MCP_API_KEY}"
```

## Claude Desktop / claude.aiでの設定

カスタムコネクタとして追加します。

1. **設定** > **コネクタ** > **カスタムコネクタを追加**
2. URL に `https://mcp.microcms.io/mcp/k-miyoshino` を入力
3. 認証は「なし」を選び、リクエストヘッダーに `Authorization: Bearer <APIキー>` を設定

画面の項目名は変わることがあるため、詳しくは [microCMS 公式ドキュメント](https://document.microcms.io/mcp-server/microcms-mcp) を参照してください。

## 使い方の例

このサイトはコンテンツ API（`contents`）を `category` で分けて使っています（`src/types/categories.ts`）。

| やりたいこと       | 依頼の例                                                                      |
| ------------------ | ----------------------------------------------------------------------------- |
| 内容の点検         | 「`facility` のコンテンツで、説明が空のものを一覧にして」                     |
| 修正箇所の洗い出し | 「全カテゴリから旧電話番号が残っている箇所を一覧にして」                      |
| 型との突き合わせ   | 「`src/types/community.ts` の型と実データのフィールドがずれていないか調べて」 |

## 注意事項

- **APIキーをコミットしない**: `.mcp.json` には環境変数の参照だけを書き、キーそのものは書かないでください
- **更新は手動**: MCP は読み取り専用で使い、コンテンツの追加・修正・公開は管理画面で行ってください
- **ベータ版**: リモート MCP サーバーはベータ版のため、仕様が変わる可能性があります
- **環境変数が未設定の場合**: `microcms` サーバーは接続に失敗しますが、他の開発作業には影響しません
