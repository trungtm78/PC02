import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, X } from 'lucide-react';
import { extractApiError } from '@/lib/api-errors';
import { teams as L } from '@/locales/vi';
import { conflictsOf, wardChargesApi, WARD_CHARGE_IMPORT_MAX_BYTES, type ImportIssue, type ImportPreview } from './ward-charges.api';

const I = L.wardCharges.import;
const issueText = (issue: ImportIssue) => (I.issues[issue.code] ?? (() => issue.code))(issue);

/**
 * "Nhập từ Excel": step 1 uploads the file and gets a preview (nothing is written); step 2 shows every row with its
 * errors and warnings, and confirms. A preview with errors cannot be confirmed: the person fixes the file.
 * Modelled on BulkImportWizard.
 */
export function WardChargeImportDialog({ onClose, onDone }: { onClose: () => void; onDone: (text: string) => void }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const failure = (err: unknown, fallback: string) => {
    const { code } = extractApiError(err, fallback);
    if (code === 'TEAM_WARD_ALREADY_CHARGED') {
      const list = conflictsOf(err).map((c) => L.wardCharges.conflict(c.wardName, c.teamName));
      return `${L.wardCharges.conflictTitle}: ${list.join('; ')}`;
    }
    return (code && L.wardCharges.errors[code]) || fallback;
  };

  const pick = (f: File | null) => {
    setError('');
    if (f && f.size > WARD_CHARGE_IMPORT_MAX_BYTES) {
      setFile(null);
      setError(I.tooLarge);
      return;
    }
    setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      setPreview(await wardChargesApi.preview(file));
    } catch (err) {
      setError(failure(err, I.failed));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      const r = await wardChargesApi.confirm(preview.previewToken, replace);
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      onDone(I.done(r.added, r.moved, r.removed));
    } catch (err) {
      setError(failure(err, I.failed));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" aria-label={I.title} data-testid="ward-charge-import" className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800">{I.title}</h2>
          <button type="button" onClick={onClose} aria-label={I.cancel} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!preview ? (
          <div data-testid="ward-charge-import-step1">
            <p className="text-sm font-semibold text-slate-700">{I.step1}</p>
            <p className="mt-1 text-xs text-slate-500">{I.fileHint}</p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <FileSpreadsheet className="w-5 h-5 text-green-700" />
              <span className="sr-only">{I.choose}</span>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                data-testid="ward-charge-import-file"
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                data-testid="ward-charge-import-upload"
                onClick={() => void upload()}
                disabled={!file || busy}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-md disabled:opacity-50"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {busy ? I.uploading : I.upload}
              </button>
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border border-slate-300 rounded-md">
                {I.cancel}
              </button>
            </div>
          </div>
        ) : (
          <div data-testid="ward-charge-import-step2">
            <p className="text-sm font-semibold text-slate-700">{I.step2}</p>
            <p className="mt-1 text-sm text-slate-600" data-testid="ward-charge-import-summary">
              {I.summary(preview.totals.rows, preview.totals.wards, preview.totals.errors, preview.totals.warnings)}
            </p>
            <table className="mt-3 w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500">
                  <th className="w-14 border px-2 py-1">{I.colRow}</th>
                  <th className="w-48 border px-2 py-1">{I.colTeam}</th>
                  <th className="border px-2 py-1">{I.colWards}</th>
                  <th className="w-72 border px-2 py-1">{I.colIssues}</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber} data-testid={`ward-charge-import-row-${row.rowNumber}`} className={row.errors.length ? 'bg-red-50' : ''}>
                    <td className="border px-2 py-1 align-top">{row.rowNumber}</td>
                    <td className="border px-2 py-1 align-top">{row.teamName}</td>
                    <td className="border px-2 py-1 align-top">{row.wards.map((w) => w.wardName ?? w.name).join(', ')}</td>
                    <td className="border px-2 py-1 align-top">
                      {row.errors.length === 0 && row.warnings.length === 0 && (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {I.ok}
                        </span>
                      )}
                      <ul>
                        {row.errors.map((e, i) => (
                          <li key={`e${i}`} className="text-red-700" data-testid="ward-charge-import-error">
                            {issueText(e)}
                          </li>
                        ))}
                        {row.warnings.map((w, i) => (
                          <li key={`w${i}`} className="text-amber-700 flex items-start gap-1" data-testid="ward-charge-import-warning">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            {issueText(w)}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!preview.canConfirm && (
              <p role="alert" className="mt-3 text-sm text-red-700" data-testid="ward-charge-import-blocked">
                {I.blocked}
              </p>
            )}
            <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
                data-testid="ward-charge-import-replace"
                className="mt-0.5"
              />
              <span>
                {I.replace}
                <span className="block text-xs text-slate-500">{I.replaceHint}</span>
              </span>
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                data-testid="ward-charge-import-confirm"
                onClick={() => void confirm()}
                disabled={!preview.canConfirm || busy}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-md disabled:opacity-50"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {busy ? I.confirming : I.confirm}
              </button>
              <button
                type="button"
                data-testid="ward-charge-import-back"
                onClick={() => {
                  setPreview(null);
                  setFile(null);
                  setError('');
                }}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-md"
              >
                {I.back}
              </button>
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border border-slate-300 rounded-md">
                {I.cancel}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700" data-testid="ward-charge-import-failed">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
