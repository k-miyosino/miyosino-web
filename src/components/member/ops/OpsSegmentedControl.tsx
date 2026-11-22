'use client';

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  /** 選ばれているときの色（省略すると濃い灰色） */
  activeClassName?: string;
}

/**
 * 横に並んだ切り替えボタン（評価の種類、質問ログの絞り込み、見直しの状態など）。
 * まとまりは <fieldset> で表し、名前は画面に出さない <legend> で読み上げソフトに伝える
 */
export default function OpsSegmentedControl<T extends string>({
  legend,
  options,
  value,
  onChange,
}: Readonly<{
  legend: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
}>) {
  return (
    <fieldset className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
      <legend className="sr-only">{legend}</legend>
      {options.map(({ id, label, activeClassName }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={`px-3 py-1 ${
            value === id
              ? (activeClassName ?? 'bg-slate-800 text-white')
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}
