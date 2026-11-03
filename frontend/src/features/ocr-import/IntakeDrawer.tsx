import { useState } from 'react';
import { ocrErrorText, ocrImport } from '@/locales/vi';
import { ReviewPanel } from './ReviewPanel';
import type { useOcrIntake } from './useOcrIntake';

export interface IntakeDrawerProps {
  open: boolean;
  onClose: () => void;
  intake: ReturnType<typeof useOcrIntake>;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

/**
 * Side drawer for choosing the scans of one bundle and starting the reading. It changes nothing in the form: when a
 * reading ends, the analysis goes to the form through `useOcrIntake`'s `onAnalysis`.
 */
export function IntakeDrawer({ open, onClose, intake }: IntakeDrawerProps) {
  const [showReview, setShowReview] = useState(false);
  if (!open) return null;
  const reading = intake.phase === 'READING';
  const canRead = intake.pages.length > 0 && !reading && !intake.uploading;

  return (
    <aside
      role="dialog"
      aria-label={ocrImport.title}
      className={`fixed inset-y-0 right-0 z-40 flex w-full ${showReview ? 'max-w-2xl' : 'max-w-md'} flex-col gap-4 overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl`}
    >
      <header className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{ocrImport.title}</h2>
        <button type="button" onClick={onClose} className="text-sm text-slate-600 hover:text-slate-900">
          {ocrImport.close}
        </button>
      </header>
      <p className="text-sm text-slate-600">{ocrImport.intro}</p>

      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-slate-300 p-4 text-center text-sm text-slate-700 hover:border-blue-400">
        <span className="font-medium">{ocrImport.pickFiles}</span>
        <span className="text-xs text-slate-500">{ocrImport.dropHint}</span>
        <input
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          data-testid="ocr-file-input"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            void intake.addFiles(files);
          }}
        />
      </label>
      {intake.uploading && <p className="text-sm text-slate-600">{ocrImport.uploading}</p>}

      {intake.uploadErrors.length > 0 && (
        <ul className="space-y-1 text-sm text-red-700">
          {intake.uploadErrors.map((e) => (
            <li key={e.name}>
              {e.name}: {ocrErrorText(e.code)}
            </li>
          ))}
        </ul>
      )}

      <section aria-label={ocrImport.pagesHeading} className="space-y-2">
        <h3 className="text-sm font-medium text-slate-800">{ocrImport.pagesHeading}</h3>
        {intake.pages.length === 0 ? (
          <p className="text-sm text-slate-500">{ocrImport.noPages}</p>
        ) : (
          <ol className="space-y-2">
            {intake.pages.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
                {p.previewUrl ? (
                  <img src={p.previewUrl} alt="" className="h-16 w-12 rounded object-cover" />
                ) : (
                  <div className="h-16 w-12 rounded bg-slate-100" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900">{ocrImport.pageLabel(i + 1)}</div>
                  <div className="truncate text-xs text-slate-500">{p.fileName}</div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={ocrImport.moveUp}
                    disabled={i === 0 || reading}
                    onClick={() => void intake.movePage(p.id, -1)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={ocrImport.moveDown}
                    disabled={i === intake.pages.length - 1 || reading}
                    onClick={() => void intake.movePage(p.id, 1)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={ocrImport.removePage}
                    disabled={reading}
                    onClick={() => void intake.removePage(p.id)}
                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <button
        type="button"
        disabled={!canRead}
        onClick={() => void intake.read('READ')}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {ocrImport.read}
      </button>

      {reading && (
        <p className="text-sm text-slate-700" role="status">
          {ocrImport.reading}
        </p>
      )}
      {intake.phase === 'ERROR' && intake.errorCode && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {ocrErrorText(intake.errorCode)}
        </p>
      )}
      {intake.phase === 'DONE' && intake.analysis && (
        <section className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm">
          <p className="font-medium text-emerald-900">{ocrImport.done}</p>
          {typeof intake.analysis.cleaned.summary === 'string' && (
            <div>
              <h3 className="font-medium text-slate-800">{ocrImport.summaryHeading}</h3>
              <p className="whitespace-pre-line text-slate-800">{intake.analysis.cleaned.summary}</p>
            </div>
          )}
          {intake.analysis.issues.length > 0 && (
            <p className="text-amber-800">{ocrImport.issuesCount(intake.analysis.issues.length)}</p>
          )}
          <p className="text-xs text-slate-600">{ocrImport.autoCheckNote}</p>
          <button
            type="button"
            onClick={() => setShowReview((v) => !v)}
            className="text-sm text-blue-700 underline"
          >
            {ocrImport.openReview}
          </button>
        </section>
      )}
      {showReview && intake.sessionId && intake.pages.length > 0 && (
        <ReviewPanel
          sessionId={intake.sessionId}
          pages={intake.pages}
          onReanalyse={() => void intake.read('ANALYSE')}
        />
      )}

      {intake.sessionId && (
        <button
          type="button"
          disabled={reading}
          onClick={() => void intake.cancel()}
          className="self-start text-sm text-red-700 hover:underline disabled:opacity-50"
        >
          {ocrImport.cancel}
        </button>
      )}
    </aside>
  );
}
