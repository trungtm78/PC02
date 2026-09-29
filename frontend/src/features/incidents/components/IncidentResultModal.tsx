import { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { incidentResult } from '@/locales/vi';

interface IncidentResultModalProps {
  incidentId: string;
  code: string;
  value: string;
  updatedAt: string;
  onClose: () => void;
  onSaved: () => void;
}

export function IncidentResultModal({
  incidentId,
  code,
  value,
  updatedAt,
  onClose,
  onSaved,
}: IncidentResultModalProps) {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setText(value), [value]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/incidents/${incidentId}/result`, {
        ketQuaXuLy: text.trim() || null,
        expectedUpdatedAt: updatedAt,
      });
      onSaved();
      onClose();
    } catch (cause) {
      setError(extractApiError(cause, incidentResult.saveError).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="incident-result-title">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="incident-result-title" className="font-bold text-slate-800">{incidentResult.title(code)}</h2>
          <button type="button" onClick={onClose} aria-label={incidentResult.close} className="p-2 text-slate-500 hover:text-slate-800">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="space-y-3 p-6">
          <label htmlFor="incident-result-input" className="block text-sm font-medium text-slate-700">{incidentResult.label}</label>
          <textarea
            id="incident-result-input"
            data-testid="incident-result-input"
            rows={6}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
        <footer className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50">{incidentResult.close}</button>
          <button type="button" data-testid="incident-result-save" disabled={saving} onClick={() => void save()} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60">
            <Save className="h-4 w-4" />
            {saving ? incidentResult.saving : incidentResult.save}
          </button>
        </footer>
      </div>
    </div>
  );
}
