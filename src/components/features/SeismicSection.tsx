import { featuresSections } from './data';
import { SeismicScale } from './SeismicScale';

const seismicData = {
  title: '高い耐震性能と安全性',
  description:
    'かわつる三芳野団地の建物は、専門機関の耐震診断で Is値0.6以上と判定されています。Is値0.6以上は、震度6強〜7程度の大規模な地震に対して「倒壊または崩壊する危険性が低い」とされる水準です。この診断結果は、第三者機関（JASO）の評定を受けています。',
  performance: {
    level: 'Is0.6以上（耐震診断の結果）',
    standard: '同等の耐震性能（耐震診断による）',
    description:
      'Is値0.6以上は、震度6強〜7程度の大規模な地震に対して「倒壊または崩壊する危険性が低い」と判定される水準で、1981年（昭和56年）に定められた新耐震基準と同等の耐震性能があるとされています。',
  },
  certification: {
    organization: '特定非営利活動法人 耐震総合安全機構 JASO',
    number: 'JASO 評定 No.23133',
    date: '2023年7月3日',
    format: '評定6号様式',
    description:
      '一級建築士事務所 空間設計が実施した耐震診断報告書について、JASOの判定会議において審査が行われ、「建築物の耐震改修の促進に関する法律」及び同法に基づく技術指針に照らし、「妥当なものであると認める」旨の評定を受けています。',
  },
  valueProposition: {
    title: '客観的な資料で確かめられる安心',
    text: '耐震診断の報告書と第三者機関（JASO）の評定がそろっているため、建物の耐震性能を客観的な資料で確かめられます。住まいを選ぶときや売却するときにも、建物の安全性を説明する材料になります。',
  },
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
          <div className="mb-8">
            <SeismicScale />
          </div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* 耐震性能 */}
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 border-l-4 border-purple-600">
              <div className="flex items-center gap-x-3 mb-6">
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
                    新耐震基準
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

          {/* 耐震診断の資料について */}
          <div className="mt-8">
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
              <div className="bg-purple-50 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      {seismicData.valueProposition.title}
                    </h4>
                    <p className="text-sm leading-6 text-gray-700">
                      {seismicData.valueProposition.text}
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
