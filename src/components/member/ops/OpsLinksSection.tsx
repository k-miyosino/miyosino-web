import { OpsLinkGroup } from '@/types/ops';

/** リンク集（ヘッダーの右に、押すと開く形で置く） */
export default function OpsLinksSection({
  groups,
}: Readonly<{
  groups: OpsLinkGroup[];
}>) {
  return (
    <details className="relative">
      <summary className="list-none cursor-pointer select-none text-sm px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
        リンク集 ▾
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-[min(36rem,calc(100vw-2rem))] bg-white rounded-lg border border-gray-200 shadow-lg p-4 grid gap-4 sm:grid-cols-3">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="text-xs font-medium text-gray-500 mb-1">
              {group.title}
            </p>
            <ul className="space-y-1 text-sm">
              {group.links.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 underline hover:text-blue-900"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
