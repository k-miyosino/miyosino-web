import { memberPageMetadata } from '@/shared/metadata';

// ページのタイトル（page.tsx はクライアントコンポーネントなので、ここで付ける）
export const metadata = memberPageMetadata('/member/announcements');

export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
