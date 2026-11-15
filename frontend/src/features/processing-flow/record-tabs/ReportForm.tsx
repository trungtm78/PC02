/**
 * The form of a report: written new ("Ghi báo cáo") or corrected ("Sửa báo cáo"). Only the work done is required; the
 * proposal is a list of the record kind's own choices. The typed text stays in the form whatever the server answers:
 * it is cleared only when the write went through.
 */
import { useState } from 'react';
import { useDraft } from './draftStore';
import { errorText, processingFlow as L } from '@/locales/processingFlow.vi';
import { PROPOSAL_KINDS } from './codes';
import { EMPTY_REPORT, reportFieldsOf, reportStateOf, type DocRow, type ReportFormState } from './reportFields';
import { FIELD_BOX, FIELD_LABEL, LINK_BUTTON, SMALL_PRIMARY, SMALL_SECONDARY } from './styles';
import type { RecordKind, ReportDto, ReportFields, ReportKind } from './types';

const F = L.recordTabs.results.form;

interface Props {
  recordKind: RecordKind;
  /** The step asks for the leader's approval of a result. */
  requiresApproval: boolean;
  /** A report being corrected; `null` for a new one. */
  editing: ReportDto | null;
  locked: boolean;
  /** Where the typed text is kept while it is not sent (see draftStore). */
  draftKey: string;
  /** Send it. Answers `true` when the write went through (the form then clears or closes). */
  onSubmit: (kind: ReportKind, fields: ReportFields) => Promise<boolean>;
  onCancel?: () => void;
}

