/**
 * The small dialog the "ĐTV đề xuất" field opens: a new investigator of the unit (the name typed in the field is
 * already filled in) or the one chosen, corrected. Họ tên · Cấp bậc · Chức vụ · Ngạch ĐTV · Tình trạng. Saving closes
 * the dialog and hands the investigator back, so the field chooses them.
 *
 * A name the unit already lists is not doubled silently: the dialog offers the one listed (resumed when stopped), or
 * to keep both when they really are two people.
 */
import { useState } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/shared/Modal';
import { BTN_PRIMARY, BTN_SECONDARY, FIELD_ERROR_TEXT, INPUT_BASE, LABEL_BASE, LABEL_REQUIRED_MARKER, SELECT_BASE } from '@/constants/styles';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';
import { wardInvestigatorsApi, type WardInvestigatorInput } from '../api';
import { explainWardError } from '../errors';
import type { WardInvestigator } from '../types';

const T = L.investigators;
const Q = T.quick;
const TEXT_FIELDS = ['fullName', 'rank', 'position', 'grade'] as const;
type Draft = Record<(typeof TEXT_FIELDS)[number], string> & { isActive: boolean };

export interface InvestigatorQuickDialogProps {
  teamId: string;
  /** The investigator being corrected; absent for a new one. */
  investigator?: WardInvestigator | null;
  /** What was typed in the field when "create" was asked for. */
  suggestedName?: string;
  /** The unit's investigators as the form holds them (the stopped ones too): where a name already listed is found. */
  known: readonly WardInvestigator[];
  onClose: () => void;
  onSaved: (investigator: WardInvestigator) => void;
}

const draftOf = (inv: WardInvestigator | null | undefined, suggestedName: string | undefined): Draft => ({
  fullName: inv?.fullName ?? suggestedName ?? '',
  rank: inv?.rank ?? '',
  position: inv?.position ?? '',
  grade: inv?.grade ?? '',
  isActive: inv?.isActive ?? true,
});

const inputOf = (d: Draft): WardInvestigatorInput => ({
  fullName: d.fullName.trim(),
  rank: d.rank.trim() || null,
  position: d.position.trim() || null,
  grade: d.grade.trim() || null,
});

/** The investigator the server says already carries this name (`WARD_INVESTIGATOR_DUPLICATE` details), if it says so. */
function duplicateOf(err: unknown): { existingId: string } | null {
  if (!axios.isAxiosError(err)) return null;
  const body = err.response?.data as { error?: { code?: unknown; details?: unknown }; code?: unknown; details?: unknown } | undefined;
  if ((body?.error?.code ?? body?.code) !== 'WARD_INVESTIGATOR_DUPLICATE') return null;
  const details = body?.error?.details ?? body?.details;
  const first = Array.isArray(details) ? (details[0] as { existingId?: unknown } | undefined) : undefined;
  return { existingId: typeof first?.existingId === 'string' ? first.existingId : '' };
}

