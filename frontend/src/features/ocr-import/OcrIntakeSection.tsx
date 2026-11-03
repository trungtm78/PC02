import { ocrImport } from '@/locales/vi';
import { FillBar } from './FillBar';
import { IntakeDrawer } from './IntakeDrawer';
import type { OcrFormIntake } from './useOcrFormIntake';

export interface OcrIntakeSectionProps<TForm> {
  ocr: OcrFormIntake<TForm>;
  /** The caption the officer sees on the form for a field. */
  captionOf: (field: string) => string;
  /** False on the edit screen and in view-only mode: the section is not offered at all. */
  visible: boolean;
}

/** The strip above a create form plus its drawer. Renders nothing when the feature is off or does not apply. */
export function OcrIntakeSection<TForm>({ ocr, captionOf, visible }: OcrIntakeSectionProps<TForm>) {
  if (!ocr.available || !visible) return null;
  return (
    <>
      <FillBar
        applied={ocr.fill.applied}
        unconfirmed={ocr.fill.unconfirmed}
        skipped={ocr.fill.skipped}
        captionOf={captionOf}
        onOpenDrawer={ocr.openDrawer}
        onConfirm={ocr.fill.confirm}
        onTakeSkipped={ocr.fill.takeSkippedValue}
        onUndo={ocr.undo}
        undoConflicts={ocr.undoConflicts}
      />
      {ocr.restoreNotice === 'UNAVAILABLE' && (
        <p role="status" className="text-sm text-amber-800" data-testid="ocr-draft-unavailable">
          {ocrImport.draftScansUnavailable}
        </p>
      )}
      <IntakeDrawer open={ocr.drawerOpen} onClose={ocr.closeDrawer} intake={ocr.intake} />
    </>
  );
}
