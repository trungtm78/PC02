import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { FormAccess } from './fillPlan';
import { mapFieldNames } from './mapFieldNames';
import { ocrApi, type OcrAnalysisView, type OcrEntityName, type OcrJobStage } from './ocrApi';
import { errorCodeOf } from './useOcrIntake';
import { useLatest } from './useLatest';
import { sameMeaning } from './sameMeaning';

export interface Difference {
  field: string;
  current: string;
  proposed: string;
  /** The server's name of the field, which decides how its two readings are compared (`sameMeaning`). */
  serverField?: string;
  /** The system is not sure of this one (or the policy asks for confirmation): say so next to it. */
  orange: boolean;
  quote: string | null;
}

export type RereadPhase = 'IDLE' | 'READING' | 'DONE' | 'ERROR';

export interface UseOcrRereadArgs<TForm> {
  entity: OcrEntityName;
  recordId: string;
  access: FormAccess<TForm>;
  form: TForm;
  setForm: Dispatch<SetStateAction<TForm>>;
  /** Server field name to this form's path; omit when they are the same. */
  toFormPath?: (serverField: string) => string;
  pollMs?: number;
}

const asText = (value: unknown): string => (Array.isArray(value) ? value.join(', ') : String(value ?? ''));

/**
 * Reads the scans attached to a SAVED record again and sets what it found beside what the record holds now, field by
 * field. Nothing here changes the record: "use the value from the image" writes into the open form like typing would,
 * and the officer saves with the ordinary Save (which keeps its checks, locking and audit).
 */
export function useOcrReread<TForm>({
  entity,
  recordId,
  access,
  form,
  setForm,
  toFormPath,
  pollMs = 2000,
}: UseOcrRereadArgs<TForm>) {
  const [phase, setPhase] = useState<RereadPhase>('IDLE');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<OcrAnalysisView | null>(null);
  const [handled, setHandled] = useState<ReadonlySet<string>>(new Set());
  const [appliedCount, setAppliedCount] = useState(0);
  const [stage, setStage] = useState<OcrJobStage | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const formRef = useLatest(form);
  /** Bumped by start/close so a poll still in flight for an older request stops quietly. */
  const epochRef = useRef(0);
  /** The temporary session this hook created and has not yet deleted. */
  const sessionRef = useRef<string | null>(null);

  /** Deletes the temporary session, if there is one, so no copy of the scans stays on the server. */
  const discard = useCallback(async () => {
    const id = sessionRef.current;
    sessionRef.current = null;
    if (id) await ocrApi.cancel(id).catch(() => undefined);
  }, []);

  // Leaving the screen ends any reading in flight and deletes its session.
  useEffect(
    () => () => {
      epochRef.current += 1;
      void discard();
    },
    [discard],
  );

  const start = useCallback(async () => {
    const mine = (epochRef.current += 1);
    // A second reading replaces the first: the first one's scans must not be left on the server.
    void discard();
    setPhase('READING');
    setErrorCode(null);
    setAnalysis(null);
    setHandled(new Set());
    setAppliedCount(0);
    setStage(null);
    setPageCount(0);
    setStartedAt(Date.now());
    try {
      const started = await ocrApi.startReread(entity, recordId);
      if (epochRef.current !== mine) {
        // Closed, restarted or left while the server was still setting this one up.
        void ocrApi.cancel(started.sessionId).catch(() => undefined);
        return;
      }
      sessionRef.current = started.sessionId;
      setPageCount(started.pages);
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, pollMs));
        if (epochRef.current !== mine) return;
        const job = await ocrApi.job(started.sessionId);
        if (job?.state === 'SUCCEEDED') break;
        if (job?.state === 'FAILED') {
          setErrorCode(job.lastErrorCode ?? 'INTERNAL');
          setPhase('ERROR');
          return;
        }
        setStage(job?.stage ?? null);
      }
      const found = await ocrApi.analysis(started.sessionId);
      if (epochRef.current !== mine) return;
      if (!found) {
        setErrorCode('OCR_INPUT_CHANGED');
        setPhase('ERROR');
        return;
      }
      setAnalysis(toFormPath ? mapFieldNames(found, toFormPath) : found);
      setPhase('DONE');
    } catch (error) {
      if (epochRef.current !== mine) return;
      setErrorCode(errorCodeOf(error));
      setPhase('ERROR');
    }
  }, [entity, recordId, pollMs, toFormPath, discard]);

  // Recomputed from the live form on every render: a field the officer edits to match the image drops out by itself.
  const all = (analysis?.projection.fills ?? [])
    .filter((fill) => !fill.pending)
    .map((fill): Difference => {
      const current = asText(access.read(form, fill.field));
      const proposed = String(fill.value);
      return {
        field: fill.field,
        current,
        proposed,
        serverField: fill.source ?? fill.field,
        orange: fill.policy === 'AI_FILL_MUST_CONFIRM' || fill.warnings.length > 0,
        quote: fill.provenance.quote,
      };
    });
  const differences = all.filter((d) => !sameMeaning(d.current, d.proposed, d.serverField) && !handled.has(d.field));
  const sameCount = all.filter((d) => sameMeaning(d.current, d.proposed, d.serverField)).length;

  const apply = useCallback(
    (field: string) => {
      const fillOf = analysis?.projection.fills.find((f) => f.field === field);
      if (!fillOf) return;
      setForm(access.write(formRef.current, field, String(fillOf.value)));
      setHandled((prev) => new Set(prev).add(field));
      setAppliedCount((n) => n + 1);
    },
    [analysis, access, setForm, formRef],
  );

  const skip = useCallback((field: string) => {
    setHandled((prev) => new Set(prev).add(field));
  }, []);

  /** Closes the comparison and deletes the temporary session, so no copy of the scans stays on the server. */
  const close = useCallback(async () => {
    epochRef.current += 1;
    setPhase('IDLE');
    setAnalysis(null);
    setHandled(new Set());
    setErrorCode(null);
    await discard();
  }, [discard]);

  return { phase, errorCode, stage, pageCount, startedAt, differences, sameCount, appliedCount, start, apply, skip, close };
}
