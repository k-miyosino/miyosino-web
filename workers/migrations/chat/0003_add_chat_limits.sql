-- チャットボットの回数の上限を設定に加える（日本時間で区切る）
-- 適用: npx wrangler d1 migrations apply miyosino-chat --remote --config wrangler.chat.toml
-- 変更: workers/ で npm run chat:limits -- <1人1日の上限> <全員合計の1日の上限>

-- すでに値があれば変えない（変更した上限を流し直しで戻さないため）
INSERT OR IGNORE INTO chat_settings (key, value) VALUES ('limit_per_user', '20');
INSERT OR IGNORE INTO chat_settings (key, value) VALUES ('limit_total', '300');
