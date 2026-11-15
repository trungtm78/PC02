import { useEffect, useMemo, useRef, useState } from 'react';
import { processingFlowApi } from './api';
import { explainError, type ExplainedError } from './errors';
import type { PreviewScheduleBody, SchedulePreviewDto } from './types';

export const PREVIEW_DEBOUNCE_MS = 400;

export interface PreviewState {
  /** The last answer that was good: kept while a newer one is being asked for, and after a failed one. */
  data: SchedulePreviewDto | null;
  loading: boolean;
  /** Why the LAST request failed; null after a good one. */
  error: ExplainedError | null;
}

interface Settled {
  /** The request body (serialised) this belongs to. */
  key: string | null;
  data: SchedulePreviewDto | null;
  error: ExplainedError | null;
}

/**
 * The deadlines the steps being edited would get, asked of the server after `delayMs` of quiet.
 *
 * A request that has been overtaken is aborted AND its answer is ignored: the answer of an older request that arrives
 * after a newer one's must never replace it (the chart would show the steps as they were two edits ago).
 */
export function usePreviewSchedule(body: PreviewScheduleBody | null, delayMs: number = PREVIEW_DEBOUNCE_MS): PreviewState {
  const key = useMemo(() => (body ? JSON.stringify(body) : null), [body]);
  const [settled, setSettled] = useState<Settled>({ key: null, data: null, error: null });
  const latest = useRef(0);

  useEffect(() => {
    // Every run of this effect is a newer request than all before it, even one that asks nothing.
    const mine = ++latest.current;
    if (key === null) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      processingFlowApi
        .previewSchedule(JSON.parse(key) as PreviewScheduleBody, controller.signal)
        .then((data) => {
          if (mine !== latest.current) return;
          setSettled({ key, data, error: null });
        })
        .catch((err: unknown) => {
          if (mine !== latest.current || controller.signal.aborted) return;
          setSettled((prev) => ({ key, data: prev.data, error: explainError(err) }));
        });
    }, delayMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, delayMs]);

  return {
    data: key === null ? null : settled.data,
    loading: key !== null && settled.key !== key,
    error: key === null ? null : settled.error,
  };
}
