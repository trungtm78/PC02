import { useEffect, useState } from 'react';
import { ocrImport } from '@/locales/vi';
import { ocrApi, type OcrTranscript } from './ocrApi';

export interface ReviewPanelProps {
  sessionId: string;
  pages: ReadonlyArray<{ id: string; fileName: string }>;
  /** Asks for a new analysis from the text as it now stands. */
  onReanalyse: () => void;
}

/**
 * The scan next to what the system read from it. The officer can correct the text of a page and have the analysis run
 * again from the corrected text. The text is only ever what was read: this is where a misreading is fixed, so a wrong
 * word does not travel into the form.
 */
export function ReviewPanel({ sessionId, pages, onReanalyse }: ReviewPanelProps) {
  const [selected, setSelected] = useState(pages[0]?.id ?? '');
  const [transcripts, setTranscripts] = useState<Record<string, OcrTranscript>>({});
  /** What the officer has typed per page and not yet saved. A page with no entry shows the stored text. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [corrected, setCorrected] = useState(false);
  /** The scan of one page, tagged with the page it belongs to so a slow answer for another page is never shown. */
  const [image, setImage] = useState<{ key: string; url: string | null; failed: boolean } | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let live = true;
    void ocrApi.transcripts(sessionId).then((all) => {
      if (live) setTranscripts(all);
    });
    return () => {
      live = false;
    };
  }, [sessionId]);

  const imageKey = `${sessionId}:${selected}`;
  useEffect(() => {
    let live = true;
    let url: string | null = null;
    if (selected) {
      ocrApi
        .pageImage(sessionId, selected)
        .then((blob) => {
          if (!live) return;
          url = URL.createObjectURL(blob);
          setImage({ key: imageKey, url, failed: false });
        })
        .catch(() => {
          if (live) setImage({ key: imageKey, url: null, failed: true });
        });
    }
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [sessionId, selected, imageKey]);
  const shown = image?.key === imageKey ? image : null;

  const draft = drafts[selected] ?? transcripts[selected]?.text ?? '';

  const save = async () => {
    await ocrApi.saveTranscript(sessionId, selected, draft);
    setTranscripts((prev) => ({
      ...prev,
      [selected]: { text: draft, revision: (prev[selected]?.revision ?? 0) + 1, source: 'OFFICER' },
    }));
    setDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([page]) => page !== selected)));
    setCorrected(true);
  };

  const pageNumber = pages.findIndex((p) => p.id === selected) + 1;
  const edited = drafts[selected] !== undefined && drafts[selected] !== (transcripts[selected]?.text ?? '');

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-3" aria-label={ocrImport.reviewHeading}>
      <h3 className="text-sm font-medium text-slate-800">{ocrImport.reviewHeading}</h3>
      <div className="flex flex-wrap gap-1">
        {pages.map((p, i) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === selected}
            onClick={() => setSelected(p.id)}
            className={`rounded border px-2 py-1 text-xs ${
              p.id === selected ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300 text-slate-700'
            }`}
          >
            {ocrImport.pageLabel(i + 1)}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="rounded border px-2">
            −
          </button>
          <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="rounded border px-2">
            +
          </button>
          <span>{Math.round(zoom * 100)}%</span>
        </div>
        <div className="max-h-80 overflow-auto rounded border border-slate-200 bg-slate-50">
          {shown?.url && (
            <img
              src={shown.url}
              alt={ocrImport.pageLabel(pageNumber)}
              style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}
            />
          )}
          {shown?.failed && <p className="p-3 text-sm text-red-700">{ocrImport.imageFailed}</p>}
        </div>
      </div>

      <label className="block text-sm font-medium text-slate-800" htmlFor="ocr-transcript">
        {ocrImport.transcript}
      </label>
      {transcripts[selected]?.source === 'OFFICER' && (
        <p className="text-xs text-emerald-800">{ocrImport.editedByOfficer}</p>
      )}
      <textarea
        id="ocr-transcript"
        aria-label={ocrImport.transcript}
        value={draft}
        onChange={(e) => setDrafts((prev) => ({ ...prev, [selected]: e.target.value }))}
        rows={10}
        className="w-full rounded-md border border-slate-300 p-2 font-mono text-xs"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!edited}
          onClick={() => void save()}
          className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {ocrImport.saveCorrection}
        </button>
        {corrected && (
          <button
            type="button"
            onClick={onReanalyse}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            {ocrImport.reanalyse}
          </button>
        )}
      </div>
    </section>
  );
}
