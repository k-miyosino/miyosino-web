/**
 * 運用ダッシュボードに出す定期タスク・秘密情報・リンクの定義（ops Worker から管理者にだけ返す）
 *
 * フロントエンドのコードに置かないのは、静的エクスポートの HTML や JS はだれでも読めるため。
 * 項目を足す・直すときはここを書き換えて PR を出す（OPS.md）。
 * 秘密情報の「値」は絶対に書かない。名前・置き場所・入れ替え手順だけを書く。
 */

const REPO_URL = 'https://github.com/k-miyosino/miyosino-web';

/** 周期: 月1・年1・期限日（その日までに1回）・きっかけがあったとき */
export type OpsCadence =
  | { type: 'monthly' }
  | { type: 'yearly' }
  | { type: 'deadline'; date: string } // YYYY-MM-DD（日本時間）
  | { type: 'event'; when: string };

export interface OpsLink {
  label: string;
  url: string;
}

export interface OpsTask {
  id: string;
  title: string;
  cadence: OpsCadence;
  steps: string[];
  links?: OpsLink[];
}

export type OpsSecretCategoryId =
  'login' | 'data' | 'chat' | 'form' | 'deploy' | 'personal' | 'public';

/** 登録先の1か所。url があれば、その設定画面へのリンクにする */
export interface OpsPlace {
  /** 場所の種類（画面ではこの単位でまとめる。例: Cloudflare Workers、GitHub Secrets） */
  place: string;
  label: string;
  url?: string;
}

export interface OpsSecretCategory {
  id: OpsSecretCategoryId;
  label: string;
  description: string;
}

export interface OpsSecret {
  id: string;
  category: OpsSecretCategoryId;
  name: string;
  /** 何に使っているか */
  purpose: string;
  /** 登録先: 入れ替えたあとに新しい値を設定し直す場所 */
  registeredIn: OpsPlace[];
  /** 発行元: 新しい値を作る場所 */
  issuer: { label: string; url?: string };
  /** 漏れたとき（または担当交代のとき）の入れ替え手順 */
  rotate: string[];
  /** 入れ替えたあとに起きること・やること */
  after?: string;
}

export interface OpsLinkGroup {
  title: string;
  links: OpsLink[];
}

