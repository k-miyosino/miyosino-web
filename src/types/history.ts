// Worker (miyosino-history-api) のレスポンス型
export interface KintoneHistoryEvent {
  id: string;
  year: string;
  sortOrder: number;
  type: string;        // "一般" | "修繕"
  event: string;       // 修繕の場合は "第1回 大規模修繕工事" のように番号込み
  description: string;
  tag: string[];       // サブテーブル tag_value の配列
}

export interface KintoneHistoryResponse {
  events: KintoneHistoryEvent[];
}

// HistorySection 用
export interface HistoryYearGroup {
  year: string;
  events: {
    id: string;
    event: string;
    description: string;
    tag: string[];
  }[];
}

// MaintenanceSection 用
export interface MaintenanceRepair {
  id: string;
  year: string;
  event: string;   // "第1回 大規模修繕工事" など
  tag: string[];
  description: string;
}
