'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  OfficeInputError,
  applyOfficeLedger,
  fetchOfficeUnits,
  previewOfficeLedger,
} from '@/repositories/office/officeRepository';
import {
  OfficeLedgerPreview,
  OfficeLedgerResult,
  OfficeLedgerType,
  OfficeUnit,
} from '@/types/office';
import { groupUnitsByBuilding, ownerName } from './officeUnits';
import {
  LedgerDraft,
  STEP_TITLES,
  emptyDraft,
  newSubmitKey,
  propertyCode,
  stepsFor,
  toLedgerInput,
  validateStep,
} from './officeLedger';

interface Props {
  /** トップに戻る */
  onDone: () => void;
}

const INPUT_CLASS =
  'w-full text-lg border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-blue-700 focus:outline-none';
const LABEL_CLASS = 'flex flex-col gap-2 text-lg font-medium';
const PRIMARY_BUTTON =
  'text-xl font-bold min-h-14 px-10 rounded-xl bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50';

function errorMessages(e: unknown, fallback: string): string[] {
  return e instanceof OfficeInputError ? e.messages : [fallback];
}

/**
 * 台帳を更新する（事務員専用ページ。OFFICE.md 0-5）。
 * 1 画面に 1 つの質問で進め、確認画面で「台帳がこう変わります」を見せてから反映する。戻っても入力は消えない。
 * 名義変更は、管理者が先に新しい組合員の Kintone ユーザーを作っておく（0-2）
 */
