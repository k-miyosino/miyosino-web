'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  OfficeInputError,
  fetchOfficeUnits,
  submitOfficeProxyApplication,
} from '@/repositories/office/officeRepository';
import { OfficeApplicationType, OfficeUnit } from '@/types/office';
import { groupUnitsByBuilding, ownerName } from './officeUnits';
import {
  ProxyDraft,
  STEP_TITLES,
  applicantKindsFor,
  confirmRows,
  emptyDraft,
  newSubmitKey,
  stepsFor,
  toProxyInput,
  todayLocal,
  validateStep,
} from './officeProxy';

interface Props {
  /** トップに戻る */
  onDone: () => void;
}

const INPUT_CLASS =
  'w-full text-lg border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-blue-700 focus:outline-none';
const LABEL_CLASS = 'flex flex-col gap-2 text-lg font-medium';

/**
 * 紙の申請を入力する（事務員専用ページ。OFFICE.md 7-3）。
 * 1 画面に 1 つの質問で進め、最後に確認画面を出してから送る。戻っても入力は消えない。
 * 名義変更は紙の「組合員名義変更届」の順番に並べる
 */
export default function OfficeProxyForm({ onDone }: Props) {
  const today = useMemo(() => todayLocal(), []);
  const [draft, setDraft] = useState<ProxyDraft>(() => emptyDraft(today));
  // 送り直しても同じキーを使い、二重に登録されないようにする
  const [submitKey] = useState(() => newSubmitKey());
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const steps = stepsFor(draft.type);
  const step = steps[stepIndex];
  const update = (patch: Partial<ProxyDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const goNext = () => {
    const problems = validateStep(draft, step, today);
    setErrors(problems);
    if (problems.length === 0) setStepIndex((i) => i + 1);
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
      const result = await submitOfficeProxyApplication(
        toProxyInput(draft, submitKey)
      );
      setCreatedId(result.id);
    } catch (e) {
      setErrors(
        e instanceof OfficeInputError
          ? e.messages
          : [
              '登録できませんでした。通信の状態を確かめて、もう一度「登録する」を押してください（二重には登録されません）。',
            ]
      );
    } finally {
      setSending(false);
    }
  };

  if (createdId) {
    return (
      <section className="flex flex-col gap-6 text-gray-900">
        <div className="bg-green-50 border-2 border-green-700 rounded-2xl p-6 sm:p-8 flex flex-col gap-3">
          <h2 className="text-2xl font-bold">登録しました</h2>
          <p className="text-xl">
            申請番号 <span className="text-3xl font-bold">{createdId}</span>
          </p>
          <p className="text-lg">
            紙の申請書の上の余白に、この申請番号を書いて保管してください。申請は「新規申し込みリスト」に入りました。
          </p>
        </div>
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

  return (
    <section className="flex flex-col gap-6 text-gray-900">
      <div className="flex flex-col gap-1">
        <p className="text-base text-gray-600">
          紙の申請を入力する ・ いま {stepIndex + 1} / {steps.length}
        </p>
        <h2 className="text-2xl font-bold">{STEP_TITLES[step]}</h2>
      </div>

      <div className="bg-white border border-gray-300 rounded-2xl p-6 sm:p-8 flex flex-col gap-6">
        {step === 'type' && (
          <TypeStep
            value={draft.type}
            onChange={(type) =>
              // 種類を変えたら、種類で変わる「申請した人」の選び方を空に戻す
              update({ type, applicantKind: null })
            }
          />
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
        {step === 'applicant' && (
          <>
            <label className={LABEL_CLASS}>
              届出日（申請書のいちばん上の日付）
              <input
                type="date"
                value={draft.submittedDate}
                max={today}
                onChange={(e) => update({ submittedDate: e.target.value })}
                className={`${INPUT_CLASS} max-w-xs`}
              />
            </label>
            <fieldset className="flex flex-col gap-3">
              <legend className="text-lg font-medium mb-2">
                窓口に来て申請した人
              </legend>
              <div className="flex flex-wrap gap-3">
                {applicantKindsFor(draft.type).map((kind) => (
                  <ChoiceButton
                    key={kind}
                    selected={draft.applicantKind === kind}
                    onClick={() => update({ applicantKind: kind })}
                  >
                    {kind === '組合員'
                      ? draft.type === '名義変更'
                        ? '旧組合員本人'
                        : '組合員本人'
                      : kind === '購入者'
                        ? '新しい組合員（購入者など）'
                        : '代理人'}
                  </ChoiceButton>
                ))}
              </div>
            </fieldset>
            {draft.applicantKind === '代理人' && (
              <label className={LABEL_CLASS}>
                代理人の氏名と続柄（または会社名）
                <input
                  type="text"
                  value={draft.agent}
                  maxLength={100}
                  placeholder="例: 山田 一郎（長男）"
                  onChange={(e) => update({ agent: e.target.value })}
                  className={INPUT_CLASS}
                />
              </label>
            )}
          </>
        )}
        {step === 'newName' && (
          <label className={LABEL_CLASS}>
            {draft.type === '名義変更'
              ? '新しい組合員の氏名'
              : `変更後の氏名（いまの登録: ${draft.ownerDisplay}）`}
            <input
              type="text"
              value={draft.newName}
              maxLength={50}
              onChange={(e) => update({ newName: e.target.value })}
              className={INPUT_CLASS}
            />
          </label>
        )}
        {step === 'dates' && (
          <>
            <label className={LABEL_CLASS}>
              新しい組合員の負担となる日（組合費・修繕積立金の支払いが切り替わる日）
              <input
                type="date"
                value={draft.switchDate}
                onChange={(e) => update({ switchDate: e.target.value })}
                className={`${INPUT_CLASS} max-w-xs`}
              />
            </label>
            <label className={LABEL_CLASS}>
              所有名義変更月日
              <input
                type="date"
                value={draft.transferDate}
                onChange={(e) => update({ transferDate: e.target.value })}
                className={`${INPUT_CLASS} max-w-xs`}
              />
            </label>
            <label className={LABEL_CLASS}>
              新しい組合員の入居（予定）日（書いていなければ空のまま）
              <input
                type="date"
                value={draft.moveInDate}
                onChange={(e) => update({ moveInDate: e.target.value })}
                className={`${INPUT_CLASS} max-w-xs`}
              />
            </label>
          </>
        )}
        {step === 'oldContact' && (
          <ContactFields
            address={draft.oldAddress}
            phone={draft.oldPhone}
            onAddress={(oldAddress) => update({ oldAddress })}
            onPhone={(oldPhone) => update({ oldPhone })}
          />
        )}
        {step === 'newContact' && (
          <ContactFields
            address={draft.newAddress}
            phone={draft.newPhone}
            onAddress={(newAddress) => update({ newAddress })}
            onPhone={(newPhone) => update({ newPhone })}
          />
        )}
        {step === 'confirm' && (
          <>
            <p className="text-lg">
              紙の申請書と見比べて、まちがいがなければ「登録する」を押してください。
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-[16em_1fr] gap-x-6 gap-y-3 text-lg">
              {confirmRows(draft).map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-gray-600">{label}</dt>
                  <dd className="font-medium break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
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
            className="text-xl font-bold min-h-14 px-10 rounded-xl bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {sending ? '登録しています...' : '登録する'}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="text-xl font-bold min-h-14 px-10 rounded-xl bg-blue-700 text-white hover:bg-blue-800"
          >
            次へ →
          </button>
        )}
      </div>
    </section>
  );
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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

const TYPE_CHOICES: {
  type: OfficeApplicationType;
  title: string;
  note: string;
}[] = [
  {
    type: '名義変更',
    title: '組合員名義変更届',
    note: 'お部屋を売った・譲った・相続したとき（旧組合員と新しい組合員の連名）',
  },
  {
    type: '情報変更',
    title: '氏名の変更',
    note: '組合員の氏名が変わったとき',
  },
];

function TypeStep({
  value,
  onChange,
}: {
  value: OfficeApplicationType | null;
  onChange: (type: OfficeApplicationType) => void;
}) {
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
}: {
  value: string;
  onChange: (unit: OfficeUnit) => void;
}) {
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

function ContactFields({
  address,
  phone,
  onAddress,
  onPhone,
}: {
  address: string;
  phone: string;
  onAddress: (value: string) => void;
  onPhone: (value: string) => void;
}) {
  return (
    <>
      <p className="text-base text-gray-600">
        申請書に書いていなければ、空のまま「次へ」を押してください。
      </p>
      <label className={LABEL_CLASS}>
        住所
        <textarea
          value={address}
          maxLength={200}
          rows={3}
          onChange={(e) => onAddress(e.target.value)}
          className={INPUT_CLASS}
        />
      </label>
      <label className={LABEL_CLASS}>
        電話番号
        <input
          type="tel"
          value={phone}
          maxLength={20}
          onChange={(e) => onPhone(e.target.value)}
          className={`${INPUT_CLASS} max-w-xs`}
        />
      </label>
    </>
  );
}
