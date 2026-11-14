'use client';

import { useEffect, useState } from 'react';

/** スマートフォンの幅のときの、チャット欄の高さの上限と、下の端の位置（px） */
export interface MobileChatFrame {
  maxHeight: number;
  bottom: number;
}

const MOBILE_QUERY = '(max-width: 639px)';
// チャット欄の上下にあける余白
const MARGIN = 8;
// これより低くはしない（見えている範囲がとても狭いときでも、入力欄と閉じるボタンを残す）
const MIN_HEIGHT = 200;

/**
 * スマートフォンの幅のとき、実際に見えている範囲（visualViewport）に合わせて、
 * チャット欄の高さの上限と下の端の位置を返す。パソコンの幅のときは null（CSS の指定を使う）。
 *
 * スマートフォンのブラウザの vh は、アドレスバーが隠れたときのいちばん大きい高さが基準なので、
 * アドレスバーやキーボードが出ていると、vh で指定した高さが見えている範囲を超え、
 * チャット欄の上の端（閉じるボタン）が画面の外に出てしまう。そのため、見えている高さから計算する。
 * キーボードが開いているときは、チャット欄の下の端をキーボードの上に合わせる。
 */
export function useMobileChatFrame(isOpen: boolean): MobileChatFrame | null {
  const [frame, setFrame] = useState<MobileChatFrame | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const mq = window.matchMedia(MOBILE_QUERY);
    const vv = window.visualViewport;

    const update = () => {
      if (!mq.matches) {
        setFrame(null);
        return;
      }
      const visibleHeight = vv ? vv.height : window.innerHeight;
      const offsetTop = vv ? vv.offsetTop : 0;
      // 見えている範囲の下にある部分（キーボードなど）の高さ
      const hiddenBelow = Math.max(
        0,
        window.innerHeight - visibleHeight - offsetTop
      );
      setFrame({
        maxHeight: Math.max(MIN_HEIGHT, Math.floor(visibleHeight - MARGIN * 2)),
        bottom: MARGIN + Math.round(hiddenBelow),
      });
    };

    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    mq.addEventListener('change', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      mq.removeEventListener('change', update);
    };
  }, [isOpen]);

  return frame;
}
