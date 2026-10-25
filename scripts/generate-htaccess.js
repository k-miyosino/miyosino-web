const fs = require('fs');
const path = require('path');

// 本番環境（静的エクスポート）の時のみ、さくらインターネット（Apache）用の .htaccess を生成
// GitHub Pages では .htaccess は使われないため、置いてあっても影響はない
if (process.env.NODE_ENV === 'production') {
  // next.config.ts と同じ basePath の決め方
  const basePath = process.env.BASE_PATH_OVERRIDE ?? '/miyosino-web';
  const outDir = path.join(__dirname, '../out');

  const lines = [
    '# このファイルはビルド時に scripts/generate-htaccess.js で生成されます',
    '',
    '# 存在しないページはNext.jsが生成した404ページを表示',
    `ErrorDocument 404 ${basePath}/404.html`,
  ];

  // テスト環境（/v2 など）は検索エンジンにインデックスさせない
  if (process.env.SITE_NOINDEX === 'true') {
    lines.push(
      '',
      '# テスト環境のため検索エンジンにインデックスさせない',
      '<IfModule mod_headers.c>',
      '  Header set X-Robots-Tag "noindex, nofollow"',
      '</IfModule>'
    );
  }

  if (fs.existsSync(outDir)) {
    fs.writeFileSync(path.join(outDir, '.htaccess'), lines.join('\n') + '\n');
    console.log('.htaccess generated');
  }
} else {
  console.log('Skipping .htaccess generation (development mode)');
}
