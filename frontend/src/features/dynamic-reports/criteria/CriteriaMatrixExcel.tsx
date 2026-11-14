/**
 * "Ma trận tiêu chí bằng file Excel": take the criteria-by-team matrix of a report out as a workbook, edit the marks
 * in Excel, put it back. Putting it back is two steps on purpose: the file is first only READ and what it would
 * change is shown per team; nothing changes until "Áp dụng", which sends the same file again with the revision the
 * preview was shown at.
 */
import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Upload } from 'lucide-react';
import { dynamicReportsApi } from '../api';
import type { CriteriaMatrixError, CriteriaMatrixImportResult } from '../types';
import { extractApiError } from '@/lib/api-errors';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import { matrixErrorText, reportCriteria } from '@/locales/reportCriteria.vi';
import { parseMatrixErrors, summariseMatrixPreview } from './criteriaMatrix';

const t = reportCriteria.matrix;

interface Props {
  reportId: string;
  reportCode: string;
  /** The revision of the report on screen: what a preview is checked against. */
  configVersion: number;
  /** A criterion's name by its item key, to name a criterion the file lost. */
  criterionName: (itemKey: string) => string;
  /** The matrix was applied: the report must be read again. */
  onApplied: () => Promise<void> | void;
  /** Somebody else changed the report: read it again. */
  onReload: () => Promise<void> | void;
  /** True while another part of the screen is saving. */
  disabled?: boolean;
}

interface Refusal {
  /** Reasons the file itself is wrong, in plain words. */
  reasons: string[];
  /** Any other refusal, as one line. */
  message: string | null;
  conflict: boolean;
}

function toRefusal(err: unknown, criterionName: (itemKey: string) => string): Refusal {
  const e = extractApiError(err);
  if (e.code === 'REVISION_CONFLICT') return { reasons: [], message: t.conflict, conflict: true };
  // The FILE is behind the report (taken out before its last change). The screen may be behind too: offer the reload.
  if (e.code === 'MATRIX_FILE_STALE') return { reasons: [], message: t.fileStale, conflict: true };
  if (e.code === 'MATRIX_FILE_MISSING') return { reasons: [], message: t.fileMissing, conflict: false };
  if (e.code === 'CRITERIA_MATRIX_INVALID') {
    const known: CriteriaMatrixError[] = parseMatrixErrors(e.messages);
    if (known.length > 0) {
      return { reasons: known.map((k) => matrixErrorText(k, criterionName)), message: null, conflict: false };
    }
    // Refused for a reason this screen does not know: the first reason is still the honest thing to say.
    return { reasons: [t.errors.MATRIX_NOT_RECOGNISED], message: null, conflict: false };
  }
  return { reasons: [], message: e.message || reportCriteria.errorFallback, conflict: e.status === 409 };
}