export const OPS_TASKS: OpsTask[] = [
  {
    id: 'dependabot-prs',
    title: 'Dependabot の PR を確かめてマージする',
    cadence: { type: 'monthly' },
    steps: [
      '月はじめに Dependabot が develop 向けに更新の PR を作る',
      '1件ずつ型チェック・ビルドで確かめ、develop → staging → main の順にマージする',
      'メジャー更新で使えないものは閉じて .github/dependabot.yml の ignore に足す',
    ],
    links: [
      { label: 'Dependabot の PR', url: `${REPO_URL}/pulls/app%2Fdependabot` },
      { label: 'Dependabot alerts', url: `${REPO_URL}/security/dependabot` },
    ],
  },
  {
    id: 'usage-fees',
    title: '利用料を確かめる',
    cadence: { type: 'monthly' },
    steps: [
      'Anthropic コンソールでチャットの利用額を見る（目安は月 1,500 円前後）。spend limit が設定されているかも確かめる',
      'Google Cloud の請求で Places API（Sync Places が毎週使う）と Maps の利用額を見る',
      'Cloudflare で Workers と D1 の利用量が無料枠に収まっているかを見る',
    ],
    links: [
      { label: 'Anthropic コンソール', url: 'https://console.anthropic.com/' },
      { label: 'Google Cloud の請求', url: 'https://console.cloud.google.com/billing' },
      { label: 'Cloudflare', url: 'https://dash.cloudflare.com/' },
    ],
  },
  {
    id: 'scheduled-jobs',
    title: '自動実行が失敗していないか確かめる',
    cadence: { type: 'monthly' },
    steps: [
      'このページの「GitHub の状態」で Sync Places（毎週月曜 3:00）が成功しているかを見る',
      'Cloudflare でチャット Worker の定期実行（毎日 4:00、古いログの削除）にエラーがないかを見る',
    ],
    links: [
      { label: 'GitHub Actions', url: `${REPO_URL}/actions` },
      { label: 'Cloudflare Workers', url: 'https://dash.cloudflare.com/?to=/:account/workers-and-pages' },
    ],
  },
  {
    id: 'chat-review',
    title: 'チャットの質問ログと評価を見る',
    cadence: { type: 'monthly' },
    steps: [
      'このページの「チャット」で、「わからなかった」の質問と答えを見る',
      '答えが足りない質問は、ページの中身や案内文（_chat-knowledge.ts）を直す',
    ],
  },
  {
    id: 'domain-ssl',
    title: 'ドメインと SSL 証明書を確かめる',
    cadence: { type: 'yearly' },
    steps: [
      'k-miyosino.com の更新期限と自動更新の設定を確かめる',
      'さくらのコントロールパネルで、無料 SSL が自動で更新されているかを確かめる',
    ],
    links: [{ label: 'さくらのコントロールパネル', url: 'https://secure.sakura.ad.jp/rs/cp/' }],
  },
  {
    id: 'hazard-map',
    title: 'ハザードマップの記述を確かめる',
    cadence: { type: 'yearly' },
    steps: [
      '国土地理院「重ねるハザードマップ」で団地の想定が変わっていないかを見る',
      '変わっていたら src/components/features/HazardMapSection.tsx の記述と「○年○月時点」を直す',
    ],
    links: [{ label: '重ねるハザードマップ', url: 'https://disaportal.gsi.go.jp/' }],
  },
  {
    id: 'chat-model',
    title: 'チャットのモデルを確かめる',
    cadence: { type: 'yearly' },
    steps: [
      'workers/wrangler.chat.toml の CHAT_MODEL が廃止予定になっていないかを確かめる',
      '切り替えるときは npm run chat:eval で比べてから（CHATBOT.md）',
    ],
    links: [{ label: 'Claude のモデルの廃止予定', url: 'https://platform.claude.com/docs/en/about-claude/model-deprecations' }],
  },
  {
    id: 'compat-date',
    title: 'Workers の compatibility_date を上げる',
    cadence: { type: 'yearly' },
    steps: [
      '前回の日付以降に入った互換性フラグを Cloudflare のドキュメントで洗い出し、コードと照らし合わせる',
      '手元の wrangler dev で新旧の日付の応答を比べ、全 Worker を --dry-run でまとめてから PR にする',
    ],
    links: [
      { label: '互換性フラグの一覧', url: 'https://developers.cloudflare.com/workers/configuration/compatibility-flags/' },
    ],
  },
  {
    id: 'node-24-eol',
    title: 'Node.js 24 のサポートが切れる前に上げる',
    cadence: { type: 'deadline', date: '2028-04-30' },
    steps: [
      'GitHub Actions の node-version、Dockerfile、@types/node を次の LTS（26 など）に上げる',
      '.github/dependabot.yml の @types/node の ignore も見直す',
    ],
    links: [{ label: 'Node.js のリリース予定', url: 'https://nodejs.org/en/about/previous-releases' }],
  },
  {
    id: 'nextjs-16',
    title: 'Next.js 16 に移行する',
    // Next.js 15 は Maintenance LTS。セキュリティ修正は 2027-01-31 まで（2026-11 時点のサポート方針のページ）
    cadence: { type: 'deadline', date: '2027-01-31' },
    steps: [
      'Next.js 15 のセキュリティ修正が終わる（2027-01-31）前に移行する',
      '移行のときに ESLint 10・TypeScript 7 もまとめて上げ、.github/dependabot.yml の ignore を外す',
    ],
    links: [{ label: 'Next.js のサポート方針', url: 'https://nextjs.org/support-policy' }],
  },
  {
    id: 'handover',
    title: '担当が替わったら秘密情報とアカウントを引き継ぐ',
    cadence: { type: 'event', when: '役員・担当の交代のとき' },
    steps: [
      'このページの「秘密情報」を上から順に入れ替える',
      'GitHub・Cloudflare・Google Cloud・Anthropic・さくら・microCMS・ドメインの管理者を新しい担当に替える',
      'kintone の「システム管理」グループ（Administrators）のメンバーを替える（ダッシュボードを見られる人が替わる）',
    ],
  },
];

