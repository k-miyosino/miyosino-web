#!/bin/bash

# デプロイ対象のWorker（wranglerの設定ファイル名）をJSON配列で出力するスクリプト
# GitHub Actions（.github/workflows/deploy-workers.yml）から呼び出されます
#
# 使い方:
#   git diff --name-only <before> <after> | bash scripts/detect-changed-workers.sh
#     → 変更されたファイルから対象のWorkerを判定
#   bash scripts/detect-changed-workers.sh --select all
#   bash scripts/detect-changed-workers.sh --select auth
#     → 指定したWorkerを対象にする
#
# 出力例: ["wrangler.auth.toml","wrangler.history.toml"]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKERS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WORKERS_DIR"

ALL_CONFIGS=$(ls wrangler*.toml)

# 設定ファイル名の一覧をJSON配列に変換
to_json() {
  local configs="$1"
  local first=1
  printf '['
  for config in $configs; do
    if [[ $first -eq 0 ]]; then printf ','; fi
    printf '"%s"' "$config"
    first=0
  done
  printf ']\n'
}

# 設定ファイルの main（Workerの本体ファイル）を取得
main_of() {
  local config="$1"
  grep '^main' "$config" | sed 's/.*"\(.*\)".*/\1/'
}

# --select: 指定されたWorkerを対象にする
if [[ "$1" == "--select" ]]; then
  case "$2" in
    all) to_json "$ALL_CONFIGS"; exit 0 ;;
    *) config="wrangler.$2.toml" ;;
  esac
  if [[ ! -f "$config" ]]; then
    echo "❌ エラー: 設定ファイルが見つかりません: $config" >&2
    exit 1
  fi
  to_json "$config"
  exit 0
fi

# 標準入力から変更ファイル一覧を受け取り、workers/ 配下のみに絞る
CHANGED=$(grep '^workers/' | sed 's#^workers/##' || true)

# 依存関係やTypeScript設定が変わった場合はすべてのWorkerを対象にする
for file in $CHANGED; do
  case "$file" in
    package.json|package-lock.json|tsconfig.json)
      to_json "$ALL_CONFIGS"
      exit 0
      ;;
    *) ;;
  esac
done

TARGETS=""
for config in $ALL_CONFIGS; do
  main=$(main_of "$config")
  # 本体ファイルが import している同じフォルダ内のファイル（例: api/_kintone.ts）
  imports=$(grep -oE "from ['\"]\./[^'\"]+['\"]" "$main" 2>/dev/null \
    | sed -E "s#from ['\"]\./([^'\"]+)['\"]#$(dirname "$main")/\1.ts#" || true)

  for file in $CHANGED; do
    hit=0
    if [[ "$file" == "$config" || "$file" == "$main" ]]; then
      hit=1
    fi
    for imported in $imports; do
      if [[ "$file" == "$imported" ]]; then hit=1; fi
    done
    if [[ $hit -eq 1 ]]; then
      TARGETS="$TARGETS $config"
      break
    fi
  done
done

to_json "$TARGETS"
