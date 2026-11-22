/** 運用ダッシュボード（/member/ops）で ops Worker から受け取るデータ（workers/api/ops.ts と合わせる） */

export type OpsCadence =
  | { type: 'monthly' }
  | { type: 'yearly' }
  | { type: 'deadline'; date: string }
  | { type: 'event'; when: string };

export type OpsTaskStatus = 'overdue' | 'soon' | 'ok' | 'done' | 'event';

export interface OpsLink {
  label: string;
  url: string;
}

export interface OpsHistoryEntry {
  done_at: string; // 日本時間 'YYYY-MM-DD HH:MM'
  done_by: string;
  note: string;
}

export interface OpsTask {
  id: string;
  title: string;
  cadence: OpsCadence;
  steps: string[];
  links?: OpsLink[];
  dueDate: string | null;
  status: OpsTaskStatus;
  history: OpsHistoryEntry[];
}

export interface OpsSecret {
  id: string;
  name: string;
  /** 種類（OpsSecretCategory の id） */
  category?: string;
  /** 何に使っているか */
  purpose?: string;
  /** 登録先: 入れ替えたあとに新しい値を設定し直す場所 */
  registeredIn?: (string | OpsPlace)[];
  /** 発行元: 新しい値を作る場所 */
  issuer?: { label: string; url?: string };
  /** 古い ops Worker の形（main にデプロイされるまでの間、staging で受け取ることがある） */
  location?: string;
  usedBy?: string;
  rotate: string[];
  after?: string;
  history: OpsHistoryEntry[];
}

/** 登録先の1か所。url があれば、その設定画面へのリンクにする */
export interface OpsPlace {
  place: string;
  label: string;
  url?: string;
}

export interface OpsSecretCategory {
  id: string;
  label: string;
  description: string;
}

export interface OpsLinkGroup {
  title: string;
  links: OpsLink[];
}

export interface OpsOverview {
  today: string;
  tasks: OpsTask[];
  secrets: OpsSecret[];
  /** 古い ops Worker は返さない */
  secretCategories?: OpsSecretCategory[];
  linkGroups: OpsLinkGroup[];
  lookerStudioEmbedUrl: string | null;
}

export interface OpsChatLog {
  at: string;
  page: string;
  question: string;
  answer: string;
  outcome: string;
}

export interface OpsChatSummary {
  available: boolean;
  settings?: {
    enabled: boolean;
    logging: boolean;
    feedback: boolean;
    retentionDays: number;
    limitPerUser: number;
    limitTotal: number;
  };
  daily?: { date: string; count: number }[];
  estimate?: { yenPerRequest: number; weekCount: number; monthlyYen: number };
  month?: {
    from: string;
    loggedCount: number;
    inputTokens: number;
    outputTokens: number;
  };
  logs?: OpsChatLog[];
  ratings?: Partial<Record<'understood' | 'partly' | 'not', number>>;
  /** 評価ごとの質問と答え（古い ops Worker は返さない） */
  feedback?: OpsChatFeedback[];
  /** 見直しの一覧（古い ops Worker は返さない。記録の表が無いときなどは error） */
  review?: OpsChatReview | { error: string };
  notUnderstood?: {
    at: string;
    page: string;
    question: string | null;
    answer: string | null;
  }[];
}

export type OpsChatRating = 'understood' | 'partly' | 'not';

export interface OpsChatFeedback {
  rating: OpsChatRating;
  at: string;
  page: string;
  question: string | null;
  answer: string | null;
}

/** Worker ごとのリクエスト数とエラー数（workers/api/_worker-errors.ts と合わせる） */
export interface OpsWorkerErrorStat {
  /** Worker の名前（miyosino-… の後ろ） */
  name: string;
  requests: number;
  errors: number;
  /** エラーの内訳（scriptThrewException など） */
  errorStatuses: Record<string, number>;
}

export interface OpsWorkersSummary {
  /** ops Worker に分析 API のトークンが設定されていなければ false */
  available: boolean;
  /** 直近24時間 */
  day?: OpsWorkerErrorStat[];
  /** 直近7日 */
  week?: OpsWorkerErrorStat[];
  /** 分析 API から読めなかったときの理由 */
  error?: string;
}

/** 見直しに入った理由（workers/api/_ops-chat-review.ts と合わせる） */
export type OpsChatReviewReason =
  'not' | 'partly' | 'refused' | 'cannot' | 'offtopic';

export type OpsChatReviewStatus = 'fixed' | 'skipped' | 'open';

export interface OpsChatReviewItem {
  /** 「会話の番号:何番目の質問か」 */
  key: string;
  at: string;
  page: string;
  question: string | null;
  answer: string | null;
  reasons: OpsChatReviewReason[];
  /** いちばん新しい記録（無ければ未対応） */
  review: {
    status: OpsChatReviewStatus;
    note: string;
    done_by: string;
    done_at: string;
  } | null;
}

export interface OpsChatReview {
  items: OpsChatReviewItem[];
  openCount: number;
}
