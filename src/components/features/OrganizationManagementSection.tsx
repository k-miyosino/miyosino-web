import { featuresSections } from './data';

// Tailwind が使うクラスを見つけられるよう、色のクラスは文字列のまま書く
type OrganizationAccent = {
  border: string;
  dot: string;
  stub: string;
};

const accents = {
  green: {
    border: 'border-t-green-600',
    dot: 'bg-green-500',
    stub: 'bg-green-600',
  },
  blue: {
    border: 'border-t-blue-600',
    dot: 'bg-blue-500',
    stub: 'bg-blue-600',
  },
  orange: {
    border: 'border-t-orange-500',
    dot: 'bg-orange-400',
    stub: 'bg-orange-500',
  },
  teal: {
    border: 'border-t-teal-600',
    dot: 'bg-teal-500',
    stub: 'bg-teal-600',
  },
} satisfies Record<string, OrganizationAccent>;

const organizationData = {
  title: '4つの主要組織',
  description:
    '住民による自主管理で、管理組合・自治会・自主防災会・街区班の4つの組織を運営しています。4つはそれぞれ独立した組織で、異なる役割を担いながら、協力して団地の運営を行っています。',
  committees: ['修繕', '植栽', '共用施設', '広報', 'IT', '財務'],
  otherOrganizations: [
    {
      name: '自治会',
      description: '地域コミュニティの運営とイベント実施',
      details: [
        '必要に応じて組織を編成し運営',
        'お祭りや餅つきなどの地域イベントの実施',
      ],
      accent: accents.blue,
    },
    {
      name: '自主防災会',
      description: '災害時の安全確保と地域防災',
      details: [
        '必要に応じて組織を編成し運営',
        '防災訓練や有識者を招いての防災セミナーの開催',
      ],
      accent: accents.orange,
    },
    {
      name: '街区班',
      description: '日常的な連絡とコミュニティ形成',
      details: ['近隣住民同士の連絡や助け合い', '情報共有の場として機能'],
      accent: accents.teal,
    },
  ],
};

// 4列のカードの中心どうしを結ぶ横線（gap-6 = 24px のとき、両端は 12.5% - 9px）
const branchLineClass =
  'absolute left-[calc(12.5%_-_9px)] right-[calc(12.5%_-_9px)] h-0.5 bg-gray-300';

function VerticalLine({ className = 'h-8' }: { className?: string }) {
  return (
    <div className="flex justify-center" aria-hidden="true">
      <div className={`w-0.5 bg-gray-300 ${className}`} />
    </div>
  );
}

function OrganizationCard({
  name,
  description,
  accent,
  children,
}: {
  name: string;
  description: string;
  accent: OrganizationAccent;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col">
      {/* 上の横線からカードへの縦線（横並びのときだけ） */}
      <div className="hidden lg:flex justify-center h-8" aria-hidden="true">
        <div className={`w-0.5 ${accent.stub}`} />
      </div>
      <div
        className={`flex-1 rounded-lg border border-gray-200 border-t-4 ${accent.border} bg-white p-5 shadow-sm`}
      >
        <h4 className="text-lg font-bold text-gray-900">{name}</h4>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
        <div className="mt-4">{children}</div>
      </div>
      {/* カードから下の横線への縦線（横並びのときだけ） */}
      <div className="hidden lg:flex justify-center h-8" aria-hidden="true">
        <div className="w-0.5 bg-gray-300" />
      </div>
    </div>
  );
}

