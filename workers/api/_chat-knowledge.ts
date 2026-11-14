/**
 * チャットボットが読む「公開ページの中身」
 *
 * - 読むのは、sitePages.ts で公開（public）のページだけ。組合員専用（member）のページは読まない
 *   （組合員向けの情報を Anthropic 社に送ることについて、承認を得ていないため。読むページを足すときは承認を得ること）
 * - ページの文章は、公開しているサイトの HTML の <main> の中から取り出す
 * - 画面が表示されてから読み込む中身（microCMS、周辺施設、団地のあゆみ）は、それぞれの Worker から取る
 * - 取った中身は、この Worker の中に1時間覚えておく
 *
 * 取り方（fetch）は呼び出し側が渡す。Worker はサービスバインディング、評価スクリプトは公開の URL を使う。
 */

import {
  PUBLIC_SITE_PAGES,
  SitePageExtraContent,
  findSitePage,
} from '../../src/shared/constants/sitePages';

export interface KnowledgeFetchers {
  /** 公開サイトのページ（path は「/features」など。ホームは「/」） */
  sitePage(path: string): Promise<Response>;
  /** microCMS（contents Worker）。query は category などの引数 */
  contents(query: URLSearchParams): Promise<Response>;
  /** 周辺施設（places Worker） */
  places(): Promise<Response>;
  /** 団地のあゆみ（history Worker） */
  history(): Promise<Response>;
}

/** 中身を読んでよいページのパス（道具の選択肢になる） */
export const READABLE_PAGE_PATHS: readonly string[] = PUBLIC_SITE_PAGES.map(
  (page) => page.path
);

const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_PAGE_TEXT = 12000;
const MAX_EXTRA_TEXT = 8000;
const MAX_ITEM_BODY = 600;
const MAX_PLACES = 80;

const cache = new Map<string, { value: string; expires: number }>();

async function cached(key: string, load: () => Promise<string>): Promise<string> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await load();
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

// ---- HTML から文字を取り出す（正規表現を使わず、前から順に見る） ----

const SKIP_TAGS = new Set(['script', 'style', 'svg', 'noscript', 'template', 'iframe', 'head']);
const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'br', 'tr', 'table', 'header', 'footer', 'nav', 'dd', 'dt', 'dl', 'figure',
  'figcaption', 'blockquote', 'hr', 'main', 'aside', 'form', 'label', 'button',
]);
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'",
};

function tagName(tag: string): string {
  let i = tag.startsWith('/') ? 1 : 0;
  let name = '';
  while (i < tag.length && /[A-Za-z0-9]/.test(tag[i])) name += tag[i++];
  return name.toLowerCase();
}

function decodeEntities(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const amp = text.indexOf('&', i);
    if (amp === -1) break;
    const semi = text.indexOf(';', amp);
    if (semi === -1 || semi - amp > 10) {
      out += text.slice(i, amp + 1);
      i = amp + 1;
      continue;
    }
    const entity = text.slice(amp + 1, semi);
    let decoded = NAMED_ENTITIES[entity];
    if (decoded === undefined && entity.startsWith('#')) {
      const code = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      if (Number.isFinite(code) && code > 0 && code < 0x110000) decoded = String.fromCodePoint(code);
    }
    out += text.slice(i, amp) + (decoded ?? text.slice(amp, semi + 1));
    i = semi + 1;
  }
  return out + text.slice(i);
}

// 画面が表示されてから中身を読み込む所に、HTML では出ている文字（意味がないので消す）
const PLACEHOLDER_LINES = new Set(['読み込み中...', '読み込み中…']);

// 行ごとに空白をまとめ、空行と読み込み中の表示を詰める
function tidyLines(text: string): string {
  const lines: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.split(/[ \t\u00a0\r]+/).filter(Boolean).join(' ');
    if (line && !PLACEHOLDER_LINES.has(line)) lines.push(line);
  }
  return lines.join('\n');
}

