---
description: Miyoshino プロジェクトのアーキテクチャコンテキストを読み込んでからタスクを実行する
---

# Miyoshino Project Architect

You are working on **かわつる三芳野団地** (Miyoshino), a Next.js community website for a housing cooperative. Before proceeding with any task, internalize the architecture below completely.

---

## Architecture Overview

**Three-tier stack:**
- Frontend: Next.js 15 + App Router + TypeScript + Tailwind CSS — static export in production (`output: 'export'`), base path `/miyosino-web` on GitHub Pages, no base path locally
- Backend: 13 Cloudflare Workers, each in `/app/workers/api/<name>.ts`, each with its own `/app/workers/wrangler.<name>.toml`
- Data: **Kintone** (member-only CMS, accessed only via Workers with JWT auth) and **MicroCMS** (public content, accessed only via the `contents` Worker)

**Workers inventory** (`cd workers` before any wrangler command):

| Worker config | Purpose | Auth required |
|---|---|---|
| `wrangler.auth.toml` | Kintone OAuth 2.0 flow, issues JWT | No |
| `wrangler.announcements.toml` | お知らせ (Kintone) | JWT |
| `wrangler.circulars.toml` | 配布資料 (Kintone) | JWT |
| `wrangler.minutes.toml` | 会議情報 (Kintone) | JWT |
| `wrangler.events.toml` | イベント (Kintone) | JWT |
| `wrangler.applications.toml` | 申請書 (Kintone) | JWT |
| `wrangler.greenwellness.toml` | グリーンウェルネス (Kintone) | JWT |
| `wrangler.history.toml` | あゆみ (Kintone) | No |
| `wrangler.contents.toml` | MicroCMS proxy (public content) | No |
| `wrangler.contact.toml` | Contact form → Kintone | No |
| `wrangler.places.toml` | Google Places proxy → Kintone | No |
| `wrangler.toml` | Photos (MicroCMS) | No |

---

## Auth Flow (Critical)

1. User visits a member page → `MemberAuthWrapper` checks `localStorage.getItem('auth_token')`
2. No token → `redirectToLogin()` sends user to `miyosino-auth` Worker's `/login` endpoint
3. Worker completes Kintone OAuth 2.0, issues a signed JWT (HS256, `JWT_SECRET`)
4. JWT is appended to the redirect URL as `?token=...`; `handleAuthCallback()` saves it to `localStorage` under key `auth_token` and strips it from the URL
5. Every subsequent Kintone API call sends `Authorization: Bearer <token>`
6. Each Worker verifies the JWT with the shared `JWT_SECRET` before touching Kintone

**Key constraint:** `JWT_SECRET` must be identical across ALL workers. To propagate a new secret run:
```bash
cd workers && npm run set-jwt-secret
```
Adding a new Kintone worker means also adding it to `/app/workers/scripts/set-jwt-secret.sh`.

---

## Adding a New Kintone API — Canonical Checklist

Follow `/app/ADD_NEW_KINTONE_API.md` as the authoritative guide. Key steps:

### 1. Worker (`workers/api/<name>.ts`)
- Copy pattern from `workers/api/circulars.ts` (has file download) or `workers/api/announcements.ts` (no file download)
- Define `Env` interface with `KINTONE_DOMAIN`, `KINTONE_API_TOKEN_<NAME>`, `JWT_SECRET`
- Kintone app ID is hard-coded as a constant inside the worker (not an env var)
- Use shared helpers from `workers/api/_kintone.ts`: `corsHeaders()` and `fetchAllKintoneRecords()`
- **Gotcha:** Radio button fields cannot use `=` in Kintone query strings — fetch all records, then `filter()` in JS (see `workers/api/applications.ts`)
- JWT verification is copy-paste identical across all workers (no shared import — Workers are isolated)

### 2. Wrangler config (`workers/wrangler.<name>.toml`)
- Copy `workers/wrangler.circulars.toml`
- Change `name = "miyosino-<name>"` and `main = "api/<name>.ts"`
- `account_id` is always `e6544c934cee9bfb0cdfc5b155ce8aeb`

### 3. Repository (`src/repositories/kintone/<name>Repository.ts`)
- Copy pattern from `src/repositories/kintone/circularRepository.ts`
- Endpoint: `process.env.NEXT_PUBLIC_<NAME>_API_URL || 'https://miyosino-<name>.anorimura-miyosino.workers.dev'`
- Call `getToken()` from `@/shared/utils/auth`; call `handleUnauthorized()` from `./utils` on 401
- Parse errors via `parseKintoneError()` from `./utils`

### 4. File download support (only if the worker has a `/file` endpoint)
- Add the new key to `FileDownloadEndpoint` union type in `src/shared/utils/fileDownload.ts`
- Add the matching `case` in `getApiEndpoint()`

### 5. Type definition (`src/types/<name>.ts`)
- Define the domain type separately from the raw Kintone record shape

