'use client';

import { useState } from 'react';

interface Props {
  buttonLabel: string;
  onSubmit: (note: string) => Promise<void>;
}

/** 「対応した」「入れ替えた」を記録する欄（メモは任意） */
export default function OpsRecordForm({ buttonLabel, onSubmit }: Props) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col sm:flex-row gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
          await onSubmit(note);
          setNote('');
        } catch (e) {
          setError(e instanceof Error ? e.message : '記録できませんでした');
        } finally {
          setSaving(false);
        }
      }}
    >
      <input
        type="text"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={500}
        placeholder="メモ（任意）"
        aria-label="メモ（任意）"
        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={saving}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded"
      >
        {saving ? '記録中...' : buttonLabel}
      </button>
      {error && <p className="text-sm text-red-700 sm:self-center">{error}</p>}
    </form>
  );
}
