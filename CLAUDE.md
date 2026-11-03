# CLAUDE.md - miyosino-web プロジェクト指示書

かわつる三芳野団地のホームページ（Next.js 15 + TypeScript + Tailwind CSS、静的エクスポート）と、
API キーを預かる Cloudflare Workers（`workers/`）。構成の詳細は `README.md` と `.claude/commands/architect.md` を参照。

## 確認のコマンド

このリポジトリにはテストがない。変更は型チェックと ESLint で確かめる。

```bash
npx tsc --noEmit                 # フロントエンド（ルートの tsconfig.json）
npx tsc --noEmit -p workers      # Workers（以前からの型エラーが数件ある）
npx eslint src                   # src/ だけ。workers/ は Prettier の既存エラーが多いので対象外
```

`npm run build` は GitHub Secrets の環境変数（`NEXT_PUBLIC_*`）が前提なので、ローカルやクラウドでは通らないことがある。

### フック（`.claude/settings.json`）

- 編集後: 編集したファイルを型チェックと ESLint で確かめ、エラーがあれば知らせる（`.claude/hooks/post_edit_check.py`）
- 終了前: 未コミットのコード変更があれば型チェックと ESLint を実行し、エラーなら終了させない（`.claude/hooks/stop_check.py`）
- `git add`/`git commit`: 秘密情報のファイルが含まれていればブロックする（`.claude/hooks/pre_git_guard.py`）

Workers の既存の型エラーは `.claude/hooks/_checks.py` の `KNOWN_WORKER_ERRORS` で除外している。直したらそこから消す。

## ブランチ

`develop` → `staging` → `main` の順に PR でマージする。作業ブランチは `develop` から切り、PR も `develop` に向ける。
`staging` へのマージで GitHub Pages に、`main` へのマージ（`workers/` に変更があるとき）で Cloudflare Workers にデプロイされる。

## セキュリティ制約

- `.env*`（`.env.local` など）・`workers/.dev.vars`・`*.pem` は秘密情報。読んだ内容を出力しない・コミットしない
  （見本の `workers/.dev.vars.example` は追跡してよい）
- Kintone・microCMS の API キーは Workers の secrets にだけ置く。フロントエンドのコードに書かない

## クラウド（claude.ai/code）で作業するとき

- クラウド環境は Linux（Ubuntu 24.04）。Node.js は入っている。依存パッケージは `scripts/cloud-setup.sh`（環境のセットアップスクリプト）で入れる。
  `node_modules` がなければ、まず `npm ci` と `cd workers && npm ci` を実行する
- 秘密情報（`.env.local`・`workers/.dev.vars`）はないので、`npm run dev`・`npm run build`・`wrangler dev` で実際のデータを使った画面や API は確かめられない。
  Kintone・microCMS・Cloudflare へのデプロイ（`wrangler deploy`）もしない
- 確かめられるのは型チェックと ESLint まで。画面や Workers の動作を変えたときは、確かめていないことを PR に書き、
  利用者にローカル（`npm run dev`）や staging での確認を頼む
