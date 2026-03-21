// アイコンを削除してエラー回避
import { featuresSections } from './data';

const historyData = [
  {
    year: '1982年（昭和57年）',
    events: [
      {
        event: '住宅分譲募集開始',
        description: '6月、住宅分譲募集開始（かわつる地区で最初の分譲団地）',
      },
      {
        event: '管理組合設立、入居開始',
        description:
          '8月、第1回創立総会、管理組合設立、規約・協定・細則を決定。8月25日、入居開始',
      },
      {
        event: '第1回理事会開催',
        description: '9月、第1回理事会開催',
      },
      {
        event: '10月、グリーンタウンニュース創刊（以降毎月発行）',
        description: '',
      },
    ],
  },
  {
    year: '1983年（昭和58年）',
    events: [
      {
        event: '街区班設置',
        description: '5月、第2回通常総会開催、街区班の設置を決定',
      },
      {
        event: '夏まつり',
        description: '8月、夏まつり実施（以降毎年実施）',
      },
    ],
  },
  {
    year: '1984年（昭和59年）',
    events: [
      {
        event: '日住協加入',
        description: '3月、公団分譲住宅管理組合連絡協議会（後の日住協）に加入',
      },
      {
        event: '完全自主管理体制',
        description:
          '4月、完全自主管理体制スタート。窓口業務、環境整備を組合員が担当',
      },
      {
        event: '法人化',
        description:
          '6月、第3回通常総会開催「法人化」を決定。「かわつる三芳野団地管理組合法人」に名称変更。',
      },
      {
        event: '住まいのハンドブック',
        description: '7月、住まいのハンドブック（第1版）発行',
      },
    ],
  },
  {
    year: '1985年（昭和60年）',
    events: [
      {
        event: '自治会設立',
        description: '3月、自治会設立総会（管理組合と分離）',
      },
      {
        event: '長期修繕計画',
        description: '5月、第4回通常総会開催「長期修繕計画」を決定',
      },
    ],
  },
  {
    year: '1986年（昭和61年）',
    events: [
      {
        event: '町名変更',
        description:
          '10月、居住者の意見により、新町名を「かわつる三芳野」に変更',
      },
    ],
  },
  {
    year: '1987年（昭和62年）',
    events: [
      {
        event: '登記実施',
        description: '2月、かわつる地区の区画整理完了に伴い、土地の登記を実施',
      },
      {
        event: 'ペット飼育指針',
        description: '2月、ペットの飼育指針発表',
      },
      {
        event: '12月、住まいのハンドブック（第2版）発行',
        description: '',
      },
    ],
  },
  {
    year: '1988年（昭和63年）',
    events: [
      {
        event: '秩序協定',
        description:
          '5月、第7回通常総会開催、秩序協定に「所有住宅を社宅や賃貸などの登記目的に利用してはならない」ことを決定',
      },
    ],
  },
  {
    year: '1989年（昭和64年）',
    events: [
      {
        event: '空家完売',
        description: '3月、団地内公団所有文の空家が完売',
      },
    ],
  },
  {
    year: '1991年（平成3年）',
    events: [
      {
        event: '1月、グリーンタウンニュース100号記念特集発行',
        description: '',
      },
    ],
  },
  {
    year: '1992年（平成4年）',
    events: [
      {
        event: '12月、「住まいのハンドブック（第3版）グリーンウェルネス」発行',
        description: '',
      },
    ],
  },
  {
    year: '1994年（平成6年）',
    events: [
      {
        event: 'NHK放送',
        description: '当団地のペット飼育状況につきNHKで放映',
      },
    ],
  },
  {
    year: '1996年（平成8年）',
    events: [
      {
        event: '大規模修繕工事実施',
        description: '外壁の補修と塗装を実施',
      },
    ],
  },
  {
    year: '1998年（平成10年）',
    events: [
      {
        event: '防災備品倉庫',
        description: '11月、防災備品倉庫を新設',
      },
    ],
  },
  {
    year: '2000年（平成12年）',
    events: [
      {
        event: '長期修繕計画見直し',
        description:
          '3月、長期修繕計画の見直しが完了、平成31年までの修繕計画報告書を作成',
      },
      {
        event: 'NHK放送',
        description:
          '6月、NHK、当団地管理組合の運営状況を収録、6月21日ニュース10で全国放映',
      },
    ],
  },
  {
    year: '2006年（平成18年）',
    events: [
      {
        event: '大規模修繕工事実施',
        description: '外壁の劣化状況を点検し、必要な補修と塗装を実施',
      },
    ],
  },
  {
    year: '2009年（平成21年）',
    events: [
      {
        event: '長期修繕計画見直し',
        description: '1月、長期修繕計画（第3回見直し）配布',
      },
    ],
  },
  {
    year: '2012年（平成24年）',
    events: [
      {
        event: '大規模修繕工事実施',
        description: '外壁塗装に加え、屋根の葺き替えも実施',
      },
    ],
  },
  {
    year: '20xx年（平成xx年）',
    events: [
      {
        event: '外構工事',
        description: '歩道のバリアフリー化を実施',
      },
    ],
  },
  {
    year: '2025年（令和7年）',
    events: [
      {
        event: '大規模修繕工事実施',
        description:
          '外壁塗装や扉交換、中層棟はインナーサッシ取付による断熱化などを実施',
      },
    ],
  },
];

export function HistorySection() {
  const sectionMeta = featuresSections.find((s) => s.id === 'history');

  if (!sectionMeta) {
    return null;
  }

  return (
    <section
      id={sectionMeta.id}
      className="bg-white py-24 sm:py-32 scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-600 rounded-lg p-6 shadow-sm">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-start gap-3">
              <span className="text-4xl">{sectionMeta.icon}</span>
              <span>{sectionMeta.title}</span>
            </h2>
          </div>
        </div>

        {/* 団地のあゆみ */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="flow-root">
            <ul role="list" className="-mb-8">
              {historyData.map((yearItem, yearIndex) => (
                <li key={yearIndex}>
                  <div className="relative pb-8">
                    {yearIndex !== historyData.length - 1 ? (
                      <span
                        className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                        aria-hidden="true"
                      />
                    ) : null}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className="h-8 w-8 rounded-full bg-green-600 flex items-center justify-center ring-8 ring-white">
                          <div className="h-4 w-4 bg-white rounded"></div>
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                        <div className="w-full">
                          <p className="text-sm text-gray-500 mb-2">
                            <span className="font-medium text-gray-900">
                              {yearItem.year}
                            </span>
                          </p>
                          {yearItem.events.map((event, eventIndex) => (
                            <div
                              key={eventIndex}
                              className={
                                eventIndex > 0
                                  ? 'mt-3 pt-3 border-t border-gray-100'
                                  : ''
                              }
                            >
                              <p className="text-sm font-semibold text-gray-900">
                                {event.event}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {event.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