export function ReportForm({ recordKind, requiresApproval, editing, locked, draftKey, onSubmit, onCancel }: Props) {
  const [state, setState, clearDraft] = useDraft<ReportFormState>(draftKey, () => (editing ? reportStateOf(editing) : EMPTY_REPORT));
  const [error, setError] = useState<string | null>(null);
  const patch = (next: Partial<ReportFormState>) => setState((prev) => ({ ...prev, ...next }));
  const proposals = PROPOSAL_KINDS[recordKind] ?? [];

  const submit = async () => {
    if (state.doneWork.trim() === '') {
      setError(errorText('REPORT_TEXT_REQUIRED'));
      return;
    }
    setError(null);
    const ok = await onSubmit(state.kind, reportFieldsOf(state, editing !== null));
    if (ok) clearDraft();
  };

  const setDoc = (index: number, next: Partial<DocRow>) => patch({ documents: state.documents.map((d, i) => (i === index ? { ...d, ...next } : d)) });
  const submitLabel = editing
    ? F.submitEdit
    : state.kind === 'PROGRESS'
      ? F.submitProgress
      : requiresApproval
        ? F.submitResultApproval
        : F.submitResult;

  return (
    // Not a <form>: the tab sits inside the record's own form, and a form inside a form is invalid HTML (the inner one is
    // dropped and Enter would save the whole record).
    <div data-testid={editing ? 'report-edit-form' : 'report-form'} role="group" className="flex flex-col gap-3 rounded-lg border border-blue-300 bg-slate-50 p-3">
      <h4 className="text-sm font-semibold text-slate-800">{editing ? F.editTitle : F.title}</h4>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {!editing && (
          <label className={FIELD_LABEL}>
            {F.kind}
            <select data-testid="report-kind" className={FIELD_BOX} value={state.kind} disabled={locked} onChange={(e) => patch({ kind: e.target.value === 'RESULT' ? 'RESULT' : 'PROGRESS' })}>
              <option value="PROGRESS">{L.recordTabs.results.reportKinds.PROGRESS}</option>
              <option value="RESULT">{L.recordTabs.results.reportKinds.RESULT}</option>
            </select>
          </label>
        )}
        {!editing && state.kind === 'RESULT' && (
          <p data-testid="report-result-hint" className="self-end text-xs text-slate-600">
            {requiresApproval ? F.resultHintApproval : F.resultHint}
          </p>
        )}
        <label className={`${FIELD_LABEL} md:col-span-2`}>
          {F.doneWork} <span className="text-red-500">*</span>
          <textarea data-testid="report-done-work" className={`${FIELD_BOX} min-h-[64px]`} value={state.doneWork} disabled={locked} onChange={(e) => patch({ doneWork: e.target.value })} />
        </label>
        <label className={FIELD_LABEL}>
          {F.findings}
          <textarea data-testid="report-findings" className={`${FIELD_BOX} min-h-[64px]`} value={state.findings} disabled={locked} onChange={(e) => patch({ findings: e.target.value })} />
        </label>
        <label className={FIELD_LABEL}>
          {F.difficulties}
          <textarea data-testid="report-difficulties" className={`${FIELD_BOX} min-h-[64px]`} value={state.difficulties} disabled={locked} onChange={(e) => patch({ difficulties: e.target.value })} />
        </label>
        <label className={FIELD_LABEL}>
          {F.proposalKind}
          <select data-testid="report-proposal-kind" className={FIELD_BOX} value={state.proposalKind} disabled={locked} onChange={(e) => patch({ proposalKind: e.target.value })}>
            <option value="">{F.proposalNone}</option>
            {proposals.map((code) => (
              <option key={code} value={code}>
                {L.recordTabs.proposalKinds[recordKind]?.[code] ?? L.common.none}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD_LABEL}>
          {F.proposalBasis}
          <input data-testid="report-proposal-basis" type="text" className={FIELD_BOX} value={state.proposalBasis} disabled={locked} onChange={(e) => patch({ proposalBasis: e.target.value })} />
        </label>
        <label className={`${FIELD_LABEL} md:col-span-2`}>
          {F.proposalContent}
          <textarea data-testid="report-proposal-content" className={`${FIELD_BOX} min-h-[52px]`} value={state.proposalContent} disabled={locked} onChange={(e) => patch({ proposalContent: e.target.value })} />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-slate-600">{F.documents}</span>
        {state.documents.map((doc, i) => (
          <div key={i} data-testid={`report-doc-${i}`} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <label className={FIELD_LABEL}>
              {F.docType}
              <input data-testid={`report-doc-${i}-type`} type="text" className={FIELD_BOX} value={doc.type} disabled={locked} onChange={(e) => setDoc(i, { type: e.target.value })} />
            </label>
            <label className={FIELD_LABEL}>
              {F.docNumber}
              <input data-testid={`report-doc-${i}-number`} type="text" className={FIELD_BOX} value={doc.number} disabled={locked} onChange={(e) => setDoc(i, { number: e.target.value })} />
            </label>
            <label className={FIELD_LABEL}>
              {F.docDate}
              <input data-testid={`report-doc-${i}-date`} type="date" className={FIELD_BOX} value={doc.date} disabled={locked} onChange={(e) => setDoc(i, { date: e.target.value })} />
            </label>
            <button type="button" data-testid={`report-doc-${i}-remove`} className={LINK_BUTTON} disabled={locked} onClick={() => patch({ documents: state.documents.filter((_, j) => j !== i) })}>
              {F.removeDocument}
            </button>
          </div>
        ))}
        <div>
          <button type="button" data-testid="report-doc-add" className={LINK_BUTTON} disabled={locked} onClick={() => patch({ documents: [...state.documents, { type: '', number: '', date: '' }] })}>
            {F.addDocument}
          </button>
        </div>
      </div>

      {error && (
        <p data-testid="report-form-error" role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" data-testid="report-submit" className={SMALL_PRIMARY} disabled={locked} onClick={() => void submit()}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" data-testid="report-cancel" className={SMALL_SECONDARY} onClick={() => {
              clearDraft();
              onCancel();
            }}>
            {L.common.cancel}
          </button>
        )}
      </div>
    </div>
  );
}
