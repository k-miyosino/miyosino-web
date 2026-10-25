const fs = require('fs');
const path = require('path');

// 本番環境（静的エクスポート）の時のみAPIルートを復元
if (process.env.NODE_ENV === 'production') {
  const apiDir = path.join(__dirname, '../src/app/api');
  const backupDir = path.join(__dirname, '../src/.api-backup');

  // APIルートを復元
  if (fs.existsSync(backupDir)) {
    if (fs.existsSync(apiDir)) {
      // 既存のAPIディレクトリを削除
      fs.rmSync(apiDir, { recursive: true, force: true });
    }
    fs.renameSync(backupDir, apiDir);
    console.log('API routes restored');
  }
} else {
  console.log('Skipping API route restoration (development mode)');
}