/** 秘密情報の種類（画面ではこの順に表を分ける） */
export const OPS_SECRET_CATEGORIES: OpsSecretCategory[] = [
  { id: 'login', label: 'ログイン', description: '組合員のログインに使うもの' },
  {
    id: 'data',
    label: 'データの読み込み',
    description: 'kintone・microCMS・Google からデータを読むためのもの',
  },
  {
    id: 'chat',
    label: 'チャット（AI）',
    description: 'サイト案内チャットに使うもの',
  },
  {
    id: 'form',
    label: 'お問い合わせフォーム',
    description: 'フォームのロボット対策に使うもの',
  },
  {
    id: 'deploy',
    label: 'デプロイ（公開の作業）',
    description: 'GitHub Actions がサイトや Worker を公開するときに使うもの',
  },
  {
    id: 'personal',
    label: '各自の PC で使うもの',
    description: '管理者が自分の PC の道具で使うもの',
  },
  {
    id: 'public',
    label: '公開してよいキー',
    description:
      'ブラウザに出る前提のキー。漏れても入れ替えは不要で、使える場所の制限がかかっているかを確かめる',
  },
];

// Cloudflare のアカウント（wrangler.*.toml の account_id と同じ）
const CLOUDFLARE_ACCOUNT_ID = 'e6544c934cee9bfb0cdfc5b155ce8aeb';

/** Cloudflare Workers の設定画面（変数とシークレット）へのリンク。name は Worker の名前（miyosino-… の後ろ） */
function worker(name: string, note?: string): OpsPlace {
  return {
    place: 'Cloudflare Workers',
    label: note ? `${name}（${note}）` : name,
    url: `https://dash.cloudflare.com/${CLOUDFLARE_ACCOUNT_ID}/workers/services/view/miyosino-${name}/production/settings`,
  };
}

/** GitHub の Actions の Secrets の画面へのリンク */
function githubSecret(name: string): OpsPlace {
  return {
    place: 'GitHub Secrets',
    label: name,
    url: `${REPO_URL}/settings/secrets/actions`,
  };
}

const JWT_WORKERS = [
  'auth',
  'announcements',
  'applications',
  'chat',
  'circulars',
  'events',
  'greenwellness',
  'minutes',
  'ops',
];

