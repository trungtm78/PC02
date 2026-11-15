/**
 * One write at a time on the flow of a record, with the rules every write shares:
 *   - every control is disabled while a write runs;
 *   - the answer (the WHOLE new flow) goes straight into the cache;
 *   - a fresh idempotency key per user action; a retry of the SAME action after a failure that may have reached the
 *     server (no answer, or a 5xx) reuses the key, so a write that did land is never done twice;
 *   - a 409 REVISION_CONFLICT LOCKS the screen: the contents on it are of an older revision, the refresh has already
 *     moved the cache on under it, so nothing may be written until the person has taken the newer data.
 */
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from '@/lib/uuid';
import { explainError } from '../errors';
import { RECORD_QUERY_KEYS } from './queryKeys';
import { failedKeyOf, patchSlot, readSlot, rememberFailedKey, slotKeyOf, useWriteSlot } from './recordWriteSlot';
import type { RecordFlowHandle } from './useRecordFlow';
import type { RecordFlowDto, RecordKind } from './types';

export interface RecordWrite {
  busy: boolean;
  /** A control is disabled while a write runs or after a conflict. */
  locked: boolean;
  error: string | null;
  message: string | null;
  conflict: boolean;
  setError: (text: string | null) => void;
  /** Run one write. `signature` names the user action (route + the typed contents) for the idempotency key. */
  run: (signature: string, job: (idempotencyKey: string) => Promise<RecordFlowDto>, doneMessage?: string) => Promise<boolean>;
  /** The person takes the newer data (or retries the refresh that failed). `onTaken` closes what was built on the old one. */
  takeNewer: (onTaken?: () => void) => void;
}

export function useRecordWrite(kind: RecordKind, recordId: string, handle: RecordFlowHandle): RecordWrite {
  const queryClient = useQueryClient();
  // The lock and the running write belong to the RECORD, not to the tab that started them (see recordWriteSlot).
  const slotKey = slotKeyOf(kind, recordId);
  const { running: busy, conflict } = useWriteSlot(slotKey);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { setFlow, refetch, refreshFailed } = handle;

  const run = useCallback<RecordWrite['run']>(
    async (signature, job, doneMessage) => {
      const now = readSlot(slotKey);
      if (now.running || now.conflict) return false;
      patchSlot(slotKey, { running: true });
      setError(null);
      setMessage(null);
      const failed = failedKeyOf(slotKey);
      const key = failed?.signature === signature ? failed.key : randomUUID();
      try {
        // A read already on its way would answer the revision from before this write.
        await queryClient.cancelQueries({ queryKey: RECORD_QUERY_KEYS.flow(kind, recordId) });
        const next = await job(key);
        rememberFailedKey(slotKey, null);
        setFlow(next);
        void queryClient.invalidateQueries({ queryKey: RECORD_QUERY_KEYS.allResults(kind, recordId) });
        setMessage(doneMessage ?? null);
        return true;
      } catch (err) {
        const e = explainError(err);
        // No answer at all (status 0 / none) or a server fault: the write may have landed, so a retry reuses the key.
        rememberFailedKey(slotKey, !e.status || e.status >= 500 ? { signature, key } : null);
        if (e.conflict) {
          patchSlot(slotKey, { conflict: true });
          void refetch();
          void queryClient.invalidateQueries({ queryKey: RECORD_QUERY_KEYS.allResults(kind, recordId) });
        } else {
          setError(e.message);
        }
        return false;
      } finally {
        patchSlot(slotKey, { running: false });
      }
    },
    [slotKey, kind, recordId, queryClient, refetch, setFlow],
  );

  const takeNewer = useCallback(
    (onTaken?: () => void) => {
      if (refreshFailed) {
        void refetch();
        return;
      }
      patchSlot(slotKey, { conflict: false });
      setError(null);
      onTaken?.();
    },
    [slotKey, refreshFailed, refetch],
  );

  return { busy, locked: busy || conflict, error, message, conflict, setError, run, takeNewer };
}
