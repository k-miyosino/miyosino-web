import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnvLocal(): void {
  const envLocalPath = resolve(process.cwd(), '.env.local');
  if (existsSync(envLocalPath)) {
    for (const line of readFileSync(envLocalPath, 'utf-8').split('\n')) {
      const match = line.match(/^([^#\s][^=]*)=(.*)/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim().replace(/^["'](.*)["']$/, '$1');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

export function requireEnv(key: string): string {
  const val = process.env[key] ?? '';
  if (!val) {
    console.error(`${key} が設定されていません`);
    process.exit(1);
  }
  return val;
}
