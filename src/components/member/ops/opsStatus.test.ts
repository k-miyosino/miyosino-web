/**
 * 運用ダッシュボードの状態の表示（opsStatus.ts）
 */

import { describe, expect, it } from 'vitest';
import type { OpsChatSummary, OpsTask } from '@/types/ops';
import {
  cadenceLabel,
  chatReviewOpenCount,
  dueLabel,
  needsAttention,
  taskBadge,
} from './opsStatus';

function task(overrides: Partial<OpsTask>): OpsTask {
  return {
    id: 't',
    title: 'タスク',
    cadence: { type: 'monthly' },
    steps: [],
    dueDate: '2026-12-01',
    status: 'ok',
    history: [],
    ...overrides,
  };
}

describe('タスク', () => {
  it('期限切れ・もうすぐだけを「今やること」にする', () => {
    expect(needsAttention(task({ status: 'overdue' }))).toBe(true);
    expect(needsAttention(task({ status: 'soon' }))).toBe(true);
    for (const status of ['ok', 'done', 'event'] as const) {
      expect(needsAttention(task({ status }))).toBe(false);
    }
  });

  it('状態の表示', () => {
    expect(taskBadge(task({ status: 'overdue' })).label).toBe('期限切れ');
    expect(taskBadge(task({ status: 'soon' })).label).toBe('もうすぐ');
    expect(taskBadge(task({ status: 'done' })).label).toBe('完了');
  });

  it('次の期限は、月1・年1のときだけ出す', () => {
    expect(dueLabel(task({}))).toBe('2026-12-01');
    expect(
      dueLabel(task({ cadence: { type: 'deadline', date: '2028-04-30' } }))
    ).toBe('—');
    expect(dueLabel(task({ dueDate: null }))).toBe('—');
  });

  it('周期の表示', () => {
    expect(cadenceLabel({ type: 'monthly' })).toBe('月に1回');
    expect(cadenceLabel({ type: 'yearly' })).toBe('年に1回');
    expect(cadenceLabel({ type: 'deadline', date: '2028-04-30' })).toBe(
      '2028-04-30 までに'
    );
    expect(cadenceLabel({ type: 'event', when: '担当が替わったとき' })).toBe(
      '担当が替わったとき'
    );
  });
});

describe('chatReviewOpenCount', () => {
  it('見直しの未対応の数（読み込み前・古い Worker・読めなかったときは 0）', () => {
    const summary = (review: OpsChatSummary['review']): OpsChatSummary => ({
      available: true,
      review,
    });
    expect(chatReviewOpenCount(summary({ items: [], openCount: 3 }))).toBe(3);
    expect(chatReviewOpenCount(summary({ error: 'no table' }))).toBe(0);
    expect(chatReviewOpenCount(summary(undefined))).toBe(0);
    expect(chatReviewOpenCount(null)).toBe(0);
  });
});
