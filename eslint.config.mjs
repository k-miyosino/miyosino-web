import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier/flat';
import prettierPlugin from 'eslint-plugin-prettier';

// eslint-config-next 16 から、設定は ESLint の Flat Config の形で直接読み込む
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Prettier と重なる書き方のルールを切る（Prettier の整形を優先する）
  prettierConfig,
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      'prettier/prettier': 'error',
    },
  },
  globalIgnores([
    'node_modules/**',
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