export default function OfficeLedgerForm({ onDone }: Readonly<Props>) {
  const [draft, setDraft] = useState<LedgerDraft>(() => emptyDraft());
  // 送り直しても同じキーを使い、二重に反映されないようにする
  const [submitKey] = useState(() => newSubmitKey());
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<OfficeLedgerPreview | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<OfficeLedgerResult | null>(null);

  const steps = stepsFor(draft.type);
  const step = steps[stepIndex];
  const update = (patch: Partial<LedgerDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const goNext = async () => {
    const problems = validateStep(draft, step);
    setErrors(problems);
    if (problems.length > 0) return;
    if (steps[stepIndex + 1] !== 'confirm') {
      setStepIndex((i) => i + 1);
      return;
    }
    // 確認画面の前に、台帳がどう変わるかを Worker に確かめる（書き込まない）
    setSending(true);
    try {
      setPreview(await previewOfficeLedger(toLedgerInput(draft, submitKey)));
      setStepIndex((i) => i + 1);
    } catch (e) {
      setErrors(
        errorMessages(
          e,
          '台帳の確認ができませんでした。時間をおいて、もう一度「次へ」を押してください。'
        )
      );
    } finally {
      setSending(false);
    }
  };

  const goBack = () => {
    setErrors([]);
    if (stepIndex === 0) onDone();
    else setStepIndex((i) => i - 1);
  };

  const send = async () => {
    setSending(true);
    setErrors([]);
    try {
      setResult(await applyOfficeLedger(toLedgerInput(draft, submitKey)));
    } catch (e) {
      setErrors(
        errorMessages(
          e,
          '台帳に反映できませんでした。通信の状態を確かめて、もう一度「台帳に反映する」を押してください（二重には反映されません）。'
        )
      );
    } finally {
      setSending(false);
    }
  };

  if (result) {
    return (
      <LedgerDone
        result={result}
        notices={result.notices ?? preview?.notices ?? []}
        onDone={onDone}
      />
    );
  }

  return (
    <section className="flex flex-col gap-6 text-gray-900">
      <div className="flex flex-col gap-1">
        <p className="text-base text-gray-600">
          台帳を更新する ・ いま {stepIndex + 1} / {steps.length}
        </p>
        <h2 className="text-2xl font-bold">{STEP_TITLES[step]}</h2>
      </div>

      <div className="bg-white border border-gray-300 rounded-2xl p-6 sm:p-8 flex flex-col gap-6">
        {step === 'type' && (
          <TypeStep value={draft.type} onChange={(type) => update({ type })} />
        )}
        {step === 'unit' && (
          <UnitStep
            value={draft.propertyName}
            onChange={(unit) =>
              update({
                propertyName: unit.name,
                ownerDisplay:
                  unit.owner && !unit.ownerConflict ? unit.owner.display : '',
              })
            }
          />
        )}
        {step === 'newName' && (
          <label className={LABEL_CLASS}>
            <span>
              {draft.type === '名義変更'
                ? '新しい組合員の氏名（姓と名。名義変更届の「新」の氏名）'
                : `変更後の氏名（姓と名。いまの登録: ${draft.ownerDisplay}）`}
            </span>
            <input
              type="text"
              value={draft.newName}
              maxLength={50}
              onChange={(e) => update({ newName: e.target.value })}
              className={INPUT_CLASS}
            />
            <span className="text-base font-normal text-gray-600">
              姓と名の間は、空けても空けなくてもかまいません。台帳には「
              {draft.propertyName}田中太郎」のように、空けずに入ります。
            </span>
          </label>
        )}
        {step === 'newLogin' && (
          <>
            <p className="text-base text-gray-700 bg-amber-50 rounded-lg px-4 py-3">
              名義変更では、先に管理者が新しい組合員の Kintone
              ユーザーを作ります。まだなら、管理者に頼んでから入力してください。
            </p>
            <label className={LABEL_CLASS}>
              <span>
                管理者から伝えられたログイン名（
                {propertyCode(draft.propertyName)}で始まります）
              </span>
              <input
                type="text"
                inputMode="url"
                autoCapitalize="off"
                autoComplete="off"
                value={draft.newLogin}
                maxLength={64}
                onChange={(e) => update({ newLogin: e.target.value })}
                className={`${INPUT_CLASS} max-w-md font-mono`}
              />
            </label>
          </>
        )}
        {step === 'dates' && (
          <>
            <label className={LABEL_CLASS}>
              <span>
                新しい組合員の負担となる日（組合費・修繕積立金の支払いが切り替わる日）
              </span>
              <input
                type="date"
                value={draft.switchDate}
                onChange={(e) => update({ switchDate: e.target.value })}
                className={`${INPUT_CLASS} max-w-xs`}
              />
            </label>
            <label className={LABEL_CLASS}>
              <span>所有名義変更月日（記録として残すだけ）</span>
              <input
                type="date"
                value={draft.transferDate}
                onChange={(e) => update({ transferDate: e.target.value })}
                className={`${INPUT_CLASS} max-w-xs`}
              />
            </label>
          </>
        )}
        {step === 'confirm' && preview && <ConfirmStep preview={preview} />}
      </div>

      {errors.length > 0 && (
        <div
          role="alert"
          className="bg-red-50 border border-red-300 text-red-900 rounded-lg p-4 text-lg"
        >
          <ul className="list-disc pl-6">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={goBack}
          disabled={sending}
          className="text-xl font-bold min-h-14 px-6 rounded-xl border-2 border-gray-500 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          {stepIndex === 0 ? 'やめる' : '← 戻る'}
        </button>
        {step === 'confirm' ? (
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className={PRIMARY_BUTTON}
          >
            {sending ? '反映しています...' : '台帳に反映する'}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={sending}
            className={PRIMARY_BUTTON}
          >
            {sending ? '確かめています...' : '次へ →'}
          </button>
        )}
      </div>
    </section>
  );
}

function ConfirmStep({ preview }: Readonly<{ preview: OfficeLedgerPreview }>) {
  return (
    <>
      <p className="text-lg">
        紙の届と見比べて、まちがいがなければ「台帳に反映する」を押してください。反映したあとも、今日のうちなら取り消せます。
      </p>
      <ol className="list-decimal pl-7 flex flex-col gap-2 text-lg">
        {preview.summary.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      {preview.warnings.map((warning) => (
        <p
          key={warning}
          className="text-base text-amber-900 bg-amber-50 rounded-lg px-4 py-3"
        >
          {warning}
        </p>
      ))}
    </>
  );
}

function LedgerDone({
  result,
  notices,
  onDone,
}: Readonly<{
  result: OfficeLedgerResult;
  notices: string[];
  onDone: () => void;
}>) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(notices.join('\n'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section className="flex flex-col gap-6 text-gray-900">
      <div className="bg-green-50 border-2 border-green-700 rounded-2xl p-6 sm:p-8 flex flex-col gap-3">
        <h2 className="text-2xl font-bold">台帳に反映しました</h2>
        <p className="text-xl">
          記録番号 <span className="text-3xl font-bold">{result.logId}</span>
        </p>
        <p className="text-lg">
          紙の届の上の余白に、この記録番号を書いて保管してください。まちがえたときは、今日のうちなら「今日の更新」から取り消せます。
        </p>
      </div>
      {notices.length > 0 && (
        <div className="bg-white border border-gray-300 rounded-2xl p-6 flex flex-col gap-3">
          <h3 className="text-xl font-bold">知らせること</h3>
          <ul className="list-disc pl-6 flex flex-col gap-2 text-lg">
            {notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={copy}
            className="self-start text-lg font-bold min-h-12 px-5 rounded-xl border-2 border-blue-700 text-blue-800 hover:bg-blue-50"
          >
            {copied ? 'コピーしました' : 'まとめてコピーする'}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onDone}
        className="self-start text-xl font-bold min-h-14 px-8 rounded-xl bg-blue-700 text-white hover:bg-blue-800"
      >
        トップに戻る
      </button>
    </section>
  );
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: Readonly<{
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}>) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-14 px-5 rounded-xl border-2 text-lg font-bold transition-colors ${
        selected
          ? 'bg-blue-700 border-blue-700 text-white'
          : 'bg-white border-gray-300 text-gray-900 hover:border-blue-700'
      }`}
    >
      {children}
    </button>
  );
}

const TYPE_CHOICES: { type: OfficeLedgerType; title: string; note: string }[] =
  [
    {
      type: '名義変更',
      title: '名義変更',
      note: '組合員名義変更届を受け取ったとき（お部屋を売った・譲った・相続した）',
    },
    {
      type: '氏名の変更',
      title: '氏名の変更',
      note: '組合員の氏名が変わったとき',
    },
  ];

function TypeStep({
  value,
  onChange,
}: Readonly<{
  value: OfficeLedgerType | null;
  onChange: (type: OfficeLedgerType) => void;
}>) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {TYPE_CHOICES.map((choice) => {
        const selected = value === choice.type;
        return (
          <button
            key={choice.type}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(choice.type)}
            className={`text-left rounded-2xl border-2 p-6 flex flex-col gap-2 min-h-32 transition-colors ${
              selected
                ? 'bg-blue-50 border-blue-700'
                : 'bg-white border-gray-300 hover:border-blue-700'
            }`}
          >
            <span className="text-xl font-bold">
              {selected ? '✓ ' : ''}
              {choice.title}
            </span>
            <span className="text-base text-gray-600">{choice.note}</span>
          </button>
        );
      })}
    </div>
  );
}

function UnitStep({
  value,
  onChange,
}: Readonly<{
  value: string;
  onChange: (unit: OfficeUnit) => void;
}>) {
  const [units, setUnits] = useState<OfficeUnit[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [building, setBuilding] = useState<string | null>(null);

  useEffect(() => {
    fetchOfficeUnits()
      .then((data) => setUnits(data.units))
      .catch(() => setLoadError(true));
  }, []);

  const groups = useMemo(
    () => (units ? groupUnitsByBuilding(units) : []),
    [units]
  );
  const selectedUnit = units?.find((u) => u.name === value);
  const currentBuilding =
    building ?? selectedUnit?.building ?? groups[0]?.building ?? null;
  const current = groups.find((g) => g.building === currentBuilding);

  if (loadError) {
    return (
      <p className="text-lg text-red-900">
        お部屋の一覧を読み込めませんでした。時間をおいて、もう一度開いてください。
      </p>
    );
  }
  if (!units) return <p className="text-lg text-gray-600">読み込み中...</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-lg font-medium">号棟</span>
        <div className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <ChoiceButton
              key={group.building}
              selected={group.building === currentBuilding}
              onClick={() => setBuilding(group.building)}
            >
              {group.building}号棟
            </ChoiceButton>
          ))}
        </div>
      </div>
      {current && (
        <div className="flex flex-col gap-2">
          <span className="text-lg font-medium">部屋番号</span>
          <div className="flex flex-wrap gap-2">
            {current.units.map((unit) => (
              <ChoiceButton
                key={unit.id}
                selected={unit.name === value}
                onClick={() => onChange(unit)}
              >
                {unit.room}
              </ChoiceButton>
            ))}
          </div>
        </div>
      )}
      {selectedUnit && (
        <p className="text-lg bg-blue-50 rounded-lg px-4 py-3">
          {selectedUnit.building}号棟 {selectedUnit.room}号室 ・ いまの組合員:{' '}
          <span className="font-bold">
            {selectedUnit.owner && !selectedUnit.ownerConflict
              ? ownerName(selectedUnit)
              : '（確かめられません）'}
          </span>
        </p>
      )}
    </div>
  );
}
