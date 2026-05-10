import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userShortcutsApi, type UserShortcut } from '@/lib/api';
import { SHORTCUTS, type ShortcutAction, ALL_ACTIONS } from '@/shortcuts/registry';

const QUERY_KEY = ['user-shortcuts'];

/** 30s staleTime — keyboard binding is hot-path; faster sync than the 5min global default. */
const SHORTCUTS_STALE_MS = 30 * 1000;

export function useUserShortcutList() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => userShortcutsApi.list().then((r) => r.data),
    staleTime: SHORTCUTS_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Returns a Map<action, binding> merging registry defaults with DB overrides.
 * Override wins. Memoized so identity is stable across renders unless data changes.
 */
export function useUserShortcutMap(): Map<ShortcutAction, string> {
  const { data = [] } = useUserShortcutList();
  return useMemo(() => {
    const map = new Map<ShortcutAction, string>();
    for (const action of ALL_ACTIONS) {
      map.set(action, SHORTCUTS[action].defaultBinding);
    }
    for (const row of data) {
      if (ALL_ACTIONS.includes(row.action as ShortcutAction)) {
        map.set(row.action as ShortcutAction, row.binding);
      }
    }
    return map;
  }, [data]);
}

// ─── Cross-tab sync via BroadcastChannel ──────────────────────────────────────

const BROADCAST_CHANNEL_NAME = 'pc02-user-shortcuts';
let broadcastChannel: BroadcastChannel | null = null;
function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return broadcastChannel;
}

/**
 * Subscribe to cross-tab broadcasts. Mount once in App.tsx. When another tab
 * mutates shortcuts, this tab invalidates its query so the new bindings take
 * effect within ~500ms instead of waiting for staleTime.
 */
export function useUserShortcutBroadcast(): void {
  const qc = useQueryClient();
  useEffect(() => {
    const bc = getBroadcastChannel();
    if (!bc) return;
    const handler = (event: MessageEvent) => {
      if (event?.data?.type === 'invalidate') {
        qc.invalidateQueries({ queryKey: QUERY_KEY });
      }
    };
    bc.addEventListener('message', handler);
    return () => bc.removeEventListener('message', handler);
  }, [qc]);
}

function broadcastInvalidate() {
  const bc = getBroadcastChannel();
  bc?.postMessage({ type: 'invalidate' });
}

// ─── Mutations with optimistic updates ────────────────────────────────────────

export function useUpsertUserShortcut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, binding }: { action: string; binding: string }) =>
      userShortcutsApi.upsert(action, binding).then((r) => r.data),
    onMutate: async ({ action, binding }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const previous = qc.getQueryData<UserShortcut[]>(QUERY_KEY);
      qc.setQueryData<UserShortcut[]>(QUERY_KEY, (old = []) => {
        const filtered = old.filter((row) => row.action !== action);
        return [
          ...filtered,
          {
            id: `__optimistic_${action}`,
            action,
            binding,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(QUERY_KEY, ctx.previous);
    },
    onSuccess: () => {
      broadcastInvalidate();
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteUserShortcut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: string) => userShortcutsApi.remove(action),
    onMutate: async (action) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const previous = qc.getQueryData<UserShortcut[]>(QUERY_KEY);
      qc.setQueryData<UserShortcut[]>(QUERY_KEY, (old = []) =>
        old.filter((row) => row.action !== action),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(QUERY_KEY, ctx.previous);
    },
    onSuccess: () => {
      broadcastInvalidate();
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useResetUserShortcuts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => userShortcutsApi.resetAll().then((r) => r.data),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const previous = qc.getQueryData<UserShortcut[]>(QUERY_KEY);
      qc.setQueryData<UserShortcut[]>(QUERY_KEY, []);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(QUERY_KEY, ctx.previous);
    },
    onSuccess: () => {
      broadcastInvalidate();
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useSwapUserShortcuts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fromAction, toAction }: { fromAction: string; toAction: string }) =>
      userShortcutsApi.swap(fromAction, toAction).then((r) => r.data),
    onSuccess: () => {
      broadcastInvalidate();
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// ─── Capture-mode flag (consumed by useShortcut) ──────────────────────────────

let captureModeActive = false;
export function setCaptureModeActive(active: boolean): void {
  captureModeActive = active;
}
export function getCaptureModeActive(): boolean {
  return captureModeActive;
}

/**
 * Hook variant for components needing a stable reference to the capture-mode
 * setter. Returns `[isActive, setActive]` analogous to useState semantics.
 */
export function useCaptureMode(): [() => boolean, (active: boolean) => void] {
  const ref = useRef({ get: getCaptureModeActive, set: setCaptureModeActive });
  return [ref.current.get, ref.current.set];
}
