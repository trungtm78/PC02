/**
 * Text a person has typed into a form of the Results tab and not sent yet. It lives outside the form so that it
 * survives what unmounts the form: leaving the tab, or the refresh after a conflict changing the step so that the form
 * is no longer offered. It is dropped only when the write went through or the person cancels.
 */
import { useCallback, useState } from 'react';

const drafts = new Map<string, unknown>();

export const hasDraft = (key: string): boolean => drafts.has(key);

/** A step has something typed and not sent in any of its forms. */
export const stepHasDraft = (kind: string, recordId: string, stepKey: string): boolean => {
  const prefix = `${kind}:${recordId}:${stepKey}:`;
  for (const key of drafts.keys()) if (key.startsWith(prefix)) return true;
  return false;
};

export type DraftSetter<T> = (next: T | ((prev: T) => T)) => void;

export function useDraft<T>(key: string, initial: () => T): [T, DraftSetter<T>, () => void] {
  const [value, setValue] = useState<T>(() => (drafts.has(key) ? (drafts.get(key) as T) : initial()));

  const set = useCallback<DraftSetter<T>>(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        drafts.set(key, resolved);
        return resolved;
      });
    },
    [key],
  );
  const clear = useCallback(() => {
    drafts.delete(key);
    setValue(initial());
  }, [key, initial]);
  return [value, set, clear];
}

/** Draft keys of a step's three forms. */
export const draftKeys = (kind: string, recordId: string, stepKey: string) => ({
  report: `${kind}:${recordId}:${stepKey}:report`,
  editReport: (reportId: string) => `${kind}:${recordId}:${stepKey}:edit:${reportId}`,
  opinion: `${kind}:${recordId}:${stepKey}:opinion`,
  decision: `${kind}:${recordId}:${stepKey}:decision`,
});
