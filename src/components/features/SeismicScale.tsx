// Is値（構造耐震指標）による判定の目安
// 平成18年国土交通省告示第184号（建築物の耐震診断及び耐震改修の促進を図るための基本的な方針）別添による
const zones = [
  {
    range: '0.3未満',
    label: '倒壊・崩壊の危険性が高い',
    bar: 'bg-red-400',
    text: 'text-red-700',
  },
  {
    range: '0.3以上 0.6未満',
    label: '倒壊・崩壊の危険性がある',
    bar: 'bg-amber-300',
    text: 'text-amber-700',
  },
  {
    range: '0.6以上',
    label: '倒壊・崩壊の危険性が低い',
    bar: 'bg-green-500',
    text: 'text-green-700',
  },
];

export function SeismicScale() {
  return (
    <figure
      className="rounded-2xl bg-white p-6 sm:p-8 shadow-sm ring-1 ring-gray-200"
      aria-labelledby="seismic-scale-caption"
    >
      <figcaption id="seismic-scale-caption">
        <div className="flex items-center gap-x-3">
          <h3 className="text-lg font-semibold leading-8 tracking-tight text-gray-900">
            Is値で見た当団地の位置
          </h3>
        </div>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Is値（構造耐震指標）は、建物の耐震性能を表す数値です。大きいほど地震に強く、震度6強〜7程度の大規模な地震に対する安全性を次の3段階で判定します。
        </p>
      </figcaption>

      <div className="mt-8">
        {/* 当団地の位置 */}
        <div className="grid grid-cols-3">
          <div className="col-start-3 flex flex-col items-center text-center">
            <span className="rounded-full bg-purple-600 px-3 py-1 text-xs sm:text-sm font-bold text-white whitespace-nowrap shadow">
              当団地
            </span>
            <span className="mt-1 text-xs sm:text-sm font-bold text-purple-700">
              Is0.6以上
            </span>
            <span
              className="mt-1 h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-purple-600"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* 目盛りの帯 */}
        <div
          className="mt-1 grid grid-cols-3 overflow-hidden rounded-full"
          aria-hidden="true"
        >
          {zones.map((zone, index) => (
            <div
              key={zone.range}
              className={`h-4 ${zone.bar} ${
                index === zones.length - 1
                  ? 'ring-2 ring-inset ring-purple-600'
                  : ''
              }`}
            />
          ))}
        </div>

        {/* 境目の数値 */}
        <div className="relative mt-1 h-5" aria-hidden="true">
          <span className="absolute left-0 text-xs text-gray-500">0</span>
          <span className="absolute left-1/3 -translate-x-1/2 text-xs font-semibold text-gray-700">
            0.3
          </span>
          <span className="absolute left-2/3 -translate-x-1/2 text-xs font-semibold text-gray-700">
            0.6
          </span>
        </div>

        {/* 判定 */}
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:gap-4">
          {zones.map((zone) => (
            <li key={zone.range} className="text-center">
              <p className={`text-xs sm:text-sm font-bold ${zone.text}`}>
                {/* 「0.3以上 0.6未満」が語の途中で折り返さないようにする */}
                {zone.range.split(' ').map((part) => (
                  <span key={part} className="inline-block px-0.5">
                    {part}
                  </span>
                ))}
              </p>
              <p className="mt-1 text-[11px] sm:text-xs leading-snug text-gray-600">
                {zone.label}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-[11px] sm:text-xs leading-5 text-gray-500">
        ※
        判定の目安は、国土交通省の告示（平成18年国土交通省告示第184号）によるものです。
      </p>
    </figure>
  );
}
