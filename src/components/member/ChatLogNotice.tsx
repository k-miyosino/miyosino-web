'use client';

import Link from 'next/link';

interface ChatLogNoticeProps {
  retentionDays: number;
  /** 「この会話を保存しない」を選んでいるか */
  noLog: boolean;
  onChangeNoLog: (noLog: boolean) => void;
  /** プライバシーポリシーのリンクを押したとき */
  onNavigate?: () => void;
}

/**
 * 質問ログを保存しているときだけ、入力欄の下に出す告知と「この会話を保存しない」。
 */
export default function ChatLogNotice({
  retentionDays,
  noLog,
  onChangeNoLog,
  onNavigate,
}: Readonly<ChatLogNoticeProps>) {
  return (
    <div className="mt-1 space-y-1 text-xs text-gray-500">
      <p>
        質問と回答は、ホームページの改善のため、だれの質問かわからない形で
        {retentionDays}日間保存します（
        <Link
          href="/privacy#chatbot"
          onClick={onNavigate}
          className="underline underline-offset-2 hover:text-gray-700"
        >
          プライバシーポリシー
        </Link>
        ）。
      </p>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={noLog}
          onChange={(event) => onChangeNoLog(event.target.checked)}
          className="h-3.5 w-3.5"
        />
        この会話を保存しない
      </label>
    </div>
  );
}
