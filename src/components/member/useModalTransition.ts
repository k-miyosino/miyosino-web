'use client';

import { useEffect, useState } from 'react';

const CLOSE_DURATION_MS = 300; // モーダルの transition（duration-300）に合わせる

/**
 * モーダルの開閉アニメーションの状態。
 * - shouldRender: DOM に置くか（開いている間と、閉じるアニメーションが終わるまでは置いておく）
 * - isVisible: 表示のスタイル（opacity など）を「見えている」にするか
 *
 * 開いている間は計算で「置く」とし、状態の切り替えはすべてタイマーの中で行う
 * （effect の中で同期的に setState しない。react-hooks/set-state-in-effect）。
 * あわせて、開いている間は ESC キーで閉じられるようにし、背景のスクロールを止める（閉じたら戻す）。
 *
 * @param open 中身があって開いているか（例: isOpen && item !== null）
 * @param isOpen 開いているか（中身がなくても閉じる操作のときに使う）
 * @param onClose 閉じるとき（ESC キー）に呼ぶ
 */
export function useModalTransition(
  open: boolean,
  isOpen: boolean,
  onClose: () => void
) {
  // 閉じるアニメーションの間も DOM に置いておくための状態
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      // DOM に置かれてから、開くアニメーションを始める
      const mountTimer = setTimeout(() => setMounted(true), 0);
      const showTimer = setTimeout(() => setShown(true), 10);
      return () => {
        clearTimeout(mountTimer);
        clearTimeout(showTimer);
      };
    }
    if (!isOpen) {
      // 閉じるアニメーションが終わったら DOM から外す
      const hideTimer = setTimeout(() => setShown(false), 0);
      const unmountTimer = setTimeout(
        () => setMounted(false),
        CLOSE_DURATION_MS
      );
      return () => {
        clearTimeout(hideTimer);
        clearTimeout(unmountTimer);
      };
    }
  }, [open, isOpen]);

  // 開いている間は ESC キーで閉じられるようにし、背景のスクロールを止める
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // 閉じたら、閉じるアニメーションが終わってから背景のスクロールを戻す
  useEffect(() => {
    if (isOpen) return;
    const timer = setTimeout(() => {
      document.body.style.overflow = 'unset';
    }, CLOSE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  return {
    // 開いている間は必ず置く。閉じたあとは、アニメーションが終わるまで置いておく
    shouldRender: open || mounted,
    // 閉じた瞬間に閉じるアニメーションを始める
    isVisible: open && shown,
  };
}
