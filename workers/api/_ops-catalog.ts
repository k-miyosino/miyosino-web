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

export interface OpsSecret {
  id: string;
  name: string;
  /** どこに保存してあるか */
  location: string;
  /** どこで使っているか */
  usedBy: string;
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
    id: 'node-22-eol',
    title: 'Node.js 22 のサポートが切れる前に上げる',
    cadence: { type: 'deadline', date: '2027-04-30' },
    steps: [
      'GitHub Actions の node-version、Dockerfile、@types/node を次の LTS（24 など）に上げる',
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

const ALL_JWT_WORKERS =
  'miyosino-auth・announcements・applications・chat・circulars・events・greenwellness・minutes・ops';

export const OPS_SECRETS: OpsSecret[] = [
  {
    id: 'jwt-secret',
    name: 'JWT_SECRET',
    location: 'Cloudflare Workers の secrets',
    usedBy: `ログインの署名と確認（${ALL_JWT_WORKERS}）`,
    rotate: [
      'workers/ で npm run generate-jwt-secret を実行して新しい値を作る',
      'npm run set-jwt-secret で、使っているすべての Worker にまとめて設定する',
    ],
    after: 'ログイン中の全員がログアウトされ、ログインし直しになる',
  },
  {
    id: 'anthropic-api-key',
    name: 'ANTHROPIC_API_KEY',
    location: 'Cloudflare Workers の secrets（miyosino-chat）',
    usedBy: 'サイト案内チャット',
    rotate: [
      'Anthropic コンソールで新しいキーを作る',
      'wrangler secret put ANTHROPIC_API_KEY --config wrangler.chat.toml で設定する',
      'コンソールで古いキーを削除する',
    ],
  },
  {
    id: 'kintone-client-secret',
    name: 'KINTONE_CLIENT_SECRET',
    location: 'Cloudflare Workers の secrets（miyosino-auth）',
    usedBy: 'kintone での OAuth ログイン',
    rotate: [
      'cybozu.com 共通管理 → 外部連携 → OAuth クライアントで、クライアントシークレットを作り直す',
      'wrangler secret put KINTONE_CLIENT_SECRET --config wrangler.auth.toml で設定する',
    ],
    after: '入れ替えるまでの間はログインできない',
  },
  {
    id: 'kintone-api-tokens',
    name: 'kintone の API トークン（アプリごと）',
    location:
      'Cloudflare Workers の secrets（KINTONE_API_TOKEN: announcements・greenwellness／KINTONE_API_TOKEN_APPLICATIONS・_CIRCULARS・_EVENTS・_HISTORY・_MINUTES・_PLACES: 名前の Worker）、GitHub Secrets（KINTONE_API_TOKEN_PLACES）',
    usedBy: '組合員専用ページのデータ、あゆみ・周辺施設、Sync Places',
    rotate: [
      '漏れたトークンのアプリで「アプリの設定 → API トークン」を開き、トークンを作り直して「アプリを更新」する',
      '対応する Worker に wrangler secret put で設定する（周辺施設は GitHub Secrets の KINTONE_API_TOKEN_PLACES も）',
    ],
  },
  {
    id: 'microcms-api-key',
    name: 'MICROCMS_API_KEY',
    location: 'Cloudflare Workers の secrets（miyosino-contents-api）',
    usedBy: 'お知らせ・トップの写真など microCMS の中身',
    rotate: [
      'microCMS の「API キー」で新しいキーを作る（読み取りだけの権限）',
      'wrangler secret put MICROCMS_API_KEY --config wrangler.contents.toml で設定し、古いキーを削除する',
    ],
  },
  {
    id: 'microcms-mcp-key',
    name: 'microCMS の MCP 用キー',
    location: '各自の PC の MCP の設定（.mcp.json で参照する環境変数）',
    usedBy: 'Claude から microCMS の中身を編集する',
    rotate: [
      'microCMS の「API キー」で漏れたキーを削除し、新しいキーを作る',
      '使っている人の PC の環境変数を書き換える（MICROCMS_MCP.md）',
    ],
  },
  {
    id: 'turnstile-secret-key',
    name: 'TURNSTILE_SECRET_KEY',
    location: 'Cloudflare Workers の secrets（miyosino-contact-api）',
    usedBy: 'お問い合わせフォームのロボット対策',
    rotate: [
      'Cloudflare の Turnstile でシークレットキーを入れ替える（Rotate secret key）',
      'wrangler secret put TURNSTILE_SECRET_KEY --config wrangler.contact.toml で設定する',
    ],
  },
  {
    id: 'cloudflare-api-token',
    name: 'CLOUDFLARE_API_TOKEN',
    location: 'GitHub Secrets（各自の workers/.dev.vars にもある場合がある）',
    usedBy: 'GitHub Actions からの Workers のデプロイ',
    rotate: [
      'Cloudflare → My Profile → API Tokens で「GitHub Actions - miyosino-web」を Roll する',
      'GitHub の Settings → Secrets and variables → Actions で CLOUDFLARE_API_TOKEN を書き換える',
    ],
  },
  {
    id: 'sakura-ssh-key',
    name: 'SAKURA_SSH_KEY',
    location: 'GitHub Secrets',
    usedBy: 'さくらへのデプロイ（/v2 のテスト、本番）',
    rotate: [
      '新しい鍵の組を作り、公開鍵をさくらの ~/.ssh/authorized_keys に足す',
      'GitHub Secrets の SAKURA_SSH_KEY を新しい秘密鍵に書き換え、Deploy v2 Test で確かめる',
      'authorized_keys から古い公開鍵を消す',
    ],
  },
  {
    id: 'google-places-api-key',
    name: 'GOOGLE_PLACES_API_KEY',
    location: 'GitHub Secrets',
    usedBy: 'Sync Places（周辺施設の取得）',
    rotate: [
      'Google Cloud の「認証情報」で新しいキーを作り、Places API だけに制限する',
      'GitHub Secrets を書き換え、Sync Places を手動で実行して確かめてから古いキーを削除する',
    ],
  },
  {
    id: 'google-maps-api-key',
    name: 'Google Maps の API キー（NEXT_PUBLIC_GOOGLE_MAPS_API_KEY）',
    location: 'フロントエンドの環境変数（.env.local、ビルドの環境）',
    usedBy: 'アクセスページの地図',
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
