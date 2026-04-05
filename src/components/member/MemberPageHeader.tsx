import Link from 'next/link';
import MemberNavigation from './MemberNavigation';

interface MemberPageHeaderProps {
  title: string;
  description: string;
  gradientFrom: string;
  gradientTo: string;
  textColor: string;
  hoverTextColor: string;
}

export default function MemberPageHeader({
  title,
  description,
  gradientFrom,
  gradientTo,
  textColor,
  hoverTextColor,
}: MemberPageHeaderProps) {
  return (
    <div
      className={`bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          href="/member"
          className={`inline-flex items-center ${textColor} hover:text-white mb-4 transition-colors`}
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          組合員専用ページのトップに戻る
        </Link>
        <h1 className="text-3xl lg:text-4xl font-bold">{title}</h1>
        <p className={`${textColor} text-lg mt-4`}>{description}</p>
        <MemberNavigation />
      </div>
    </div>
  );
}
