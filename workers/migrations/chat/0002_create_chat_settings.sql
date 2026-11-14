-- チャットボットの設定（オン・オフなど）
-- 適用: npx wrangler d1 migrations apply miyosino-chat --remote --config wrangler.chat.toml
-- 切り替え: workers/ で npm run chat:on / npm run chat:off（状態の確認は npm run chat:status）

CREATE TABLE IF NOT EXISTS chat_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 最初はオン（'1' でオン、それ以外はオフ）
INSERT OR IGNORE INTO chat_settings (key, value) VALUES ('enabled', '1');
