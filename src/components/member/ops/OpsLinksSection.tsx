import { OpsLinkGroup } from '@/types/ops';

export default function OpsLinksSection({
  groups,
}: Readonly<{
  groups: OpsLinkGroup[];
}>) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {groups.map((group) => (
        <div
          key={group.title}
          className="bg-white rounded-lg border border-gray-200 p-4"
        >
          <h3 className="font-medium text-gray-900 mb-2">{group.title}</h3>
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
  );
}
