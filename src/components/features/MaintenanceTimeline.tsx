import type { MaintenanceRepair } from '@/types/history';

// 入居開始の年（基本情報のセクションと同じ）
const MOVE_IN_YEAR = 1982;

type RepairKind = 'major' | 'plan' | 'work';

type TimelineItem = {
  id: string;
  event: string;
  label: string; // 年表に出す年（"2018〜2020" など）
  startYear: number;
  endYear: number;
  kind: RepairKind;
  majorLabel?: string; // "第1回" など
};

// "1985年（昭和60年）" や "2018~20年（…）" から西暦の始まりと終わりを取り出す
function parseYears(year: string): { start: number; end: number } | null {
  const match = year.match(/^\s*(\d{4})(?:\s*[~〜～-]\s*(\d{2,4}))?/);
  if (!match) {
    return null;
  }
  const start = Number(match[1]);
  if (!match[2]) {
    return { start, end: start };
  }
  const endText = match[2];
  const end =
    endText.length === 4
      ? Number(endText)
      : Number(String(start).slice(0, 4 - endText.length) + endText);
  return { start, end: end >= start ? end : start };
}

function classify(repair: MaintenanceRepair): RepairKind {
  if (repair.event.includes('大規模修繕工事')) {
    return 'major';
  }
  if (repair.event.includes('長期修繕計画') || repair.tag.includes('計画')) {
    return 'plan';
  }
  return 'work';
}

function toTimelineItems(repairs: MaintenanceRepair[]): TimelineItem[] {
  return repairs.flatMap((repair) => {
    const years = parseYears(repair.year);
    if (!years) {
      return [];
    }
    const kind = classify(repair);
    return [
      {
        id: repair.id,
        event: repair.event,
        label:
          years.start === years.end
            ? `${years.start}`
            : `${years.start}〜${years.end}`,
        startYear: years.start,
        endYear: years.end,
        kind,
        majorLabel:
          kind === 'major'
            ? repair.event.match(/第\s*\d+\s*回/)?.[0].replace(/\s/g, '')
            : undefined,
      },
    ];
  });
}

export function repairAnchorId(id: string) {
  return `repair-${id}`;
}

export function MaintenanceTimeline({
  repairs,
}: {
  repairs: MaintenanceRepair[];
}) {
  const items = toTimelineItems(repairs);
  if (items.length === 0) {
    return null;
  }

  const currentYear = new Date().getFullYear();
  const startYear = Math.min(
    MOVE_IN_YEAR,
    ...items.map((item) => item.startYear)
  );
  const endYear =
    Math.max(currentYear, ...items.map((item) => item.endYear)) + 1;
  const position = (year: number) =>
    ((year - startYear) / (endYear - startYear)) * 100;

  const decadeTicks: number[] = [];
  for (
    let year = Math.ceil((startYear + 1) / 10) * 10;
    year < endYear;
    year += 10
  ) {
    decadeTicks.push(year);
  }

  const majorItems = items.filter((item) => item.kind === 'major');
  const minorItems = items.filter((item) => item.kind !== 'major');

  return (
    <figure className="mb-10" aria-labelledby="maintenance-timeline-caption">
      <figcaption
        id="maintenance-timeline-caption"
        className="mb-6 text-base text-gray-700"
      >
        {startYear}年の入居開始から、大規模修繕工事を
        <span className="mx-1 text-2xl font-bold text-blue-700">
          {majorItems.length}回
        </span>
        実施しています。
      </figcaption>

      <div className="px-4">
        {/* 大規模修繕工事の回数と年 */}
        <div className="relative h-12">
          {majorItems.map((item) => (
            <div
              key={item.id}
              className="absolute bottom-1 -translate-x-1/2 whitespace-nowrap text-center leading-tight"
              style={{ left: `${position(item.startYear)}%` }}
            >
              <p className="text-[11px] sm:text-xs font-bold text-blue-700">
                {item.majorLabel ?? '大規模修繕'}
              </p>
              <p className="text-[11px] sm:text-xs text-gray-700">
                {item.label}
              </p>
            </div>
          ))}
        </div>

        {/* 軸と印 */}
        <div className="relative h-8">
          <div
            className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-gray-300"
            aria-hidden="true"
          />
          {[startYear, ...decadeTicks].map((year) => (
            <div
              key={year}
              className="absolute top-1/2 h-2 w-px bg-gray-400"
              style={{ left: `${position(year)}%` }}
              aria-hidden="true"
            />
          ))}

          {minorItems.map((item) =>
            item.endYear > item.startYear ? (
              <a
                key={item.id}
                href={`#${repairAnchorId(item.id)}`}
                title={`${item.label}年 ${item.event}`}
                aria-label={`${item.label}年 ${item.event}`}
                className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-teal-500 hover:bg-teal-600"
                style={{
                  left: `${position(item.startYear)}%`,
                  width: `${position(item.endYear) - position(item.startYear)}%`,
                }}
              />
            ) : (
              <a
                key={item.id}
                href={`#${repairAnchorId(item.id)}`}
                title={`${item.label}年 ${item.event}`}
                aria-label={`${item.label}年 ${item.event}`}
                className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${
                  item.kind === 'plan'
                    ? 'h-2.5 w-2.5 rotate-45 bg-gray-400 hover:bg-gray-500'
                    : 'h-3 w-3 rounded-full bg-teal-500 hover:bg-teal-600'
                }`}
                style={{ left: `${position(item.startYear)}%` }}
              />
            )
          )}

          {majorItems.map((item) => (
            <a
              key={item.id}
              href={`#${repairAnchorId(item.id)}`}
              title={`${item.label}年 ${item.event}`}
              aria-label={`${item.label}年 ${item.event}`}
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 ring-2 ring-white hover:bg-blue-700 sm:h-5 sm:w-5 sm:ring-4"
              style={{ left: `${position(item.startYear)}%` }}
            />
          ))}
        </div>

        {/* 年の目盛り */}
        <div className="relative h-6" aria-hidden="true">
          <span
            className="absolute top-1 -translate-x-1/2 whitespace-nowrap text-[11px] text-gray-500"
            style={{ left: `${position(startYear)}%` }}
          >
            {startYear}
            <span className="hidden sm:inline"> 入居開始</span>
          </span>
          {decadeTicks.map((year) => (
            <span
              key={year}
              className="absolute top-1 -translate-x-1/2 text-[11px] text-gray-500"
              style={{ left: `${position(year)}%` }}
            >
              {year}
            </span>
          ))}
        </div>
      </div>

      {/* 凡例 */}
      <ul className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-gray-600">
        <li className="flex items-center gap-2">
          <span
            className="h-3.5 w-3.5 rounded-full bg-blue-600"
            aria-hidden="true"
          />
          大規模修繕工事
        </li>
        <li className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full bg-teal-500"
            aria-hidden="true"
          />
          その他の工事
        </li>
        <li className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rotate-45 bg-gray-400"
            aria-hidden="true"
          />
          長期修繕計画の策定・見直し
        </li>
      </ul>
    </figure>
  );
}
