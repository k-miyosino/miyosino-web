-- チャットボットの利用回数（日本時間の日付ごと）
-- 適用: npx wrangler d1 migrations apply miyosino-chat --remote --config wrangler.chat.toml

-- 1人ごとの回数。user_id は kintone のユーザーコード（JWT の sub）
CREATE TABLE IF NOT EXISTS chat_usage (
  user_id TEXT NOT NULL,
  date_jst TEXT NOT NULL, -- YYYY-MM-DD
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date_jst)
);

-- 全員の合計回数（費用の安全装置）
CREATE TABLE IF NOT EXISTS chat_usage_total (
  date_jst TEXT PRIMARY KEY, -- YYYY-MM-DD
  count INTEGER NOT NULL DEFAULT 0
);
