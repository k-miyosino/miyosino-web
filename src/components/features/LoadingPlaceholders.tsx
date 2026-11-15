// 読み込み中に、データが入ったあとと近い大きさの枠を出しておく。
// 読み込みが終わったときにページの高さが大きく変わり、目次から飛んだ先の位置がずれるのを抑える。
// 枠の件数（items）は、Kintone・microCMS に入っているおおよその件数に合わせている。

function LoadingStatus({ label }: { label: string }) {
  return <span className="sr-only">{label}を読み込み中です</span>;
}

// 「修繕の履歴」「団地のあゆみ」の縦の年表と同じ形の枠
export function TimelinePlaceholder({
  label,
  items,
  dotClassName,
}: {
  label: string;
  items: number;
  dotClassName: string;
}) {
  return (
    <div role="status" aria-busy="true" className="flow-root">
      <LoadingStatus label={label} />
      <ul className="-mb-8 animate-pulse" aria-hidden="true">
        {Array.from({ length: items }, (_, index) => (
          <li key={index}>
            <div className="relative pb-8">
              {index !== items - 1 && (
                <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" />
              )}
              <div className="relative flex space-x-3">
                <span
                  className={`h-8 w-8 flex-shrink-0 rounded-full ring-8 ring-white ${dotClassName}`}
                />
                <div className="w-full space-y-3 pt-1.5">
                  <div className="h-4 w-40 rounded bg-gray-200" />
                  <div className="h-4 w-56 max-w-full rounded bg-gray-200" />
                  <div className="h-3 w-full rounded bg-gray-100" />
                  <div className="h-3 w-4/5 rounded bg-gray-100" />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// 「団地の四季」のカードと同じ形の枠
export function SeasonsPlaceholder({ items }: { items: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:mx-0 lg:max-w-none lg:grid-cols-2"
    >
      <LoadingStatus label="四季の情報" />
      {Array.from({ length: items }, (_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl bg-gray-50 p-8 ring-1 ring-gray-200"
          aria-hidden="true"
        >
          <div className="mb-6 h-8 w-32 rounded bg-gray-200" />
          <div className="space-y-3">
            <div className="h-3 w-full rounded bg-gray-200" />
            <div className="h-3 w-full rounded bg-gray-200" />
            <div className="h-3 w-full rounded bg-gray-200" />
            <div className="h-3 w-3/4 rounded bg-gray-200" />
          </div>
          <div className="mt-10 h-64 w-full rounded-lg bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
