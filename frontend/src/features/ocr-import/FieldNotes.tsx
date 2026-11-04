import type { ReactNode } from 'react';
import { ocrImport } from '@/locales/vi';
import type { AppliedPatch } from './fillPlan';

interface Args {
  applied: readonly AppliedPatch[];
  /** Page id to the number shown to the officer (the position in the bundle, from 1). */
  pageNumbers: Readonly<Record<string, number>>;
}

/**
 * One note per field the reading filled, shown right under the field: where the value came from and the words it was
 * taken from, so the officer can check it against the scan. It asks for nothing: the officer corrects what is wrong.
 * Returned as a map so it can be handed to `LegacyTabBody`'s `sauO` without changing the shared form components.
 */
export function buildFieldNotes({ applied, pageNumbers }: Args): Record<string, ReactNode> {
  const notes: Record<string, ReactNode> = {};
  for (const patch of applied) {
    const page = patch.provenance.pageId ? pageNumbers[patch.provenance.pageId] : undefined;
    const inferred = patch.provenance.claimKind === 'INFERRED';
    notes[patch.field] = (
      <div
        data-testid={`ocr-note-${patch.field}`}
        className="-mt-2 flex flex-wrap items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-900"
      >
        <span className="rounded bg-white/70 px-1.5 py-0.5 font-medium">{ocrImport.fromImage}</span>
        {page !== undefined && <span>{ocrImport.fromPage(String(page))}</span>}
        {inferred && <span className="font-medium">{ocrImport.inferred}</span>}
        {patch.provenance.quote && (
          <span className="max-w-full truncate italic" title={patch.provenance.quote}>
            “{patch.provenance.quote}”
          </span>
        )}
      </div>
    );
  }
  return notes;
}
