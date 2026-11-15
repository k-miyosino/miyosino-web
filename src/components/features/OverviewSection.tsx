import { featuresSections } from './data';

const overviewData = {
  location: {
    title: '所在地・立地',
    description:
      '埼玉県川越市の西部に位置し、鶴ヶ島市と川越市の接点に位置します。圏央道「圏央鶴ヶ島IC」から車で約5分の好立地。緑豊かな環境に囲まれながら、生活に必要な施設が充実しています。川越市の中心部へは車で約20分、バスと電車を乗り継いでも約30分でアクセスでき、東京都心部へは1時間程度でアクセスできます。',
    details: [
      '住所：〒350-1177 埼玉県川越市かわつる三芳野１番地',
      '鉄道：東武東上線鶴ヶ島駅西口、またはJR川越線笠幡駅西口',
      'バス：鶴ヶ島駅西口から「川鶴団地」行きバスで約7分「川鶴センター」下車',
      '車：圏央道「圏央鶴ヶ島IC」から約5分、関越道「鶴ケ島インター」から約10分',
    ],
  },
  scale: {
    title: '団地規模・施設',
    description:
      '総戸数548戸の中規模の団地です。5階建ての中層棟と2階建てテラスハウスで構成されています。昭和57年（1982年）8月25日に入居開始し、長年にわたって多くの住民に愛されています。',
    details: [
      '総戸数：548戸',
      '入居開始：昭和57年（1982年）8月25日',
      '敷地面積：69,786.60㎡',
      '建築面積：15,540㎡（延51,540㎡）',
      '共用施設：管理事務所（集会所、会議室）、テニスコート、児童公園・プール',
    ],
  },
  layout: {
    title: '管理費・修繕積立金',
    description:
      '適正な管理費と修繕積立金で、長期的な住環境の維持を図っています。',
    details: [
      '管理費：5,500円/月',
      '修繕積立金：7,000～12,000円/月（区分別）',
      '駐車場料金：4,500円/月',
      '駐輪場：自転車500円/年、オートバイ1,000～2,000円/年',
    ],
  },
  features: {
    title: '駐車場・駐輪場',
    description:
      '充実した駐車場と駐輪場を完備。来客用駐車場もあり、安心してご利用いただけます。',
    details: [
      '駐車場：433台（充足率約80％）',
      'テラスハウス専用駐車場：42台（無料）',
      '来客用駐車場：31台（夜間有料・届出制）',
    ],
  },
};

// ひと目で伝えたい数字（詳しい内容は下のカードにある）
const keyFigures = [
  { label: '総戸数', value: '548', unit: '戸' },
  { label: '入居開始', value: '1982', unit: '年' },
  { label: '敷地面積', value: '約7', unit: '万㎡' },
  { label: '管理費', value: '5,500', unit: '円/月' },
  { label: '駐車場', value: '433', unit: '台' },
  { label: '圏央鶴ヶ島ICから', value: '約5', unit: '分' },
];

export function OverviewSection() {
  const sectionMeta = featuresSections.find((s) => s.id === 'basic');

  if (!sectionMeta) {
    return null;
  }

  return (
    <section
      id={sectionMeta.id}
      className="bg-gray-100 py-24 sm:py-32 scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12">
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-blue-600 rounded-lg p-6 shadow-sm">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-start gap-3">
              <span className="text-4xl">{sectionMeta.icon}</span>
              <span>{sectionMeta.title}</span>
            </h2>
          </div>
        </div>

        {/* 主な数字 */}
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {keyFigures.map((figure) => (
            <div
              key={figure.label}
              className="flex flex-col-reverse items-center rounded-2xl bg-white px-3 py-5 text-center shadow-sm ring-1 ring-gray-200"
            >
              <dt className="mt-1 text-xs sm:text-sm text-gray-600">
                {figure.label}
              </dt>
              <dd className="text-gray-900">
                <span className="text-3xl font-bold tracking-tight text-green-700">
                  {figure.value}
                </span>
                <span className="ml-0.5 text-sm font-semibold">
                  {figure.unit}
                </span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2">
          <div className="flex flex-col items-start">
            <div className="rounded-2xl bg-gray-50 p-8 shadow-sm ring-1 ring-gray-300">
              <div className="flex items-center gap-x-3">
                <h3 className="text-lg font-semibold leading-8 tracking-tight text-gray-800">
                  {overviewData.location.title}
                </h3>
              </div>
              <p className="mt-4 text-base leading-7 text-gray-600">
                {overviewData.location.description}
              </p>
              <ul className="mt-6 space-y-2">
                {overviewData.location.details.map((detail, index) => (
                  <li key={index} className="text-sm text-gray-600">
                    • {detail}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-start">
            <div className="rounded-2xl bg-gray-50 p-8 shadow-sm ring-1 ring-gray-300">
              <div className="flex items-center gap-x-3">
                <h3 className="text-lg font-semibold leading-8 tracking-tight text-gray-800">
                  {overviewData.scale.title}
                </h3>
              </div>
              <p className="mt-4 text-base leading-7 text-gray-600">
                {overviewData.scale.description}
              </p>
              <ul className="mt-6 space-y-2">
                {overviewData.scale.details.map((detail, index) => (
                  <li key={index} className="text-sm text-gray-600">
                    • {detail}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-start">
            <div className="rounded-2xl bg-gray-50 p-8 shadow-sm ring-1 ring-gray-300">
              <div className="flex items-center gap-x-3">
                <h3 className="text-lg font-semibold leading-8 tracking-tight text-gray-800">
                  {overviewData.layout.title}
                </h3>
              </div>
              <p className="mt-4 text-base leading-7 text-gray-600">
                {overviewData.layout.description}
              </p>
              <ul className="mt-6 space-y-2">
                {overviewData.layout.details.map((detail, index) => (
                  <li key={index} className="text-sm text-gray-600">
                    • {detail}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-start">
            <div className="rounded-2xl bg-gray-50 p-8 shadow-sm ring-1 ring-gray-300">
              <div className="flex items-center gap-x-3">
                <h3 className="text-lg font-semibold leading-8 tracking-tight text-gray-800">
                  {overviewData.features.title}
                </h3>
              </div>
              <p className="mt-4 text-base leading-7 text-gray-600">
                {overviewData.features.description}
              </p>
              <ul className="mt-6 space-y-2">
                {overviewData.features.details.map((detail, index) => (
                  <li key={index} className="text-sm text-gray-600">
                    • {detail}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
