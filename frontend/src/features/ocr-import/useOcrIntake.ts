import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ocrApi,
  type OcrAnalysisView,
  type OcrEntityName,
  type OcrPageView,
  type ReadMode,
} from './ocrApi';
import { useLatest } from './useLatest';

export type IntakePhase = 'IDLE' | 'READING' | 'DONE' | 'ERROR';

export interface UploadError {
  name: string;
  code: string;
}

export interface IntakePage extends OcrPageView {
  /** Where the browser shows the scan the officer picked, before anything comes back from the server. */
  previewUrl: string | null;
  fileName: string;
}

/**
 * The stable code of a failed request: the server's own code if it sent one, otherwise a code made from the HTTP
 * status or `NETWORK`. The screen translates codes; this never returns a message from the server.
 */
export function errorCodeOf(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { code?: unknown } } })
    ?.response;
  if (response) {
    if (typeof response.data?.code === 'string') return response.data.code;
    return `HTTP_${response.status ?? 0}`;
  }
  return 'NETWORK';
}

export interface UseOcrIntakeArgs {
  entity: OcrEntityName;
  /** Called with the session and the analysis when a reading finishes; the form is filled from it. */
  onAnalysis: (sessionId: string, analysis: OcrAnalysisView) => void;
  /** How often a running job is asked about. Tests make it short. */
  pollMs?: number;
}

/**
 * The drawer's whole conversation with the server: one session for the bundle of scans, one upload per file, a
 * reading that is polled until it ends, and the analysis handed to the form. Nothing here touches the form itself.
 */
export function useOcrIntake({ entity, onAnalysis, pollMs = 2000 }: UseOcrIntakeArgs) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pages, setPages] = useState<IntakePage[]>([]);
  const [uploadErrors, setUploadErrors] = useState<UploadError[]>([]);
  const [phase, setPhase] = useState<IntakePhase>('IDLE');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<OcrAnalysisView | null>(null);
  const [uploading, setUploading] = useState(false);

  const sessionRef = useRef<string | null>(null);
  const pagesRef = useLatest(pages);
  const onAnalysisRef = useLatest(onAnalysis);
  /** Bumped by cancel/unmount so a poll still in flight stops quietly. */
  const epochRef = useRef(0);

  useEffect(
    () => () => {
      epochRef.current += 1;
      for (const p of pagesRef.current) {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      }
    },
    [],
  );

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionRef.current) return sessionRef.current;
    const session = await ocrApi.openSession(entity);
    sessionRef.current = session.id;
    setSessionId(session.id);
    return session.id;
  }, [entity]);

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setUploading(true);
      setUploadErrors([]);
      const failed: UploadError[] = [];
      try {
        const id = await ensureSession();
        for (const file of files) {
          try {
            const { page } = await ocrApi.uploadPage(id, file);
            const added: IntakePage = {
              ...page,
              fileName: file.name,
              previewUrl: URL.createObjectURL(file),
            };
            setPages((prev) => [...prev, added]);
          } catch (error) {
            failed.push({ name: file.name, code: errorCodeOf(error) });
          }
        }
      } catch (error) {
        failed.push({ name: files[0].name, code: errorCodeOf(error) });
      } finally {
        setUploadErrors(failed);
        setUploading(false);
      }
    },
    [ensureSession],
  );

  const movePage = useCallback(async (pageId: string, direction: -1 | 1) => {
    const id = sessionRef.current;
    const current = pagesRef.current;
    const from = current.findIndex((p) => p.id === pageId);
    const to = from + direction;
    if (!id || from < 0 || to < 0 || to >= current.length) return;
    const next = [...current];
    [next[from], next[to]] = [next[to], next[from]];
    await ocrApi.reorder(
      id,
      next.map((p) => p.id),
    );
    setPages(next);
  }, []);

  const removePage = useCallback(async (pageId: string) => {
    const id = sessionRef.current;
    if (!id) return;
    await ocrApi.removePage(id, pageId);
    const gone = pagesRef.current.find((p) => p.id === pageId);
    if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
    setPages((prev) => prev.filter((p) => p.id !== pageId));
  }, []);

  const read = useCallback(
    async (mode: ReadMode) => {
      const id = sessionRef.current;
      if (!id || pagesRef.current.length === 0) return;
      const epoch = (epochRef.current += 1);
      setPhase('READING');
      setErrorCode(null);
      try {
        await ocrApi.read(id, mode);
        // Ask until the job ends. The server keeps working if this screen goes away; only the asking stops.
        for (;;) {
          await new Promise((resolve) => setTimeout(resolve, pollMs));
          if (epochRef.current !== epoch) return;
          const job = await ocrApi.job(id);
          if (job?.state === 'SUCCEEDED') break;
          if (job?.state === 'FAILED') {
            setErrorCode(job.lastErrorCode ?? 'INTERNAL');
            setPhase('ERROR');
            return;
          }
        }
        const found = await ocrApi.analysis(id);
        if (epochRef.current !== epoch) return;
        if (!found) {
          // The input changed while the reading ran, so the result is not for the pages as they are now.
          setErrorCode('OCR_INPUT_CHANGED');
          setPhase('ERROR');
          return;
        }
        setAnalysis(found);
        setPhase('DONE');
        onAnalysisRef.current(id, found);
      } catch (error) {
        if (epochRef.current !== epoch) return;
        setErrorCode(errorCodeOf(error));
        setPhase('ERROR');
      }
    },
    [pollMs],
  );

  const cancel = useCallback(async () => {
    epochRef.current += 1;
    const id = sessionRef.current;
    for (const p of pagesRef.current) {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    }
    sessionRef.current = null;
    setSessionId(null);
    setPages([]);
    setAnalysis(null);
    setUploadErrors([]);
    setErrorCode(null);
    setPhase('IDLE');
    if (id) await ocrApi.cancel(id).catch(() => undefined);
  }, []);

  /** Forgets the session on this screen without deleting it on the server: it was bound to a saved record. */
  const reset = useCallback(() => {
    epochRef.current += 1;
    for (const p of pagesRef.current) {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    }
    sessionRef.current = null;
    setSessionId(null);
    setPages([]);
    setAnalysis(null);
    setUploadErrors([]);
    setErrorCode(null);
    setPhase('IDLE');
  }, []);

  return {
    sessionId,
    pages,
    uploading,
    uploadErrors,
    phase,
    errorCode,
    analysis,
    addFiles,
    movePage,
    removePage,
    read,
    cancel,
    reset,
  };
}
