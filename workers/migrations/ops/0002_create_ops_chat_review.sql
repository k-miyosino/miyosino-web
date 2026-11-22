-- チャットの見直しの記録（運用ダッシュボードの「チャット」→「見直し」）
-- 適用: npx wrangler d1 migrations apply miyosino-ops --remote --config wrangler.ops.toml
--
-- 質問と答えは miyosino-chat にある。ここには「どの質問を・いつ・だれが・どう扱ったか」だけを残す。
-- 同じ質問に何度でも記録でき、いちばん新しい記録がその質問の状態になる。

CREATE TABLE IF NOT EXISTS ops_chat_review (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_key TEXT NOT NULL,                   -- 「会話の番号:何番目の質問か」（chat_logs・chat_feedback の conversation_id と turn）
  status TEXT NOT NULL,                     -- fixed（直した）／skipped（対応不要）／open（未対応に戻した）
  done_at TEXT NOT NULL DEFAULT (datetime('now')),
  done_by TEXT NOT NULL DEFAULT '',         -- 記録した管理者の表示名（JWT の name）
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_ops_chat_review_key ON ops_chat_review (item_key, done_at);
