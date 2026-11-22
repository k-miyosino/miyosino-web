// @vitest-environment jsdom
/**
 * モーダルの開閉（useModalTransition）
 * 以前、開いた直後に閉じてしまう不具合があった（StrictMode で描画中の状態の更新が消えた）。
 * StrictMode の下で、開く・閉じる・閉じるアニメーションの間を確かめる
 */

import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useModalTransition } from './useModalTransition';

function strict({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}

function renderModal(onClose = vi.fn()) {
  return renderHook(
    ({ open }: { open: boolean }) => useModalTransition(open, open, onClose),
    { initialProps: { open: false }, wrapper: strict }
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.style.overflow = '';
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useModalTransition', () => {
  it('閉じているときは置かない', () => {
    const { result } = renderModal();
    expect(result.current).toEqual({ shouldRender: false, isVisible: false });
  });

  it('開くとすぐ置き、少しあとで見えるようにする（開いたまま閉じない）', () => {
    const { result, rerender } = renderModal();
    rerender({ open: true });
    expect(result.current.shouldRender).toBe(true);
    act(() => vi.advanceTimersByTime(20));
    expect(result.current).toEqual({ shouldRender: true, isVisible: true });
    // しばらくたっても開いたまま
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toEqual({ shouldRender: true, isVisible: true });
  });

  it('閉じるとすぐ見えなくし、アニメーション（300ms）が終わってから外す', () => {
    const { result, rerender } = renderModal();
    rerender({ open: true });
    act(() => vi.advanceTimersByTime(20));
    rerender({ open: false });
    expect(result.current.isVisible).toBe(false);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.shouldRender).toBe(true);
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.shouldRender).toBe(false);
  });

  it('開いている間は背景のスクロールを止め、閉じたら戻す', () => {
    const { rerender } = renderModal();
    rerender({ open: true });
    expect(document.body.style.overflow).toBe('hidden');
    rerender({ open: false });
    act(() => vi.advanceTimersByTime(300));
    expect(document.body.style.overflow).toBe('unset');
  });

  it('開いている間だけ ESC キーで閉じる', () => {
    const onClose = vi.fn();
    const { rerender } = renderModal(onClose);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).not.toHaveBeenCalled();
    rerender({ open: true });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
