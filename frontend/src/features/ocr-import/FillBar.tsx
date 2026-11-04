import { ocrImport } from '@/locales/vi';
import type { AppliedPatch, SkippedFill } from './fillPlan';

export interface FillBarProps {
  applied: readonly AppliedPatch[];
  /** Orange fields still waiting for the officer. */
  unconfirmed: readonly AppliedPatch[];
  /** Fields the reading could fill but the officer had already typed in. */
  skipped: readonly SkippedFill[];
  /** The caption the officer sees on the form for a field. */
  captionOf: (field: string) => string;
  onOpenDrawer: () => void;
  onConfirm: (field: string) => void;
  onTakeSkipped: (field: string) => void;
  onUndo: () => void;
  /** Fields the last undo left alone because the officer had changed them. */
  undoConflicts?: readonly string[];
}

/**
 * The strip above the form: the button that opens the drawer, how much was filled from the scans, and the way to deal
 * with it. Every field that blocks Save is listed here with its own Confirm button, so none can hide in a collapsed
 * block or a custom control. There is deliberately no "confirm all".
 */
export function FillBar({
  applied,
  unconfirmed,
  skipped,
  captionOf,
  onOpenDrawer,
  onConfirm,
  onTakeSkipped,
  onUndo,
  undoConflicts = [],
}: FillBarProps) {
  const typed = skipped.filter((s) => s.reason === 'TYPED_BY_OFFICER');
  return (
    <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3" data-testid="ocr-fill-bar">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onOpenDrawer}
          title={ocrImport.openHint}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {ocrImport.open}
        </button>
        {applied.length > 0 && (
          <>
            <span className="text-sm text-slate-800">
              {ocrImport.filledBar(applied.length, unconfirmed.length)}
            </span>
            <button
              type="button"
              onClick={onUndo}
              className="text-sm text-slate-700 underline hover:text-slate-900"
            >
              {ocrImport.undo}
            </button>
          </>
        )}
      </div>

      {undoConflicts.length > 0 && (
        <p className="text-xs text-slate-700">
          {ocrImport.undoConflicts(undoConflicts.map(captionOf).join(', '))}
        </p>
      )}

      {unconfirmed.length > 0 && (
        <ul className="space-y-1" aria-label={ocrImport.needsConfirm}>
          {unconfirmed.map((p) => (
            <li
              key={p.field}
              className="flex flex-wrap items-center gap-2 rounded-md border border-orange-300 bg-orange-50 px-2 py-1 text-sm"
            >
              <span className="font-medium text-orange-900">{captionOf(p.field)}</span>
              <span className="text-slate-800">{p.value}</span>
              <button
                type="button"
                onClick={() => onConfirm(p.field)}
                className="ml-auto rounded bg-orange-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-orange-700"
              >
                {ocrImport.confirm}
              </button>
            </li>
          ))}
        </ul>
      )}

      {typed.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-700">{ocrImport.skippedHeading}</summary>
          <ul className="mt-1 space-y-1">
            {typed.map((s) => (
              <li key={s.field} className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-800">{captionOf(s.field)}</span>
                <span className="text-slate-600">→ {String(s.value)}</span>
                <button
                  type="button"
                  onClick={() => onTakeSkipped(s.field)}
                  className="ml-auto text-xs text-blue-700 underline"
                >
                  {ocrImport.skippedUse}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