export default function CriteriaMatrixExcel({
  reportId,
  reportCode,
  configVersion,
  criterionName,
  onApplied,
  onReload,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<'download' | 'read' | 'apply' | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CriteriaMatrixImportResult | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const summary = preview ? summariseMatrixPreview(preview.teams) : null;
  const locked = disabled || busy !== null;

  function clearPreview() {
    setFile(null);
    setPreview(null);
  }

  async function download() {
    setBusy('download');
    setRefusal(null);
    setDone(null);
    try {
      await dynamicReportsApi.downloadCriteriaMatrix(reportId, t.fallbackFileName(reportCode));
    } catch (err) {
      setRefusal(toRefusal(err, criterionName));
    } finally {
      setBusy(null);
    }
  }

  async function read(picked: File) {
    setBusy('read');
    setRefusal(null);
    setDone(null);
    setPreview(null);
    setFile(picked);
    try {
      setPreview(await dynamicReportsApi.uploadCriteriaMatrix(reportId, picked, { apply: false, expectedConfigVersion: configVersion }));
    } catch (err) {
      setFile(null);
      setRefusal(toRefusal(err, criterionName));
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    // Only what was previewed can be applied: the same file, at the revision the preview was shown at.
    if (!file || !preview || !summary?.hasChanges) return;
    setBusy('apply');
    setRefusal(null);
    try {
      const result = await dynamicReportsApi.uploadCriteriaMatrix(reportId, file, {
        apply: true,
        expectedConfigVersion: preview.configVersion,
      });
      clearPreview();
      setDone(t.applied(summariseMatrixPreview(result.teams).changedTeams));
      await onApplied();
    } catch (err) {
      const refused = toRefusal(err, criterionName);
      // The preview was of a revision that is gone: it must be made again from the report as it is now.
      if (refused.conflict) clearPreview();
      setRefusal(refused);
    } finally {
      setBusy(null);
    }
  }

  const button = `inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 disabled:opacity-50 ${A11Y_FOCUS_RING}`;

  return (
    <div className="mt-4 border-t border-slate-100 pt-3" data-testid="criteria-matrix-excel">
      <h3 className="text-sm font-semibold text-slate-700">{t.heading}</h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-2">{t.hint}</p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" data-testid="btn-matrix-download" disabled={locked} onClick={() => void download()} className={button}>
          <Download className="w-4 h-4" />
          {busy === 'download' ? t.downloading : t.download}
        </button>
        <button
          type="button"
          data-testid="btn-matrix-upload"
          disabled={locked}
          onClick={() => inputRef.current?.click()}
          className={button}
        >
          <Upload className="w-4 h-4" />
          {busy === 'read' ? t.reading : t.upload}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="sr-only"
          tabIndex={-1}
          aria-label={t.fileLabel}
          data-testid="matrix-file-input"
          disabled={locked}
          onChange={(e) => {
            const picked = e.target.files?.[0];
            // The same file picked again after a correction must be read again.
            e.target.value = '';
            if (picked) void read(picked);
          }}
        />
      </div>

      {done && (
        <p className="flex items-center gap-1 text-sm text-green-800 mt-2" data-testid="matrix-applied" role="status">
          <CheckCircle2 className="w-4 h-4" />
          {done}
        </p>
      )}

      {refusal && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2 text-sm text-red-700" data-testid="matrix-error" role="alert">
          {refusal.message && (
            <p className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {refusal.message}
            </p>
          )}
          {refusal.reasons.length > 0 && (
            <>
              <p className="font-medium">{t.errorHeading}</p>
              <ul className="list-disc ml-5 mt-1" data-testid="matrix-error-list">
                {refusal.reasons.map((reason, i) => (
                  <li key={`${i}-${reason}`}>{reason}</li>
                ))}
              </ul>
            </>
          )}
          {refusal.conflict && (
            <button
              type="button"
              data-testid="btn-matrix-reload"
              onClick={() => {
                clearPreview();
                setRefusal(null);
                void onReload();
              }}
              className={`mt-2 px-3 py-1 border border-red-300 rounded-lg hover:bg-red-100 ${A11Y_FOCUS_RING}`}
            >
              {t.reload}
            </button>
          )}
        </div>
      )}

      {preview && summary && file && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 mt-2" data-testid="matrix-preview">
          <p className="text-sm font-medium text-slate-800">{t.previewHeading(file.name)}</p>
          <p className="text-xs text-slate-600 mb-2" data-testid="matrix-preview-summary">
            {t.summary(summary.changedTeams, summary.teams.length)}
          </p>
          <ul className="text-sm space-y-0.5">
            {summary.teams.map((team) => (
              <li
                key={team.teamId}
                data-testid={`matrix-preview-team-${team.teamId}`}
                data-changed={team.changed ? 'true' : 'false'}
                className={team.changed ? 'text-slate-800' : 'text-slate-400'}
              >
                <span className="font-medium">{team.name}</span>: {team.changed ? t.teamChange(team.added, team.removed) : t.teamUnchanged}
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-800 mt-2" data-testid="matrix-preview-note">
            {summary.hasChanges ? t.unsavedNote : t.nothingToApply}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              data-testid="btn-matrix-apply"
              disabled={locked || !summary.hasChanges}
              onClick={() => void apply()}
              className={`px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
            >
              {busy === 'apply' ? t.applying : t.apply}
            </button>
            <button
              type="button"
              data-testid="btn-matrix-cancel"
              disabled={busy !== null}
              onClick={clearPreview}
              className={`px-3 py-1.5 text-sm text-slate-600 hover:bg-white rounded-lg disabled:opacity-50 ${A11Y_FOCUS_RING}`}
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
