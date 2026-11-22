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
  location: string;
  usedBy: string;
  rotate: string[];
  after?: string;
  history: OpsHistoryEntry[];
}

export interface OpsLinkGroup {
  title: string;
  links: OpsLink[];
}

export interface OpsOverview {
  today: string;
  tasks: OpsTask[];
  secrets: OpsSecret[];
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
  notUnderstood?: {
    at: string;
    page: string;
    question: string | null;
    answer: string | null;
  }[];
}
