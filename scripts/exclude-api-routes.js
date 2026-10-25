const fs = require('fs');
const path = require('path');

// 本番環境（静的エクスポート）の時のみAPIルートを除外
if (process.env.NODE_ENV === 'production') {
  const apiDir = path.join(__dirname, '../src/app/api');
  const backupDir = path.join(__dirname, '../src/.api-backup');

  // APIルートをバックアップディレクトリに移動
  if (fs.existsSync(apiDir)) {
    if (fs.existsSync(backupDir)) {
      // 既存のバックアップを削除
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
    fs.renameSync(apiDir, backupDir);
    console.log('API routes excluded from build');
  }
} else {
  console.log('Skipping API route exclusion (development mode)');
}

