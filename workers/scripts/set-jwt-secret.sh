#!/bin/bash

# JWT_SECRETをすべてのWorkerに一括設定するスクリプト
# .dev.varsからJWT_SECRETを読み取って、すべてのWorkerに設定します

set -e

# .dev.varsファイルからJWT_SECRETを読み取る
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKERS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEV_VARS_FILE="$WORKERS_DIR/.dev.vars"

if [ ! -f "$DEV_VARS_FILE" ]; then
  echo "❌ エラー: .dev.varsファイルが見つかりません: $DEV_VARS_FILE"
  exit 1
fi

# JWT_SECRETを抽出
JWT_SECRET=$(grep "^JWT_SECRET=" "$DEV_VARS_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$JWT_SECRET" ]; then
  echo "❌ エラー: .dev.varsファイルにJWT_SECRETが見つかりません"
  exit 1
fi

echo "🔑 JWT_SECRETを検出しました（長さ: ${#JWT_SECRET}文字）"
echo "📝 使用する値: $JWT_SECRET"
echo ""

# JWT_SECRETを設定するWorkerのリスト
WORKERS=(
  "wrangler.auth.toml"
  "wrangler.announcements.toml"
  "wrangler.circulars.toml"
  "wrangler.greenwellness.toml"
  "wrangler.minutes.toml"
  "wrangler.events.toml"
  "wrangler.applications.toml"
  "wrangler.chat.toml"
)

cd "$WORKERS_DIR"

echo "📦 以下のWorkerにJWT_SECRETを設定します:"
for worker in "${WORKERS[@]}"; do
  if [ -f "$worker" ]; then
    echo "  - $worker"
  else
    echo "  - $worker (ファイルが見つかりません - スキップ)"
  fi
done
echo ""

# 各WorkerにJWT_SECRETを設定
for worker in "${WORKERS[@]}"; do
  if [ ! -f "$worker" ]; then
    echo "⏭️  スキップ: $worker (ファイルが見つかりません)"
    continue
  fi

  echo "🔧 $worker にJWT_SECRETを設定中..."
  
  # echoでJWT_SECRETをパイプしてwrangler secret putに渡す
  echo "$JWT_SECRET" | npx wrangler secret put JWT_SECRET --config "$worker" || {
    echo "❌ エラー: $worker へのJWT_SECRET設定に失敗しました"
    exit 1
  }
  
  echo "✅ $worker にJWT_SECRETを設定しました"
  echo ""
done

echo "✨ すべてのWorkerにJWT_SECRETを設定しました！"
echo ""
echo "📋 設定されたJWT_SECRET:"
echo "   $JWT_SECRET"
echo ""
echo "💡 この値は .dev.vars ファイルに保存されています。"
echo ""

