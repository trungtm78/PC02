/**
 * What is true of the WRITES of one record, whichever tab started them: one write at a time, and a revision conflict
 * that locks the record until the person takes the newer data. It lives outside the tabs on purpose: a tab that is left
 * is unmounted, and a lock held only in it would be gone when the person comes back (or opens the other tab).
 */
import { useCallback, useSyncExternalStore } from 'react';
import type { RecordKind } from './types';

interface Slot {
  running: boolean;
  conflict: boolean;
}

const IDLE: Slot = { running: false, conflict: false };
const slots = new Map<string, Slot>();
const listeners = new Map<string, Set<() => void>>();
/** The key of the last write that failed in a way that may have landed: a retry of the SAME action reuses it. */
const failedKeys = new Map<string, { signature: string; key: string }>();

export const slotKeyOf = (kind: RecordKind, recordId: string): string => `${kind}:${recordId}`;

export const readSlot = (slotKey: string): Slot => slots.get(slotKey) ?? IDLE;

export function patchSlot(slotKey: string, patch: Partial<Slot>): void {
  const next = { ...readSlot(slotKey), ...patch };
  // An idle slot is not kept, so the map never grows with the records a person has opened.
  if (next.running || next.conflict) slots.set(slotKey, next);
  else slots.delete(slotKey);
  listeners.get(slotKey)?.forEach((notify) => notify());
}

export const failedKeyOf = (slotKey: string) => failedKeys.get(slotKey) ?? null;
export function rememberFailedKey(slotKey: string, value: { signature: string; key: string } | null): void {
  if (value) failedKeys.set(slotKey, value);
  else failedKeys.delete(slotKey);
}

export function useWriteSlot(slotKey: string): Slot {
  const subscribe = useCallback(
    (notify: () => void) => {
      const set = listeners.get(slotKey) ?? new Set<() => void>();
      set.add(notify);
      listeners.set(slotKey, set);
      return () => {
        set.delete(notify);
        if (set.size === 0) listeners.delete(slotKey);
      };
    },
    [slotKey],
  );
  return useSyncExternalStore(subscribe, () => readSlot(slotKey));
}