/** HTML から文字を取り出す。<main> があればその中だけを使う */
export function htmlToText(html: string): string {
  let source = html;
  const mainStart = source.indexOf('<main');
  const mainEnd = source.lastIndexOf('</main>');
  if (mainStart !== -1 && mainEnd > mainStart) {
    source = source.slice(source.indexOf('>', mainStart) + 1, mainEnd);
  }
  let out = '';
  let i = 0;
  while (i < source.length) {
    const lt = source.indexOf('<', i);
    if (lt === -1) {
      out += source.slice(i);
      break;
    }
    out += source.slice(i, lt);
    if (source.startsWith('<!--', lt)) {
      const end = source.indexOf('-->', lt + 4);
      i = end === -1 ? source.length : end + 3;
      continue;
    }
    const gt = source.indexOf('>', lt);
    if (gt === -1) break;
    const tag = source.slice(lt + 1, gt);
    const name = tagName(tag);
    i = gt + 1;
    if (!tag.startsWith('/') && !tag.endsWith('/') && SKIP_TAGS.has(name)) {
      const close = source.indexOf(`</${name}`, i);
      i = close === -1 ? source.length : source.indexOf('>', close) + 1 || source.length;
      continue;
    }
    out += BLOCK_TAGS.has(name) ? '\n' : ' ';
  }
  return tidyLines(decodeEntities(out));
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…（以下省略）` : text;
}

// ---- HTML 以外の中身 ----

const MICROCMS_LABELS: Readonly<Record<string, string>> = {
  'community-activities': '自治会活動',
  'community-circle-sports': '住民サークル（スポーツ・運動）',
  'community-circle-culture': '住民サークル（文化活動）',
  facility: '共用施設',
  service: 'サービス',
  season: '団地の四季',
};

interface MicroCMSItem {
  title?: string;
  name?: string;
  description?: string;
  body?: string;
  category?: Array<{ id?: string }>;
}

async function microcmsText(category: string, fetchers: KnowledgeFetchers): Promise<string> {
  const query = new URLSearchParams({ category, orders: 'order', getAll: 'true' });
  const response = await fetchers.contents(query);
  if (!response.ok) throw new Error(`contents ${response.status}`);
  const data = (await response.json()) as { contents?: MicroCMSItem[] };
  const items = (data.contents ?? []).filter(
    (item) => Array.isArray(item.category) && item.category.some((c) => c?.id === category)
  );
  if (items.length === 0) return '（掲載なし）';
  return items
    .map((item) => {
      const title = item.title ?? item.name ?? '';
      const parts = [item.description, item.body ? htmlToText(item.body) : '']
        .filter(Boolean)
        .join(' ');
      return `- ${title}: ${truncate(parts.replace(/\n/g, ' '), MAX_ITEM_BODY)}`;
    })
    .join('\n');
}

function formatDistance(metres: number): string {
  if (!Number.isFinite(metres)) return '';
  return metres < 1000 ? `約${Math.round(metres)}m` : `約${(metres / 1000).toFixed(1)}km`;
}

async function placesText(fetchers: KnowledgeFetchers): Promise<string> {
  const response = await fetchers.places();
  if (!response.ok) throw new Error(`places ${response.status}`);
  const data = (await response.json()) as {
    places?: Array<{ nameJa?: string; category?: string; distance?: number; address?: string; phone?: string }>;
  };
  const places = data.places ?? [];
  if (places.length === 0) return '（掲載なし）';
  const lines = places.slice(0, MAX_PLACES).map((p) => {
    const info = [p.category, formatDistance(Number(p.distance))].filter(Boolean).join('、');
    const contact = [p.address, p.phone].filter(Boolean).join(' ');
    return `- ${p.nameJa ?? ''}（${info}）${contact ? ` ${contact}` : ''}`;
  });
  if (places.length > MAX_PLACES) lines.push(`ほかに${places.length - MAX_PLACES}件（団地から遠い順に省略）`);
  return lines.join('\n');
}

async function historyText(fetchers: KnowledgeFetchers): Promise<string> {
  const response = await fetchers.history();
  if (!response.ok) throw new Error(`history ${response.status}`);
  const data = (await response.json()) as {
    events?: Array<{ year?: string; type?: string; event?: string; description?: string }>;
  };
  const events = data.events ?? [];
  if (events.length === 0) return '（掲載なし）';
  return events
    .map((e) => {
      const type = e.type ? `（${e.type}）` : '';
      const description = e.description ? ` ${truncate(e.description.replace(/\n/g, ' '), MAX_ITEM_BODY)}` : '';
      return `- ${e.year ?? ''}: ${e.event ?? ''}${type}${description}`;
    })
    .join('\n');
}

function extraLabel(extra: SitePageExtraContent): string {
  if (extra === 'places') return '周辺施設（団地から近い順）';
  if (extra === 'history') return '団地のあゆみ';
  return MICROCMS_LABELS[extra.slice('microcms:'.length)] ?? extra;
}

function loadExtra(extra: SitePageExtraContent, fetchers: KnowledgeFetchers): Promise<string> {
  if (extra === 'places') return placesText(fetchers);
  if (extra === 'history') return historyText(fetchers);
  return microcmsText(extra.slice('microcms:'.length), fetchers);
}

// 取れなかった中身は、その旨を書いて続ける（ほかの中身は答えに使えるように）
async function section(label: string, key: string, load: () => Promise<string>, max: number): Promise<string> {
  try {
    return `## ${label}\n${truncate(await cached(key, load), max)}`;
  } catch (error) {
    console.error(`[Chat] Failed to load ${key}:`, error);
    return `## ${label}\n（いまは取得できませんでした）`;
  }
}

