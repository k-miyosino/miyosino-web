'use client';

import { featuresSections } from './data';

// かわつる三芳野団地の座標
const LOCATION = {
  lat: 35.922447,
  lng: 139.408901,
};

// 国土地理院の重ねるハザードマップのURLを生成
// 洪水、内水、土砂災害、高潮、津波のレイヤーを表示
const getHazardMapUrl = () => {
  const baseUrl = 'https://disaportal.gsi.go.jp/maps/index.html';
  const params = new URLSearchParams({
    base: 'pale',
    ll: `${LOCATION.lat},${LOCATION.lng}`,
    z: '14', // ズームレベル（14は適度な範囲を表示）
    // 表示レイヤー: 洪水、内水、土砂災害、高潮、津波
    // lsパラメータの順序がdispパラメータのビット位置に対応する
    ls: [
      'tameike_raster,0.8', // ため池決壊想定区域
      'naisui_raster,0.8', // 内水浸水想定区域（位置2）
      'flood_l2_kaokutoukai_kagan,0.8', // 洪水浸水想定区域（想定最大規模）河川沿い（位置3）
      'flood_l2_kaokutoukai_hanran,0.8', // 洪水浸水想定区域（想定最大規模）氾濫（位置4）
      'flood_l2_keizoku,0.8', // 洪水浸水継続時間（位置5）
      'flood_list,0.8', // 洪水浸水想定区域リスト（位置6）
      'flood_l1,0.8', // 洪水浸水想定区域（計画規模）（位置7）
      'flood_list_l2,0.75', // 洪水浸水想定区域リストL2（位置8）
      'dosha_kiken_nadare,0.8', // 土砂災害警戒区域（土石流）（位置9）
      'dosha_keikai_jisuberi,0.8', // 土砂災害警戒区域（急傾斜地の崩壊）（位置10）
      'dosha_keikai_dosekiryu,0.8', // 土砂災害警戒区域（地すべり）（位置11）
      'dosha_keikai_kyukeisha,0.8', // 土砂災害警戒区域（急傾斜地の崩壊・地すべり）（位置12）
      'takashio_sinsuisin_raster,0.8', // 高潮浸水想定区域（位置13）
      'ekijouka_zenkoku,0.8', // 液状化（位置14）
      'tsunamishinsui_raster,0.8', // 津波浸水想定（位置15）
    ].join('|'),
    // dispパラメータ: 各レイヤーのON/OFF制御
    // ビット位置の対応: 左から順に各レイヤーのチェックボックス状態を制御
    // 位置1: tameike_raster = 1 (ON)
    // 位置2: naisui_raster = 1 (ON) ← 内水ON
    // 位置3-8: 洪水関連 = 1 (ON) ← 洪水ON
    // 位置9-12: 土砂災害 = 1 (ON)
    // 位置13: 高潮 = 1 (ON)
    // 位置14: 液状化 = 0 (OFF)
    // 位置15: 津波 = 1 (ON)
    disp: '1111111111111010',
    vs: 'c1j0l0u0t0h0z0',
  });

  return `${baseUrl}?${params.toString()}`;
};

// 団地の場所での想定（2026年11月に「重ねるハザードマップ」で確かめた結果）
type HazardLevel = 'outside' | 'shallow';

const hazardLevelStyles: Record<
  HazardLevel,
  { badge: string; border: string }
> = {
  outside: {
    badge: 'bg-green-100 text-green-800 ring-green-200',
    border: 'border-green-500',
  },
  shallow: {
    badge: 'bg-amber-100 text-amber-800 ring-amber-200',
    border: 'border-amber-400',
  },
};

