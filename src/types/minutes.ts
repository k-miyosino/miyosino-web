import { BaseEntity } from '@/shared/types';

// ファイル情報の型
export interface FileInfo {
  fileKey: string;
  name: string;
  contentType?: string;
  size?: string;
  title?: string; // 関連資料のタイトル（materials専用）
}

// 会議データ
export interface Meeting extends BaseEntity {
  title: string; // 会議名
  StartDateTime: string; // 開催日時（ISO 8601形式: YYYY-MM-DDTHH:mm:ss）
  venue: string; // 開催場所
  category: string; // カテゴリ
  materials?: FileInfo[]; // 関連資料（添付ファイル、複数件登録可能）
  minutes?: FileInfo; // 議事録（添付ファイル）
  audio?: FileInfo; // 録音ファイルの1つ目（以前の Worker との互換のため）
  audios?: FileInfo[]; // 録音ファイル（総会などは複数）
}
