#!/bin/bash

# チャットボットの1日の回数上限を本番の D1（miyosino-chat）に設定するスクリプト
#
# 使い方（workers/ で）:
#   npm run chat:limits -- <1人1日の上限> <全員合計の1日の上限>
#   例: npm run chat:limits -- 30 500
#
# すぐに反映され、デプロイし直しても戻りません。0 にするとその上限で誰も使えなくなります。

set -e

PER_USER="$1"
TOTAL="$2"

if [[ ! "$PER_USER" =~ ^[0-9]+$ || ! "$TOTAL" =~ ^[0-9]+$ ]]; then
  echo "❌ 使い方: npm run chat:limits -- <1人1日の上限> <全員合計の1日の上限>（0以上の整数）" >&2
  echo "   例: npm run chat:limits -- 30 500" >&2
  exit 1
fi

if (( PER_USER > TOTAL )); then
  echo "⚠️  1人の上限（$PER_USER）が全員の上限（$TOTAL）より大きくなっています。" >&2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# 値は上で整数だと確かめているので、SQL に直接埋め込んでよい
npx wrangler d1 execute miyosino-chat --remote --config wrangler.chat.toml --command \
  "INSERT INTO chat_settings (key, value) VALUES ('limit_per_user', '$PER_USER'), ('limit_total', '$TOTAL') ON CONFLICT (key) DO UPDATE SET value = excluded.value"

echo "✅ 1人1日 $PER_USER 回、全員合計で1日 $TOTAL 回に設定しました"
