import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ocrApi, type OcrAnalysisView } from './ocrApi';
import { fieldOutcomes, type FieldOutcomeRow } from './fieldOutcomes';
import { mapFieldNames } from './mapFieldNames';
import { buildFieldNotes } from './FieldNotes';
import type { FormAccess } from './fillPlan';
import type { OcrEntityName } from './ocrApi';
import { useOcrAvailability } from './useOcrAvailability';
import { useOcrFill } from './useOcrFill';
import { useOcrIntake } from './useOcrIntake';

export interface UseOcrFormIntakeArgs<TForm> {
  entity: OcrEntityName;
  access: FormAccess<TForm>;
  form: TForm;
  setForm: Dispatch<SetStateAction<TForm>>;
  /** The form as it started (defaults included): what "the officer has not touched" is measured against. */
  baseline: TForm | undefined;
  /** The record already exists (edit screen, or created a moment ago): scans can no longer be read into the form. */
  saved: boolean;
  /**
   * Turns the field name the server uses (the shared layout's name, e.g. "tenCungCap") into the path this form keeps
   * the value under (e.g. "senderName"). Omit when the form uses the layout's names as they are.
   */
  toFormPath?: (serverField: string) => string;
}

/**
 * Everything a create form needs to enter a record from scans, in one place, so the Petition, Incident and Case
 * screens wire it the same way: the fill, the intake, the drawer, the notes shown under fields, the Save guard and the
 * binding that goes into the create request.
 */
export function useOcrFormIntake<TForm>({
  entity,
  access,
  form,
  setForm,
  baseline,
  saved,
  toFormPath,
}: UseOcrFormIntakeArgs<TForm>) {
  const available = useOcrAvailability();
  const fill = useOcrFill({ access, form, setForm, baseline });
  // Everything after this speaks the form's own field names.
  const applyMapped = useCallback(
    (sessionId: string, analysis: OcrAnalysisView) =>
      fill.applyAnalysis(sessionId, toFormPath ? mapFieldNames(analysis, toFormPath) : analysis),
    [fill, toFormPath],
  );
  const intake = useOcrIntake({
    entity,
    // Once the record is saved a late analysis must not fill it: the confirmation guard and the binding only exist
    // for the create request.
    onAnalysis: (sessionId, analysis) => {
      if (saved) return;
      applyMapped(sessionId, analysis);
    },
    // The scans were deleted: save without them. What was filled from them stays in the form.
    onSessionEnded: fill.unbind,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [undoConflicts, setUndoConflicts] = useState<string[]>([]);

  const notes = useMemo(
    () =>
      buildFieldNotes({
        applied: fill.applied,
        pageNumbers: Object.fromEntries(intake.pages.map((p, i) => [p.id, i + 1])),
      }),
    [fill.applied, intake.pages],
  );

  const undo = useCallback(() => setUndoConflicts(fill.undo().conflicts), [fill]);

  /**
   * A copy of the form without the values that came from the scans, for a draft kept in the browser. Scans and what
   * was read from them are personal data and live on the server for a limited time; a draft in local storage must
   * not become a second, unmanaged copy. EVERY field that was filled from the scans goes back to what it held before,
   * including one the officer edited afterwards: an edited value still starts from the image's text (a corrected name is
   * still a name), so only a field the scans never touched is kept.
   */
  const withoutScanValues = useCallback(
    (current: TForm): TForm =>
      fill.applied.reduce((form, patch) => access.write(form, patch.field, patch.before), current),
    [access, fill.applied],
  );

  /** What a draft should remember instead: which session and analysis the form was filled from. */
  const draftReference = useCallback((): { sessionId: string; analysisId: string } | undefined => {
    const binding = fill.bindingForSave();
    return binding.ocrPhienId && binding.ocrPhienBan
      ? { sessionId: binding.ocrPhienId, analysisId: binding.ocrPhienBan }
      : undefined;
  }, [fill]);

  const [restoreNotice, setRestoreNotice] = useState<'UNAVAILABLE' | null>(null);
  /** Bumped when a restore is abandoned (draft discarded, record created), so a slow answer is ignored. */
  const restoreEpoch = useRef(0);

  /**
   * Opening a draft that pointed at scans: fetch the analysis from the server again (with the officer's own login) and
   * fill as before; the risky fields wait for confirmation once more. If the scans were purged, or the text changed
   * since, nothing is filled and the officer is told.
   */
  const restoreFromDraft = useCallback(
    async (reference: { sessionId: string; analysisId: string } | undefined) => {
      if (!reference) return;
      const mine = restoreEpoch.current;
      try {
        const found = await ocrApi.analysis(reference.sessionId);
        if (restoreEpoch.current !== mine) return;
        // The draft remembers WHICH analysis it was filled from. If the session was analysed again since, the values
        // would differ without anyone having chosen that, so the draft is treated as expired.
        if (!found || found.id !== reference.analysisId) {
          setRestoreNotice('UNAVAILABLE');
          return;
        }
        setRestoreNotice(null);
        applyMapped(reference.sessionId, found);
      } catch {
        if (restoreEpoch.current === mine) setRestoreNotice('UNAVAILABLE');
      }
    },
    [applyMapped],
  );

  /** The draft was thrown away: forget a restore still in flight and anything it already brought in. */
  const discardRestore = useCallback(() => {
    restoreEpoch.current += 1;
    setRestoreNotice(null);
    fill.forget();
  }, [fill]);

  /**
   * What the create request carries about the scans: which session and analysis the form was filled from, and what
   * became of each filled field (names and outcomes, no values). Empty when no scans were read.
   */
  const bindingForSave = useCallback((): {
    ocrPhienId?: string;
    ocrPhienBan?: string;
    ocrKetQua?: FieldOutcomeRow[];
  } => {
    const binding = fill.bindingForSave();
    return binding.ocrPhienId
      ? { ...binding, ocrKetQua: fieldOutcomes(access, form, fill.applied) }
      : {};
  }, [fill, access, form]);

  /** After the create request succeeded: the scans belong to the saved record, this screen forgets them. */
  const afterCreated = useCallback(() => {
    const wasBound = Boolean(fill.bindingForSave().ocrPhienId);
    restoreEpoch.current += 1;
    intake.reset();
    if (wasBound) fill.forget();
  }, [fill, intake]);

  return {
    available,
    fill,
    intake,
    notes,
    drawerOpen,
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
    undo,
    undoConflicts,
    withoutScanValues,
    draftReference,
    restoreFromDraft,
    discardRestore,
    restoreNotice,
    bindingForSave,
    afterCreated,
  };
}

export type OcrFormIntake<TForm> = ReturnType<typeof useOcrFormIntake<TForm>>;
