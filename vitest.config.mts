import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// フロントエンド（src/）のテスト。Workers のテストは workers/ で別に動かす（cd workers && npm test）
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // 画面（window・localStorage）を使うテストは、ファイルの先頭に @vitest-environment jsdom を書く
    environment: 'node',
  },
});
