'use client';

import { useEffect, useState } from 'react';

const CLOSE_DURATION_MS = 300; // モーダルの transition（duration-300）に合わせる

/**
 * モーダルの開閉アニメーションの状態。
 * - shouldRender: DOM に置くか（閉じるアニメーションが終わるまでは置いておく）
 * - isVisible: 表示のスタイル（opacity など）を「見えている」にするか
 *
 * 開いた・閉じたことは描画の中で見て状態を合わせ（effect の中で同期的に setState しない）、
 * 少し遅らせて切り替える部分だけをタイマーで行う。
 *
 * @param open 中身があって開いているか（例: isOpen && item !== null）
 * @param isOpen 開いているか（中身がなくても閉じる操作のときに使う）
 */
export function useModalTransition(open: boolean, isOpen: boolean) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  // 前回の描画のときの値（開閉が変わったかを見るため）。最初は閉じていたものとして扱う
  const [prevOpen, setPrevOpen] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(false);

  if (open !== prevOpen || isOpen !== prevIsOpen) {
    setPrevOpen(open);
    setPrevIsOpen(isOpen);
    if (open) {
      // 開いたら、まず DOM に置く
      setShouldRender(true);
    } else if (!isOpen) {
      // 閉じたら、まず閉じるアニメーションを始める
      setIsVisible(false);
    }
  }

  useEffect(() => {
    if (open) {
      // DOM に置かれてから、開くアニメーションを始める
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    }
    if (!isOpen) {
      // 閉じるアニメーションが終わったら、DOM から外す
      const timer = setTimeout(() => setShouldRender(false), CLOSE_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [open, isOpen]);

  return { shouldRender, isVisible };
}
