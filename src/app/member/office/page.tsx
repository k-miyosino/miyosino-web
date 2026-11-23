'use client';

import { MemberAuthWrapper, MemberPageHeader } from '@/components/member';
import OfficeHome from '@/components/member/office/OfficeHome';

// 事務員専用ページ（事務員だけ）。中身は office Worker が事務員にだけ返す（OFFICE.md）
export default function OfficePage() {
  return (
    <MemberAuthWrapper>
      <div className="min-h-screen bg-gray-50">
        <MemberPageHeader
          title="事務員専用ページ"
          description="窓口で受け付けた申請の入力と承認をします（事務員だけ）"
          gradientFrom="from-blue-700"
          gradientTo="to-blue-900"
          textColor="text-blue-100"
          hoverTextColor="hover:text-white"
        />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <OfficeHome />
        </div>
      </div>
    </MemberAuthWrapper>
  );
}
