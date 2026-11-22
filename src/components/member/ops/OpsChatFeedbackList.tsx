'use client';

import { useState } from 'react';
import { OpsChatFeedback, OpsChatRating } from '@/types/ops';
import OpsChatLogCard from './OpsChatLogCard';
import OpsSegmentedControl from './OpsSegmentedControl';

const RATINGS: { id: OpsChatRating; label: string; active: string }[] = [
  { id: 'understood', label: 'わかった', active: 'bg-green-700 text-white' },
  { id: 'partly', label: '少しわかった', active: 'bg-yellow-600 text-white' },
  { id: 'not', label: 'わからなかった', active: 'bg-red-700 text-white' },
];

/**
 * 直近30日の評価を、「わかった」「少しわかった」「わからなかった」で切り替えて、質問と答えをカードで出す。
 * 最初は、直すべきものがわかる「わからなかった」を開く
 */
export default function OpsChatFeedbackList({
  feedback,
  counts,
  logging,
}: Readonly<{
  feedback: OpsChatFeedback[];
  counts: Partial<Record<OpsChatRating, number>>;
  logging: boolean;
}>) {
  const [rating, setRating] = useState<OpsChatRating>('not');
  const total = RATINGS.reduce((sum, r) => sum + (counts[r.id] ?? 0), 0);
  const shown = feedback.filter((item) => item.rating === rating);
  const count = counts[rating] ?? 0;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="font-medium text-gray-900">
          直近30日の評価（{total}件）
        </h3>
        <OpsSegmentedControl
          legend="評価の種類"
          options={RATINGS.map(({ id, label, active }) => ({
            id,
            label: `${label}（${counts[id] ?? 0}）`,
            activeClassName: active,
          }))}
          value={rating}
          onChange={setRating}
        />
      </div>

      {!logging && (
        <p className="text-sm text-gray-600 mb-2">
          質問ログを保存していないので、評価だけが残り、質問と答えは表示できません（npm
          run chat:log -- on でオンにする）
        </p>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-gray-600 bg-white rounded-lg border border-gray-200 p-4">
          この評価はありません
        </p>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {shown.map((item) => (
              <OpsChatLogCard
                key={`${item.at}-${item.page}-${item.question ?? ''}`}
                item={item}
              />
            ))}
          </div>
          {count > shown.length && (
            <p className="text-xs text-gray-500 mt-2">
              新しい {shown.length} 件を表示しています（全 {count} 件）
            </p>
          )}
        </>
      )}
    </section>
  );
}