/**
 * 公開ページの中身を、チャットの道具の結果として返す文章にする。
 * 公開でないページや一覧にないパスは読まず、エラーにする。
 */
export async function getPageContent(path: string, fetchers: KnowledgeFetchers): Promise<string> {
  const page = findSitePage(path);
  if (!page || page.visibility !== 'public') {
    throw new Error(`読めないページです: ${path}（公開ページだけを読めます）`);
  }
  const sections = await Promise.all([
    section('ページの文章', `page:${page.path}`, async () => {
      const response = await fetchers.sitePage(page.path);
      if (!response.ok) throw new Error(`site ${response.status}`);
      return htmlToText(await response.text());
    }, MAX_PAGE_TEXT),
    ...(page.extraContent ?? []).map((extra) =>
      section(extraLabel(extra), extra, () => loadExtra(extra, fetchers), MAX_EXTRA_TEXT)
    ),
  ]);
  return [`# ${page.names[0]}（${page.path}）`, ...sections].join('\n\n');
}

function trimTrailingSlash(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') end--;
  return url.slice(0, end);
}

/** Worker から使う取り方（サービスバインディングと公開サイトの URL） */
export function createWorkerFetchers(env: {
  SITE_URL?: string;
  CONTENTS?: Fetcher;
  PLACES?: Fetcher;
  HISTORY?: Fetcher;
}): KnowledgeFetchers {
  const siteUrl = trimTrailingSlash(env.SITE_URL ?? '');
  const missing = (name: string) => Promise.reject(new Error(`${name} が設定されていません`));
  return {
    sitePage: (path) =>
      siteUrl ? fetch(`${siteUrl}${path === '/' ? '/' : `${path}/`}`) : missing('SITE_URL'),
    contents: (query) =>
      env.CONTENTS ? env.CONTENTS.fetch(`https://contents/?${query.toString()}`) : missing('CONTENTS'),
    places: () => (env.PLACES ? env.PLACES.fetch('https://places/') : missing('PLACES')),
    history: () => (env.HISTORY ? env.HISTORY.fetch('https://history/') : missing('HISTORY')),
  };
}
