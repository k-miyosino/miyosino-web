'use client';

import { MemberAuthWrapper, MemberPageHeader } from '@/components/member';
import OpsDashboard from '@/components/member/ops/OpsDashboard';

// 運用ダッシュボード（管理者だけ）。中身は ops Worker が管理者にだけ返す（OPS.md）
export default function OpsPage() {
  return (
    <MemberAuthWrapper>
      <div className="min-h-screen bg-gray-50">
        <MemberPageHeader
          title="運用ダッシュボード"
          description="ホームページの運用で定期的に必要な作業と、サービスの状態をまとめて確かめます（管理者だけ）"
          gradientFrom="from-slate-700"
          gradientTo="to-slate-900"
          textColor="text-slate-200"
          hoverTextColor="hover:text-white"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <OpsDashboard />
        </div>
      </div>
    </MemberAuthWrapper>
  );
}
