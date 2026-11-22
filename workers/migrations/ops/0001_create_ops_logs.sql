-- 運用ダッシュボード（ops Worker）の記録
-- 適用: npx wrangler d1 migrations apply miyosino-ops --remote --config wrangler.ops.toml
--
-- タスクと秘密情報の定義は workers/api/_ops-catalog.ts にある。ここには「いつ・だれが対応したか」だけを残す。
-- 秘密情報の値は保存しない。

-- 定期タスクを対応した記録
CREATE TABLE IF NOT EXISTS ops_task_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,                    -- _ops-catalog.ts の OPS_TASKS の id
  done_at TEXT NOT NULL DEFAULT (datetime('now')),
  done_by TEXT NOT NULL DEFAULT '',         -- 対応した管理者の表示名（JWT の name）
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_ops_task_log_task ON ops_task_log (task_id, done_at);

-- 秘密情報を入れ替えた記録
CREATE TABLE IF NOT EXISTS ops_secret_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  secret_id TEXT NOT NULL,                  -- _ops-catalog.ts の OPS_SECRETS の id
  rotated_at TEXT NOT NULL DEFAULT (datetime('now')),
  done_by TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_ops_secret_log_secret ON ops_secret_log (secret_id, rotated_at);
