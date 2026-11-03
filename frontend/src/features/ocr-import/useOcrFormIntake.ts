import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { ocrImport } from '@/locales/vi';
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
}: UseOcrFormIntakeArgs<TForm>) {
  const available = useOcrAvailability();
  const fill = useOcrFill({ access, form, setForm, baseline });
  const intake = useOcrIntake({
    entity,
    // Once the record is saved a late analysis must not fill it: the confirmation guard and the binding only exist
    // for the create request.
    onAnalysis: (sessionId, analysis) => {
      if (saved) return;
      fill.applyAnalysis(sessionId, analysis);
    },
    // The scans were deleted: save without them. What was filled from them still needs confirming.
    onSessionEnded: fill.unbind,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [undoConflicts, setUndoConflicts] = useState<string[]>([]);

  const notes = useMemo(
    () =>
      buildFieldNotes({
        applied: fill.applied,
        confirmed: fill.confirmed,
        pageNumbers: Object.fromEntries(intake.pages.map((p, i) => [p.id, i + 1])),
        onConfirm: fill.confirm,
      }),
    [fill.applied, fill.confirmed, fill.confirm, intake.pages],
  );

  const undo = useCallback(() => setUndoConflicts(fill.undo().conflicts), [fill]);

  /** A message when Save must wait for the officer to confirm fields taken from the scans; null when it may go on. */
  const saveBlockedMessage = fill.blocksSave ? ocrImport.saveBlocked(fill.unconfirmed.length) : null;

  /** After the create request succeeded: the scans belong to the saved record, this screen forgets them. */
  const afterCreated = useCallback(() => {
    const wasBound = Boolean(fill.bindingForSave().ocrPhienId);
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
    saveBlockedMessage,
    bindingForSave: fill.bindingForSave,
    afterCreated,
  };
}

export type OcrFormIntake<TForm> = ReturnType<typeof useOcrFormIntake<TForm>>;
