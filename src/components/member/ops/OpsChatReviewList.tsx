'use client';

import { useState } from 'react';
import {
  OpsChatReview,
  OpsChatReviewItem,
  OpsChatReviewReason,
  OpsChatReviewStatus,
} from '@/types/ops';
import { recordChatReview } from '@/repositories/ops/opsRepository';
import OpsChatLogCard from './OpsChatLogCard';
import OpsSegmentedControl from './OpsSegmentedControl';

const REASONS: Record<
  OpsChatReviewReason,
  { label: string; className: string }
> = {
  not: { label: 'わからなかった', className: 'bg-red-100 text-red-800' },
  partly: { label: '少しわかった', className: 'bg-yellow-100 text-yellow-800' },
  cannot: {
    label: '答えられなかった',
    className: 'bg-orange-100 text-orange-800',
  },
  offtopic: { label: '関係のない質問', className: 'bg-gray-100 text-gray-700' },
  refused: { label: '断った', className: 'bg-red-100 text-red-800' },
};

const STATUS_LABELS: Record<OpsChatReviewStatus, string> = {
  fixed: '直した',
  skipped: '対応不要',
  open: '未対応に戻した',
};

const isOpen = (item: OpsChatReviewItem) =>
  !item.review || item.review.status === 'open';

/** workers/eval/chat-questions.md にそのまま貼れる1行（改行は空白にする） */
function evalLine(question: string): string {
  return `- ${question.replace(/\s+/g, ' ').trim()}`;
}

function CopyEvalLine({ question }: Readonly<{ question: string }>) {
  const [copied, setCopied] = useState(false);
  const line = evalLine(question);
  return (
    <button
      type="button"
      title={`workers/eval/chat-questions.md に貼る行: ${line}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(line);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // クリップボードが使えないときは、選んでコピーできるように出す
          window.prompt('この行をコピーしてください', line);
        }
      }}
      className="text-xs text-blue-700 hover:text-blue-900 underline"
    >
      {copied ? 'コピーしました' : '想定質問の行をコピー'}
    </button>
  );
}

function ReviewForm({
  item,
  onRecorded,
}: Readonly<{ item: OpsChatReviewItem; onRecorded: () => void }>) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const record = async (status: OpsChatReviewStatus) => {
    setSaving(true);
    setError(null);
    try {
      await recordChatReview(item.key, status, note);
      setNote('');
      onRecorded();
    } catch (e) {
      setError(e instanceof Error ? e.message : '記録できませんでした');
    } finally {
      setSaving(false);
    }
  };

  const buttonClass =
    'text-sm px-3 py-1.5 rounded disabled:opacity-60 whitespace-nowrap';
  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          placeholder="メモ（任意。例: 案内文に集会所の時間を足した）"
          aria-label="メモ（任意）"
          className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
        />
        {isOpen(item) ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => record('fixed')}
              className={`${buttonClass} bg-blue-600 hover:bg-blue-700 text-white`}
            >
              直した
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => record('skipped')}
              className={`${buttonClass} border border-gray-300 bg-white hover:bg-gray-50 text-gray-800`}
            >
              対応不要
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => record('open')}
            className={`${buttonClass} border border-gray-300 bg-white hover:bg-gray-50 text-gray-800`}
          >
            未対応に戻す
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

/**
 * 答えを直すきっかけになる質問の一覧。未対応のものを先に開き、「直した」「対応不要」を記録する。
 * 直した質問は、想定質問（chat-questions.md）に足して chat:eval で確かめる
 */
export default function OpsChatReviewList({
  review,
  logging,
  onRecorded,
}: Readonly<{
  review: OpsChatReview | { error: string } | undefined;
  logging: boolean;
  onRecorded: () => void;
}>) {
  const [showDone, setShowDone] = useState(false);

  if (!review) return null; // 古い ops Worker
  if ('error' in review) {
    return (
      <p className="text-sm text-red-700">
        見直しの一覧を読み込めませんでした（{review.error}
        ）。記録の表がまだ無いときは、OPS.md
        の手順でマイグレーションを適用します
      </p>
    );
  }

  const open = review.items.filter(isOpen);
  const done = review.items.filter((item) => !isOpen(item));
  const shown = showDone ? done : open;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="font-medium text-gray-900">見直し</h3>
        <OpsSegmentedControl
          legend="見直しの状態"
          options={[
            { id: 'open', label: `未対応（${open.length}）` },
            { id: 'done', label: `対応済み（${done.length}）` },
          ]}
          value={showDone ? 'done' : 'open'}
          onChange={(id) => setShowDone(id === 'done')}
        />
      </div>
      <p className="text-sm text-gray-600 mb-2">
        「わからなかった」「少しわかった」の評価と、答えられなかった・断った答えです。答えが足りなければ案内文やページを直して「直した」、直さなくてよければ「対応不要」を記録します
      </p>
      {!logging && (
        <p className="text-sm text-gray-600 mb-2">
          質問ログを保存していないので、評価だけが入り、質問と答えは表示できません
        </p>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-gray-600 bg-white rounded-lg border border-gray-200 p-4">
          {showDone ? '対応済みのものはありません' : '未対応のものはありません'}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((item) => (
            <OpsChatLogCard
              key={item.key}
              item={item}
              badges={item.reasons.map((reason) => (
                <span
                  key={reason}
                  className={`px-2 py-0.5 rounded-full font-medium ${REASONS[reason].className}`}
                >
                  {REASONS[reason].label}
                </span>
              ))}
            >
              <div className="border-t border-gray-100 pt-3 space-y-2">
                {item.review && (
                  <p className="text-xs text-gray-600">
                    {STATUS_LABELS[item.review.status]}（{item.review.done_at}{' '}
                    {item.review.done_by}）
                    {item.review.note && `：${item.review.note}`}
                  </p>
                )}
                {item.question && <CopyEvalLine question={item.question} />}
                <ReviewForm item={item} onRecorded={onRecorded} />
              </div>
            </OpsChatLogCard>
          ))}
        </div>
      )}
    </section>
  );
}