export function InvestigatorQuickDialog({ teamId, investigator, suggestedName, known, onClose, onSaved }: InvestigatorQuickDialogProps) {
  const qc = useQueryClient();
  const editing = !!investigator;
  // What the server holds now: a save that wrote the name and then failed on the status is retried from here, with
  // the stamp of what was written (and a creation that succeeded is not sent a second time).
  const [stored, setStored] = useState<WardInvestigator | null>(investigator ?? null);
  const [draft, setDraft] = useState<Draft>(() => draftOf(investigator, suggestedName));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<WardInvestigator | { id: '' } | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['ward-investigators', teamId] });
  const done = async (saved: WardInvestigator) => {
    await refresh();
    onSaved(saved);
    onClose();
  };

  /** Create or correct, then bring the status to the one chosen (the status has its own commands and audit lines). */
  const save = async (allowSameName: boolean) => {
    if (busy) return;
    if (draft.fullName.trim() === '') {
      setError(L.errors.WARD_INVESTIGATOR_NAME_REQUIRED);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = { ...inputOf(draft), ...(allowSameName ? { allowSameName: true } : {}) };
      let saved = stored ? await wardInvestigatorsApi.update(stored.id, body, stored.updatedAt) : await wardInvestigatorsApi.create(teamId, body);
      setStored(saved);
      if (saved.isActive !== draft.isActive) {
        saved = draft.isActive ? await wardInvestigatorsApi.reactivate(saved.id, saved.updatedAt) : await wardInvestigatorsApi.deactivate(saved.id, saved.updatedAt);
        setStored(saved);
      }
      await done(saved);
    } catch (err) {
      const dup = duplicateOf(err);
      if (dup) setDuplicate(known.find((k) => k.id === dup.existingId) ?? { id: '' });
      else setError(explainWardError(err).message);
      // What was written before the refusal (a name corrected, its status not yet) is what the field must show.
      void refresh();
    } finally {
      setBusy(false);
    }
  };

  /** "Dùng người đã có": the one listed, resumed when stopped. */
  const takeExisting = async () => {
    if (!duplicate || duplicate.id === '' || busy) return;
    setBusy(true);
    setError(null);
    try {
      const existing = duplicate as WardInvestigator;
      await done(existing.isActive ? existing : await wardInvestigatorsApi.reactivate(existing.id, existing.updatedAt));
    } catch (err) {
      setError(explainWardError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    // Another name is another question: the answer about the old one no longer stands.
    if (key === 'fullName') setDuplicate(null);
  };

  const existing = duplicate && duplicate.id !== '' ? (duplicate as WardInvestigator) : null;
  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? Q.titleEdit : Q.titleNew}
      maxWidth="max-w-lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" data-testid="ward-inv-quick-cancel" className={BTN_SECONDARY} onClick={onClose}>
            {Q.cancel}
          </button>
          {duplicate ? (
            <>
              <button type="button" data-testid="ward-inv-quick-anyway" className={BTN_SECONDARY} disabled={busy} onClick={() => void save(true)}>
                {editing ? Q.saveAnyway : Q.createAnyway}
              </button>
              {/* Correcting somebody onto a listed name: there is nobody else to "use", only to keep both or rename. */}
              {existing && !editing && (
                <button type="button" data-testid="ward-inv-quick-use-existing" className={BTN_PRIMARY} disabled={busy} onClick={() => void takeExisting()}>
                  {Q.useExisting}
                </button>
              )}
            </>
          ) : (
            <button type="button" data-testid="ward-inv-quick-save" className={BTN_PRIMARY} disabled={busy || draft.fullName.trim() === ''} onClick={() => void save(false)}>
              {editing ? (busy ? Q.saving : Q.save) : busy ? Q.creating : Q.create}
            </button>
          )}
        </div>
      }
    >
      <div data-testid="ward-inv-quick" className="space-y-3">
        {TEXT_FIELDS.map((f) => (
          <label key={f} className="block">
            <span className={LABEL_BASE}>
              {T[f]}
              {f === 'fullName' && <span className={LABEL_REQUIRED_MARKER}> *</span>}
            </span>
            <input
              data-testid={`ward-inv-quick-${f}`}
              className={INPUT_BASE}
              // The dialog is opened to type a name: the field is where the typing goes.
              autoFocus={f === 'fullName'}
              maxLength={f === 'fullName' || f === 'position' ? 200 : 100}
              value={draft[f]}
              onChange={(e) => set(f, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && !duplicate) {
                  e.preventDefault();
                  void save(false);
                }
              }}
            />
          </label>
        ))}
        <label className="block">
          <span className={LABEL_BASE}>{T.status}</span>
          <select data-testid="ward-inv-quick-status" className={SELECT_BASE} value={draft.isActive ? 'active' : 'stopped'} onChange={(e) => set('isActive', e.target.value === 'active')}>
            <option value="active">{T.active}</option>
            <option value="stopped">{T.stopped}</option>
          </select>
        </label>
        {duplicate && (
          <div data-testid="ward-inv-quick-duplicate" role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p>{Q.duplicate(existing?.fullName ?? draft.fullName.trim())}</p>
            {existing && !existing.isActive && !editing && <p className="mt-1">{Q.duplicateStopped}</p>}
          </div>
        )}
        {error && (
          <p role="alert" data-testid="ward-inv-quick-error" className={FIELD_ERROR_TEXT}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