function DetailList({ items, dot }: { items: string[]; dot: string }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-x-2">
          <span
            className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dot}`}
            aria-hidden="true"
          />
          <span className="text-sm text-gray-600">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ManagementAssociationChart() {
  return (
    <div className="space-y-0">
      <div className="rounded-md bg-green-50 px-3 py-2 text-center ring-1 ring-green-200">
        <p className="text-sm font-bold text-green-900">総会</p>
        <p className="text-xs text-green-800">最高意思決定機関</p>
      </div>
      <VerticalLine className="h-4" />
      <div className="rounded-md bg-green-50 px-3 py-2 text-center ring-1 ring-green-200">
        <p className="text-sm font-bold text-green-900">理事会</p>
        <p className="text-xs text-green-800">日常の運営を執行</p>
      </div>
      <VerticalLine className="h-4" />
      <div className="grid grid-cols-1 gap-2">
        <div className="rounded-md bg-gray-50 px-3 py-2 text-center ring-1 ring-gray-200">
          <p className="text-sm font-semibold text-gray-800">事務局</p>
        </div>
        <div className="rounded-md bg-gray-50 px-3 py-2 ring-1 ring-gray-200">
          <p className="text-center text-sm font-semibold text-gray-800">
            各種委員会
          </p>
          <ul className="mt-2 flex flex-wrap justify-center gap-1.5">
            {organizationData.committees.map((committee) => (
              <li
                key={committee}
                className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-700 ring-1 ring-gray-300"
              >
                {committee}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function OrganizationManagementSection() {
  const sectionMeta = featuresSections.find((s) => s.id === 'organization');

  if (!sectionMeta) {
    return null;
  }

  return (
    <section
      id={sectionMeta.id}
      className="bg-gray-50 py-24 sm:py-32 scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12">
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border-l-4 border-green-600 rounded-lg p-6 shadow-sm">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-start gap-3">
              <span className="text-4xl">{sectionMeta.icon}</span>
              <span>{sectionMeta.title}</span>
            </h2>
            <p className="mt-4 text-lg leading-8 text-gray-600">
              本団地は、住民による自主運営を基本としています。
              住民が代表者（総会の議員）となり、すべての意思決定は民主的な手続きを経て行われます。
              団地とは、住まいであると同時に、住民が力を合わせて「良い団地、良いコミュニティ」を共に創り上げ、理想とする暮らしを実現していくための場所です。
            </p>
          </div>
        </div>

        {/* 4つの主要組織（組織図） */}
        <div className="mx-auto mt-16 max-w-6xl">
          <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-center gap-x-3 mb-6">
              <div className="h-6 w-6 bg-green-600 rounded"></div>
              <h3 className="text-lg font-semibold leading-8 tracking-tight text-gray-900">
                {organizationData.title}
              </h3>
            </div>
            <p className="text-base leading-7 text-gray-600 mb-10">
              {organizationData.description}
            </p>

            <figure aria-label="4つの主要組織の関係を表した組織図">
              {/* 住民 */}
              <div className="flex justify-center">
                <div className="rounded-xl bg-green-600 px-8 py-4 text-center text-white shadow">
                  <p className="text-lg font-bold">住民</p>
                  <p className="text-xs text-green-50">
                    組合員・居住者が運営の担い手
                  </p>
                </div>
              </div>
              <VerticalLine />

              {/* 4つの組織 */}
              <div className="relative">
                <div
                  className={`hidden lg:block top-0 ${branchLineClass}`}
                  aria-hidden="true"
                />
                <div
                  className={`hidden lg:block bottom-0 ${branchLineClass}`}
                  aria-hidden="true"
                />
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  <OrganizationCard
                    name="管理組合"
                    description="建物・設備の管理と運営"
                    accent={accents.green}
                  >
                    <ManagementAssociationChart />
                  </OrganizationCard>
                  {organizationData.otherOrganizations.map((org) => (
                    <OrganizationCard
                      key={org.name}
                      name={org.name}
                      description={org.description}
                      accent={org.accent}
                    >
                      <DetailList items={org.details} dot={org.accent.dot} />
                    </OrganizationCard>
                  ))}
                </div>
              </div>

              {/* 連携 */}
              <div className="mt-6 lg:mt-0">
                <div className="hidden lg:block">
                  <VerticalLine />
                </div>
                <div className="flex justify-center">
                  <div className="rounded-full bg-gray-100 px-6 py-3 text-center ring-1 ring-gray-300">
                    <p className="text-sm font-semibold text-gray-800">
                      情報を共有し、連携して団地を運営
                    </p>
                  </div>
                </div>
              </div>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