const hazardMapData = {
  title: '周辺の災害リスク情報',
  description:
    '2026年11月時点の国土地理院「重ねるハザードマップ」では、かわつる三芳野団地は土砂災害・高潮・津波の想定区域に含まれていません。洪水と内水（大雨による浸水）では、団地内の一部で0.0〜0.5m（大人の膝までつかる程度）の浸水が想定されています。ハザードマップは見直されることがあるため、最新の情報は下の地図でご確認ください。',
  checkedAt: '2026年11月',
  risks: [
    {
      type: '洪水',
      level: 'shallow',
      result: '一部で0.0〜0.5m',
      description:
        '想定最大規模の大雨で川があふれた場合、団地内の一部で0.0〜0.5m（大人の膝までつかる程度）の浸水が想定されています。',
    },
    {
      type: '内水',
      level: 'shallow',
      result: '一部で0.0〜0.5m',
      description:
        '下水道や排水路で雨水を流しきれない大雨の場合、団地内の一部で0.0〜0.5m（大人の膝までつかる程度）の浸水が想定されています。',
    },
    {
      type: '土砂災害',
      level: 'outside',
      result: '想定区域外',
      description:
        '確認した時点では、土石流・急傾斜地の崩壊・地すべりの土砂災害警戒区域に含まれていません。',
    },
    {
      type: '高潮',
      level: 'outside',
      result: '想定区域外',
      description:
        '確認した時点では、高潮による浸水想定区域に含まれていません。',
    },
    {
      type: '津波',
      level: 'outside',
      result: '想定区域外',
      description:
        '確認した時点では、津波による浸水想定区域に含まれていません。',
    },
  ] satisfies {
    type: string;
    level: HazardLevel;
    result: string;
    description: string;
  }[],
  note: 'このハザードマップは国土地理院が提供する「重ねるハザードマップ」を使用しています。詳細な情報や最新のデータについては、国土地理院の公式サイトをご確認ください。',
};

export function HazardMapSection() {
  const sectionMeta = featuresSections.find((s) => s.id === 'hazard-map');

  if (!sectionMeta) {
    return null;
  }

  const mapUrl = getHazardMapUrl();

  return (
    <section
      id={sectionMeta.id}
      className="bg-white py-24 sm:py-32 scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12">
          <div className="bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-600 rounded-lg p-6 shadow-sm">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-start gap-3">
              <span className="text-4xl">{sectionMeta.icon}</span>
              <span>{sectionMeta.title}</span>
            </h2>
            <p className="mt-4 text-lg leading-8 text-gray-600">
              {hazardMapData.description}
            </p>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-6xl">
          {/* ハザードマップ埋め込み */}
          <div className="mb-12">
            <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm ring-1 ring-gray-200">
              <div className="aspect-video w-full overflow-hidden rounded-lg">
                <iframe
                  src={mapUrl}
                  className="h-full w-full border-0"
                  title="かわつる三芳野団地周辺のハザードマップ"
                  allowFullScreen
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                />
              </div>
              <p className="mt-4 text-xs text-gray-500 text-center">
                {hazardMapData.note}
              </p>
            </div>
          </div>

          {/* 団地の場所での想定 */}
          <h3 className="mb-2 text-xl font-bold text-gray-900">
            団地の場所での想定
          </h3>
          <p className="mb-6 text-sm text-gray-500">
            {hazardMapData.checkedAt}
            に国土地理院の「重ねるハザードマップ」で確かめた結果です。ハザードマップは見直されることがあるため、最新の情報は上の地図でご確認ください。
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {hazardMapData.risks.map((risk) => {
              const style = hazardLevelStyles[risk.level];
              return (
                <div
                  key={risk.type}
                  className={`rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 border-l-4 ${style.border}`}
                >
                  <h4 className="text-lg font-semibold leading-8 tracking-tight text-gray-900">
                    {risk.type}
                  </h4>
                  <p
                    className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-bold ring-1 ${style.badge}`}
                  >
                    {risk.result}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-gray-600">
                    {risk.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* 防災への取り組み */}
          <div className="mt-8">
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
              <div className="bg-orange-50 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      防災への取り組み
                    </h4>
                    <p className="text-sm leading-6 text-gray-700">
                      かわつる三芳野団地では、自主防災会として防災活動を積極的に実施しています。防災に対する知識の普及、災害等の予防、防災計画の作成、防災訓練の実施、災害等発生時の体制整備、災害後の生活保全、防災用資材の整備など、地域の安全と安心を守るための取り組みを行っています。住民の皆さんと協力し、いざという時に備えた防災体制を構築しています。
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
