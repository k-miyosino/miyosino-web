/**
 * 組合員専用ページの役割ごとの Worker（office・koho など）で共通の、CORS の設定と JSON の応答。
 * 個人情報を含みうるので、応答はキャッシュさせない。
 */

// CORS とログイン後の画面として許可するオリジン（auth.ts と同じ）
export const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://k-miyosino.github.io',
  'https://k-miyosino.com',
  'https://www.k-miyosino.com',
];

export function corsHeaders(
  origin: string | undefined,
  methods = 'GET, OPTIONS'
): Record<string, string> {
  return {
    'Access-Control-Allow-Origin':
      origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[1],
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function jsonResponse(
  body: unknown,
  status: number,
  origin: string | undefined,
  methods = 'GET, OPTIONS'
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin, methods),
    },
  });
}
