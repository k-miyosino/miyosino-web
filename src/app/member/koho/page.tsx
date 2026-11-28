'use client';

import { MemberAuthWrapper, MemberPageHeader } from '@/components/member';
import KohoHome from '@/components/member/koho/KohoHome';

// 広報ページ（広報委員だけ）。リンク集は koho Worker が広報委員にだけ返す（KOHO.md）
export default function KohoPage() {
  return (
    <MemberAuthWrapper>
      <div className="min-h-screen bg-gray-50">
        <MemberPageHeader
          title="広報ページ"
          description="ホームページで発信する情報を、どこで直すかをまとめています（広報委員だけ）"
          gradientFrom="from-emerald-700"
          gradientTo="to-emerald-900"
          textColor="text-emerald-100"
          hoverTextColor="hover:text-white"
        />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <KohoHome />
        </div>
      </div>
    </MemberAuthWrapper>
  );
}
