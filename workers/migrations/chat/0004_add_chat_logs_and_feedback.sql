-- チャットボットの質問ログと、答えへの評価（わかった／少しわかった／わからなかった）
-- 適用: npx wrangler d1 migrations apply miyosino-chat --remote --config wrangler.chat.toml
-- だれの質問・評価かは保存しない（kintone のユーザーコードなどは入れない）。
-- 日時は UTC（SQLite の datetime('now') の形）。見るときに日本時間に直す。
-- 保存期間（log_retention_days）を過ぎたものは、Worker の定期実行が毎日消す。

-- 質問ログ（log_enabled がオンで、利用者が「この会話を保存しない」を選んでいないときだけ）
CREATE TABLE IF NOT EXISTS chat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  conversation_id TEXT NOT NULL DEFAULT '', -- 画面が会話ごとに作るランダムな ID（だれかとは結びつかない）
  turn INTEGER NOT NULL,                    -- 会話の中で何番目の質問か（1から）
  page TEXT NOT NULL DEFAULT '',            -- 質問したページのパス
  question TEXT NOT NULL,                   -- 電話番号・メールアドレス・部屋番号らしい文字列は ＊＊＊ に置き換え済み
  answer TEXT NOT NULL,                     -- 同上
  outcome TEXT NOT NULL,                    -- answered（答えた）／refused（安全上の理由で断られた）
  model TEXT NOT NULL DEFAULT '',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_chat_logs_conversation ON chat_logs (conversation_id, turn);

-- 答えへの評価（feedback_enabled がオンのとき。質問ログを保存しないときも評価だけは残す）
CREATE TABLE IF NOT EXISTS chat_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  conversation_id TEXT NOT NULL,
  turn INTEGER NOT NULL,
  rating TEXT NOT NULL,                     -- understood（わかった）／partly（少しわかった）／not（わからなかった）
  page TEXT NOT NULL DEFAULT '',
  UNIQUE (conversation_id, turn)            -- 同じ答えへの評価は1つ（選び直したら上書き）
);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_created_at ON chat_feedback (created_at);

-- 設定（最初はどちらもオフ。告知とプライバシーポリシーの準備ができてからオンにする）
INSERT OR IGNORE INTO chat_settings (key, value) VALUES ('log_enabled', '0');
INSERT OR IGNORE INTO chat_settings (key, value) VALUES ('log_retention_days', '180');
INSERT OR IGNORE INTO chat_settings (key, value) VALUES ('feedback_enabled', '0');