### 6. UI component (`src/components/member/<Name>Content.tsx`)
- `'use client'` directive required — all auth logic is client-side
- Pattern: `useEffect` loads data, handles auth redirect on 401, sets error state otherwise
- Wrap page in `MemberAuthWrapper` in `src/app/member/<name>/page.tsx`
- Export from `src/components/member/index.ts`

### 7. Workers scripts
- Add `"dev:<name>"` and `"deploy:<name>"` scripts to `workers/package.json`
- Add `"wrangler.<name>.toml"` to the `WORKERS` array in `workers/scripts/set-jwt-secret.sh`
- Run `npm run set-jwt-secret` after deploying

### 8. Documentation
- Update `workers/.dev.vars.example` with `KINTONE_API_TOKEN_<NAME>`
- Update `README.md` and `UPDATE_ENV_VARS.md`

---

## Adding a Public (MicroCMS) Page

Public content does NOT use Kintone or JWT:
- `src/repositories/microcms/contentRepository.ts` → calls `NEXT_PUBLIC_CONTENTS_API_ENDPOINT` (the `contents` Worker)
- The `contents` Worker holds `MICROCMS_API_KEY` and proxies MicroCMS
- No `MemberAuthWrapper` needed; page can be a Server Component

---

## Frontend Page Patterns

**Member (auth-gated) page structure:**
```
src/app/member/<name>/page.tsx              ← 'use client', wraps with MemberAuthWrapper
src/components/member/<Name>Content.tsx     ← 'use client', fetches data, handles errors
src/repositories/kintone/<name>Repository.ts
src/types/<name>.ts
```

**Public page structure:**
```
src/app/<section>/page.tsx
src/components/<section>/<Name>.tsx
src/repositories/microcms/contentRepository.ts
```

**Base path:** Never hard-code `/` for internal links. Use Next.js `<Link>` and `next/image`. For logout/redirect, check `window.location.hostname.includes('github.io')` to detect GitHub Pages (see `src/shared/utils/auth.ts`). `getToken()` returns `null` server-side (SSR guard: `typeof window === 'undefined'`).

---

## Deployment Reference

```bash
# Deploy a single worker
cd workers
npx wrangler deploy --config wrangler.<name>.toml

# Set secrets individually
npx wrangler secret put KINTONE_DOMAIN --config wrangler.<name>.toml
npx wrangler secret put KINTONE_API_TOKEN_<NAME> --config wrangler.<name>.toml
npx wrangler secret put JWT_SECRET --config wrangler.<name>.toml

# Propagate JWT_SECRET to ALL workers at once (reads from workers/.dev.vars)
npm run set-jwt-secret

# Check secrets on a deployed worker
npx wrangler secret list --config wrangler.<name>.toml

# Local development
npx wrangler dev --config wrangler.<name>.toml   # single worker
npm run dev                                        # Next.js frontend (from /app)

# Sync Google Places data to Kintone
npm run sync:places   # run from /app root
```

---

## Debugging Auth Issues

1. **401 everywhere after deploy:** `JWT_SECRET` mismatch — run `npm run set-jwt-secret` from `workers/`
2. **Token not persisting:** Check `localStorage.getItem('auth_token')` in browser console; `getToken()` returns `null` server-side
3. **Redirect loop after login:** `handleAuthCallback()` in `MemberAuthWrapper` should have saved the token from `?token=...`; check that `window.history.replaceState` cleaned it up
4. **Kintone OAuth error:** Verify `KINTONE_CLIENT_ID`, `KINTONE_CLIENT_SECRET`, and `KINTONE_DOMAIN` on the `auth` worker (`wrangler secret list --config wrangler.auth.toml`)
5. **Radio button field filter fails:** Do NOT use `=` in Kintone query string for radio fields — fetch all and filter in JS instead

---

## Key File Reference

| What | Where |
|---|---|
| Auth utilities (token, redirect, logout) | `src/shared/utils/auth.ts` |
| File download utility | `src/shared/utils/fileDownload.ts` |
| Worker shared helpers (corsHeaders, fetchAll) | `workers/api/_kintone.ts` |
| Kintone repository error utils | `src/repositories/kintone/utils.ts` |
| Auth wrapper component | `src/components/member/MemberAuthWrapper.tsx` |
| Reference worker (with file download) | `workers/api/circulars.ts` |
| Reference repository | `src/repositories/kintone/circularRepository.ts` |
| Reference UI component | `src/components/member/CircularsContent.tsx` |
| Full Kintone API addition guide | `ADD_NEW_KINTONE_API.md` |
| Env var + deploy guide | `UPDATE_ENV_VARS.md` |
| JWT secret propagation script | `workers/scripts/set-jwt-secret.sh` |
| Next.js config (basePath, static export) | `next.config.ts` |

---

Now that you have the full architectural context, proceed with the user's requested task. Follow all established patterns above. When in doubt, read the reference files before inventing a new pattern.
