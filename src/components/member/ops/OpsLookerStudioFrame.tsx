'use client';

import { useEffect, useRef, useState } from 'react';

// Looker Studio のレポートの紙面の大きさ（「テーマとレイアウト → レイアウト → キャンバスのサイズ」）。
// 表示モードは「幅に合わせる」なので、紙面は枠の幅に合わせて縮む。紙面の大きさを変えたら、ここも直す
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 900;
// 紙面のまわりの余白と、下の「プライバシー | データポータル」の帯の分
const FRAME_EXTRA_HEIGHT = 48;
// 紙面より広く表示しても大きくはならないので、枠もこの幅までにする
const MAX_FRAME_WIDTH = CANVAS_WIDTH + 40;

/**
 * Looker Studio のレポートの埋め込み。
 * 枠の中身は別のサイトなので高さを読み取れない。代わりに枠の幅から紙面の高さを計算し、
 * 枠の中にスクロールバーが出ないようにする
 */
export default function OpsLookerStudioFrame({
  src,
}: Readonly<{ src: string }>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(CANVAS_HEIGHT);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const update = () => {
      const width = Math.min(wrapper.clientWidth, CANVAS_WIDTH);
      setHeight(
        Math.ceil((width * CANVAS_HEIGHT) / CANVAS_WIDTH) + FRAME_EXTRA_HEIGHT
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="mx-auto bg-white rounded-lg border border-gray-200 overflow-hidden"
      style={{ maxWidth: MAX_FRAME_WIDTH }}
    >
      <iframe
        src={src}
        title="アクセス解析（Looker Studio）"
        className="block w-full border-0"
        style={{ height }}
        scrolling="no"
        sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