export const OPS_SECRETS: OpsSecret[] = [
  {
    id: 'jwt-secret',
    category: 'login',
    name: 'JWT_SECRET',
    purpose: 'ログインの印（トークン）に署名し、本物かを確かめる',
    registeredIn: JWT_WORKERS.map((name) => worker(name)),
    issuer: { label: '自分で作る（npm run generate-jwt-secret）' },
    rotate: [
      'workers/ で npm run generate-jwt-secret を実行して新しい値を作る',
      'npm run set-jwt-secret で、使っているすべての Worker にまとめて設定する',
    ],
    after: 'ログイン中の全員がログアウトされ、ログインし直しになる',
  },
  {
    id: 'kintone-client-secret',
    category: 'login',
    name: 'KINTONE_CLIENT_SECRET',
    purpose: 'kintone のアカウントでログインする（OAuth）',
    registeredIn: [worker('auth')],
    issuer: { label: 'cybozu.com 共通管理 → 外部連携 → OAuth クライアント' },
    rotate: [
      'cybozu.com 共通管理 → 外部連携 → OAuth クライアントで、クライアントシークレットを作り直す',
      'wrangler secret put KINTONE_CLIENT_SECRET --config wrangler.auth.toml で設定する',
    ],
    after: '入れ替えるまでの間はログインできない',
  },
  {
    id: 'kintone-api-tokens',
    category: 'data',
    name: 'kintone の API トークン（アプリごと）',
    purpose:
      '組合員専用ページのデータ（お知らせ・回覧板・議事録など）と、あゆみ・周辺施設を kintone から読む',
    registeredIn: [
      worker('announcements', 'KINTONE_API_TOKEN'),
      worker('greenwellness', 'KINTONE_API_TOKEN'),
      worker('applications', 'KINTONE_API_TOKEN_APPLICATIONS'),
      worker('circulars', 'KINTONE_API_TOKEN_CIRCULARS'),
      worker('events', 'KINTONE_API_TOKEN_EVENTS'),
      worker('history-api', 'KINTONE_API_TOKEN_HISTORY'),
      worker('minutes', 'KINTONE_API_TOKEN_MINUTES'),
      worker('places-api', 'KINTONE_API_TOKEN_PLACES'),
      githubSecret('KINTONE_API_TOKEN_PLACES（Sync Places）'),
    ],
    issuer: { label: 'kintone の各アプリの設定 → API トークン' },
    rotate: [
      '漏れたトークンのアプリで「アプリの設定 → API トークン」を開き、トークンを作り直して「アプリを更新」する',
      '対応する Worker に wrangler secret put で設定する（周辺施設は GitHub Secrets の KINTONE_API_TOKEN_PLACES も）',
    ],
  },
  {
    id: 'microcms-api-key',
    category: 'data',
    name: 'MICROCMS_API_KEY',
    purpose: 'お知らせ・トップの写真など、microCMS の中身を読む',
    registeredIn: [worker('contents-api')],
    issuer: { label: 'microCMS の API キー', url: 'https://app.microcms.io/' },
    rotate: [
      'microCMS の「API キー」で新しいキーを作る（読み取りだけの権限）',
      'wrangler secret put MICROCMS_API_KEY --config wrangler.contents.toml で設定し、古いキーを削除する',
    ],
  },
  {
    id: 'google-places-api-key',
    category: 'data',
    name: 'GOOGLE_PLACES_API_KEY',
    purpose: 'Sync Places が周辺施設の情報を Google から取ってくる',
    registeredIn: [githubSecret('GOOGLE_PLACES_API_KEY')],
    issuer: {
      label: 'Google Cloud の認証情報',
      url: 'https://console.cloud.google.com/apis/credentials',
    },
    rotate: [
      'Google Cloud の「認証情報」で新しいキーを作り、Places API だけに制限する',
      'GitHub Secrets を書き換え、Sync Places を手動で実行して確かめてから古いキーを削除する',
    ],
  },
  {
    id: 'anthropic-api-key',
    category: 'chat',
    name: 'ANTHROPIC_API_KEY',
    purpose: 'サイト案内チャットの答えを作る（Claude）',
    registeredIn: [worker('chat')],
    issuer: {
      label: 'Anthropic コンソール',
      url: 'https://console.anthropic.com/',
    },
    rotate: [
      'Anthropic コンソールで新しいキーを作る',
      'wrangler secret put ANTHROPIC_API_KEY --config wrangler.chat.toml で設定する',
      'コンソールで古いキーを削除する',
    ],
  },
  {
    id: 'turnstile-secret-key',
    category: 'form',
    name: 'TURNSTILE_SECRET_KEY',
    purpose: 'お問い合わせフォームがロボットからの送信でないかを確かめる',
    registeredIn: [worker('contact-api')],
    issuer: {
      label: 'Cloudflare の Turnstile',
      url: 'https://dash.cloudflare.com/',
    },
    rotate: [
      'Cloudflare の Turnstile でシークレットキーを入れ替える（Rotate secret key）',
      'wrangler secret put TURNSTILE_SECRET_KEY --config wrangler.contact.toml で設定する',
    ],
  },
  {
    id: 'cloudflare-api-token',
    category: 'deploy',
    name: 'CLOUDFLARE_API_TOKEN',
    purpose: 'GitHub Actions から Cloudflare Workers をデプロイする',
    registeredIn: [
      githubSecret('CLOUDFLARE_API_TOKEN'),
      { place: '各自の PC', label: 'workers/.dev.vars（ある場合）' },
    ],
    issuer: {
      label: 'Cloudflare → My Profile → API Tokens',
      url: 'https://dash.cloudflare.com/profile/api-tokens',
    },
    rotate: [
      'Cloudflare → My Profile → API Tokens で「GitHub Actions - miyosino-web」を Roll する',
      'GitHub の Settings → Secrets and variables → Actions で CLOUDFLARE_API_TOKEN を書き換える',
    ],
  },
  {
    id: 'sakura-ssh-key',
    category: 'deploy',
    name: 'SAKURA_SSH_KEY',
    purpose: 'さくらのサーバーにサイトのファイルを送る（/v2 のテスト、本番）',
    registeredIn: [
      githubSecret('SAKURA_SSH_KEY'),
      { place: 'さくらのサーバー', label: '~/.ssh/authorized_keys（公開鍵）' },
    ],
    issuer: { label: '自分で作る（ssh-keygen）' },
    rotate: [
      '新しい鍵の組を作り、公開鍵をさくらの ~/.ssh/authorized_keys に足す',
      'GitHub Secrets の SAKURA_SSH_KEY を新しい秘密鍵に書き換え、Deploy v2 Test で確かめる',
      'authorized_keys から古い公開鍵を消す',
    ],
  },
  {
    id: 'microcms-mcp-key',
    category: 'personal',
    name: 'microCMS の MCP 用キー',
    purpose: 'Claude から microCMS の中身を編集する',
    registeredIn: [
      {
        place: '各自の PC',
        label: 'MCP の設定（.mcp.json で参照する環境変数）',
      },
    ],
    issuer: { label: 'microCMS の API キー', url: 'https://app.microcms.io/' },
    rotate: [
      'microCMS の「API キー」で漏れたキーを削除し、新しいキーを作る',
      '使っている人の PC の環境変数を書き換える（MICROCMS_MCP.md）',
    ],
  },
  {
    id: 'google-maps-api-key',
    category: 'public',
    name: 'Google Maps の API キー（NEXT_PUBLIC_GOOGLE_MAPS_API_KEY）',
    purpose: 'アクセスページの地図を表示する',
    registeredIn: [
      {
        place: 'フロントエンドの環境変数',
        label: '.env.local、ビルドの環境',
      },
    ],
    issuer: {
      label: 'Google Cloud の認証情報',
      url: 'https://console.cloud.google.com/apis/credentials',
    },
    rotate: [
      'ブラウザに出る前提のキー。漏れたというより、HTTP リファラーの制限（k-miyosino.com・github.io）がかかっているかを確かめる',
      '入れ替えるときは Google Cloud で新しいキーを作って制限をかけ、環境変数を書き換えて再ビルドする',
    ],
  },
];

