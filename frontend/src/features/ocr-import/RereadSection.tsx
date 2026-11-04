import { ocrErrorText, ocrImport } from '@/locales/vi';
import { ReadingProgress } from './ReadingProgress';
import type { useOcrReread } from './useOcrReread';

export interface RereadSectionProps {
  /** Feature on and the role may use it. */
  available: boolean;
  reread: Pick<
    ReturnType<typeof useOcrReread>,
    'phase' | 'errorCode' | 'stage' | 'pageCount' | 'startedAt' | 'differences' | 'sameCount' | 'appliedCount' | 'start' | 'apply' | 'skip' | 'close'
  >;
  captionOf: (field: string) => string;
}

/**
 * On the edit screen of a saved record: read the attached scans again and compare field by field. Using a value writes
 * it into the open form only; the officer saves with the ordinary Save.
 */
export function RereadSection({ available, reread, captionOf }: RereadSectionProps) {
  if (!available) return null;
  const reading = reread.phase === 'READING';
  const shown = reread.phase === 'DONE';
  return (
    <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3" data-testid="ocr-reread">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={reading}
          onClick={() => void reread.start()}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {ocrImport.rereadOpen}
        </button>
        {(shown || reread.phase === 'ERROR') && (
          <button type="button" onClick={() => void reread.close()} className="text-sm text-slate-700 underline">
            {ocrImport.rereadClose}
          </button>
        )}
      </div>

      {reading && (
        <ReadingProgress
          kind="READ"
          stage={reread.stage}
          pageCount={reread.pageCount}
          startedAt={reread.startedAt}
          finalStep="compare"
        />
      )}
      {reread.phase === 'ERROR' && reread.errorCode && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          {ocrErrorText(reread.errorCode)}
        </p>
      )}

      {shown && (
        <div className="space-y-2">
          <p className="text-sm text-slate-700">
            {reread.differences.length === 0 ? ocrImport.rereadNothingDiffers : ocrImport.rereadHint}
          </p>
          {reread.sameCount > 0 && <p className="text-xs text-slate-600">{ocrImport.rereadSame(reread.sameCount)}</p>}
          <ul className="space-y-2">
            {reread.differences.map((d) => (
              <li
                key={d.field}
                className={`rounded-md border p-2 text-sm ${
                  d.orange ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="font-medium text-slate-900">{captionOf(d.field)}</div>
                <div className="grid gap-1 md:grid-cols-2">
                  <div>
                    <span className="text-xs text-slate-500">{ocrImport.rereadCurrent}</span>
                    <div className="whitespace-pre-line text-slate-800">{d.current === '' ? ocrImport.rereadEmpty : d.current}</div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">{ocrImport.rereadFromImage}</span>
                    <div className="whitespace-pre-line text-slate-800">{d.proposed}</div>
                  </div>
                </div>
                {d.quote && <div className="mt-1 truncate text-xs italic text-slate-600" title={d.quote}>“{d.quote}”</div>}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => reread.apply(d.field)}
                    className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white"
                  >
                    {ocrImport.rereadUse}
                  </button>
                  <button
                    type="button"
                    onClick={() => reread.skip(d.field)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                  >
                    {ocrImport.rereadKeep}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
