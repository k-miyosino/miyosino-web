import { OpsHistoryEntry, OpsLink } from '@/types/ops';

/** 行を開いたときに出す関連リンク */
export function OpsLinkList({ links }: Readonly<{ links?: OpsLink[] }>) {
  if (!links || links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {links.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-700 underline hover:text-blue-900"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

/** 行を開いたときに出す、これまでの記録 */
export function OpsHistory({
  history,
  title,
}: Readonly<{ history: OpsHistoryEntry[]; title: string }>) {
  if (history.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>
      <ul className="text-sm text-gray-600 space-y-1">
        {history.map((entry) => (
          <li key={`${entry.done_at}-${entry.done_by}`}>
            {entry.done_at} {entry.done_by}
            {entry.note && `：${entry.note}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
