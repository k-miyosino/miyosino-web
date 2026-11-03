#!/bin/bash
# Claude Code のクラウド環境（claude.ai/code）用のセットアップスクリプト。npm の依存パッケージを入れる。
#
# 使い方: claude.ai/code の環境設定で「Setup script」を開き、このファイルの中身を貼り付ける。
# クラウド環境は Ubuntu 24.04 で、このスクリプトは root で実行される。Node.js は最初から入っている。
#
# 失敗してもセッションは起動させる（必ず exit 0）。入らなかったときは node_modules がない状態で起動し、
# フックは型チェックと ESLint を飛ばす。その場合は Claude に「npm ci --ignore-scripts」を実行させる。
set -u

# リポジトリのフォルダを探す（スクリプトの実行場所がリポジトリとは限らないため）
repo=""
for dir in "$PWD" /home/user/miyosino-web /home/user/*/; do
  if [[ -f "$dir/package.json" ]] && grep -q '"name": "miyosino-web"' "$dir/package.json"; then
    repo="$dir"
    break
  fi
done

if [[ -z "$repo" ]]; then
  echo "WARNING: miyosino-web のフォルダが見つからないため、npm ci を実行しませんでした" >&2
  exit 0
fi

node --version
# 依存パッケージのインストールスクリプト（postinstall など）は実行しない。型チェックと ESLint には不要で、husky の prepare もクラウドでは要らない
(cd "$repo" && npm ci --ignore-scripts --no-audit --no-fund) \
  || echo "WARNING: npm ci（ルート）に失敗しました" >&2
(cd "$repo/workers" && npm ci --ignore-scripts --no-audit --no-fund) \
  || echo "WARNING: npm ci（workers）に失敗しました" >&2
exit 0