export function buildLinkGroups(kintoneDomain?: string): OpsLinkGroup[] {
  return [
    {
      title: 'アクセス解析',
      links: [
        { label: 'Google Analytics', url: 'https://analytics.google.com/' },
        { label: 'Looker Studio', url: 'https://lookerstudio.google.com/' },
        { label: 'Google Search Console', url: 'https://search.google.com/search-console' },
      ],
    },
    {
      title: 'サーバー・サービス',
      links: [
        { label: 'Cloudflare', url: 'https://dash.cloudflare.com/' },
        { label: 'Anthropic コンソール', url: 'https://console.anthropic.com/' },
        { label: 'Google Cloud', url: 'https://console.cloud.google.com/' },
        { label: 'さくらのコントロールパネル', url: 'https://secure.sakura.ad.jp/rs/cp/' },
        { label: 'microCMS', url: 'https://app.microcms.io/' },
        ...(kintoneDomain
          ? [{ label: 'kintone', url: `https://${kintoneDomain}/k/` }]
          : []),
      ],
    },
    {
      title: 'GitHub',
      links: [
        { label: 'リポジトリ', url: REPO_URL },
        { label: 'Actions', url: `${REPO_URL}/actions` },
        { label: 'Pull requests', url: `${REPO_URL}/pulls` },
        { label: 'Dependabot alerts', url: `${REPO_URL}/security/dependabot` },
        { label: 'Settings', url: `${REPO_URL}/settings` },
      ],
    },
  ];
}
