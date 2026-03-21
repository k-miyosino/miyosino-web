import { featuresSections } from './data';

const seismicData = {
  title: '高い耐震性能と安全性',
  description:
    'かわつる三芳野団地は、新耐震基準に適合し、専門機関による耐震診断により高い耐震性能が確認されています。震度6強（Is0.6以上）の地震にも耐えうる構造となっており、安心して長く住み続けられる安全性の高い建物です。',
  performance: {
    level: 'Is0.6以上（日本の耐震診断基準）',
    standard: '新耐震基準適合',
    description:
      '1981年（昭和56年）に制定された新耐震基準に適合しており、中規模の地震（震度5強程度）では軽微な損傷にとどまり、大規模の地震（震度6強～7）でも「倒壊または崩壊する危険性が低い」と判断される基準値です',
  },
  certification: {
    organization: '特定非営利活動法人 耐震総合安全機構 JASO',
    number: 'JASO 評定 No.23133',
    date: '2023年7月3日',
    format: '評定6号様式',
    description:
      '一級建築士事務所 空間設計が実施した耐震診断報告書について、JASOの判定会議において審査が行われ、「建築物の耐震改修の促進に関する法律」及び同法に基づく技術指針に照らし、「妥当なものであると認める」旨の評定を受けています。',
  },
  valueProposition:
    'このような高い耐震性能は、建物の資産価値に大きく影響します。地震リスクが低い建物は、保険料の優遇や融資条件の改善につながり、長期的な資産価値の維持に寄与します。また、災害時の安全性が確保されていることは、家族の安心と健康を守る重要な要素です。',
};

export function SeismicSection() {
  const sectionMeta = featuresSections.find((s) => s.id === 'seismic');

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
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-600 rounded-lg p-6 shadow-sm">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-start gap-3">
              <span className="text-4xl">{sectionMeta.icon}</span>
              <span>{sectionMeta.title}</span>
            </h2>
            <p className="mt-4 text-lg leading-8 text-gray-600">
              {seismicData.description}
            </p>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-4xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* 耐震性能 */}
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 border-l-4 border-purple-600">
              <div className="flex items-center gap-x-3 mb-6">
                <div className="h-6 w-6 bg-purple-600 rounded"></div>
                <h3 className="text-lg font-semibold leading-8 tracking-tight text-gray-900">
                  耐震性能
                </h3>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    耐震レベル
                  </p>
                  <p className="text-xl font-bold text-purple-600">
                    {seismicData.performance.level}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    基準適合
                  </p>
                  <p className="text-base font-semibold text-gray-900">
                    {seismicData.performance.standard}
                  </p>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm leading-6 text-gray-600">
                    {seismicData.performance.description}
                  </p>
                </div>
              </div>
            </div>

            {/* 耐震診断評定 */}
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 border-l-4 border-purple-600">
              <div className="flex items-center gap-x-3 mb-6">
                <div className="h-6 w-6 bg-purple-600 rounded"></div>
                <h3 className="text-lg font-semibold leading-8 tracking-tight text-gray-900">
                  耐震診断評定
                </h3>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    評定機関
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {seismicData.certification.organization}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    評定番号
                  </p>
                  <p className="text-base font-bold text-purple-600">
                    {seismicData.certification.number}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    評定日
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {seismicData.certification.date}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    評定様式
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {seismicData.certification.format}
                  </p>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs leading-5 text-gray-600">
                    {seismicData.certification.description}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 資産価値への影響 */}
          <div className="mt-8">
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
              <div className="bg-purple-50 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 bg-purple-600 rounded flex-shrink-0 mt-0.5"></div>
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      資産価値への影響
                    </h4>
                    <p className="text-sm leading-6 text-gray-700">
                      {seismicData.valueProposition}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
