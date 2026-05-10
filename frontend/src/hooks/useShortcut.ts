import { useCallback, useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  SHORTCUTS,
  type ShortcutAction,
  type ShortcutScope,
} from '@/shortcuts/registry';
import { useUserShortcutMap, getCaptureModeActive } from './useUserShortcuts';

export interface UseShortcutOptions {
  /** When false, the shortcut is detached. Default true. */
  enabled?: boolean;
  /** Override registry scope for this subscription. Rare. */
  scope?: ShortcutScope;
  /** Default true. */
  preventDefault?: boolean;
}

/**
 * Convert canonical binding ("Ctrl+Shift+S", "Shift+Slash", "F9") to the format
 * react-hotkeys-hook expects ("ctrl+shift+s", "shift+slash", "f9").
 */
function toHotkeysFormat(canonical: string): string {
  return canonical.toLowerCase();
}

/**
 * Subscribe a component to a shortcut action.
 *
 * - Reads binding from the user's overrides + registry defaults.
 * - Skips when the user is typing in input/textarea/contenteditable, unless the
 *   action is `fireInInputs=true` (F9 / F10) or scope='global' (Ctrl+K search).
 * - Skips while the Settings capture-mode is active so users binding new keys do
 *   not trigger save/delete/etc. simultaneously.
 * - Modal scope wins over form/list scope when a `[role="dialog"]` is present.
 *
 * Pattern:
 *   const handleSave = () => { ... };
 *   useShortcut('save', handleSave);
 */
export function useShortcut(
  action: ShortcutAction,
  handler: (event: KeyboardEvent) => void,
  options: UseShortcutOptions = {},
): void {
  const def = SHORTCUTS[action];
  const map = useUserShortcutMap();
  const binding = map.get(action) ?? def.defaultBinding;
  const scope = options.scope ?? def.scope;
  const fireInInputs = def.fireInInputs === true;
  const preventDefault = options.preventDefault !== false;
  const enabled = options.enabled !== false;

  // Stable wrapper that consults runtime guards (modal, capture mode) before
  // forwarding to the handler. This is reconstructed when `binding` or `scope`
  // changes — react-hotkeys-hook re-binds the listener accordingly.
  const wrapped = useCallback(
    (event: KeyboardEvent) => {
      // Skip while Settings is capturing a new binding.
      if (getCaptureModeActive()) return;

      // Skip key-repeat and IME composition events.
      if (event.repeat || event.isComposing) return;

      // Modal priority: when a dialog is open, only modal-scope shortcuts fire.
      const modalOpen = !!document.querySelector(
        '[role="dialog"]:not([aria-hidden="true"]), dialog[open]',
      );
      if (modalOpen && scope !== 'modal') {
        // Hard-reserve Escape for modal close even if the user rebinds `cancel`.
        if (binding === 'Escape') return;
        return;
      }

      // Skip in inputs unless explicitly allowed.
      const target = event.target as HTMLElement | null;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target?.isContentEditable === true);
      if (target instanceof HTMLInputElement && target.type === 'password') {
        return;
      }
      if (isInput && !fireInInputs && scope !== 'global') return;

      if (preventDefault) event.preventDefault();

      // Lightweight telemetry — replace with real logger when infra exists.
      if (typeof console !== 'undefined') {
        // eslint-disable-next-line no-console
        console.debug('[shortcut]', action, binding);
      }

      handler(event);
    },
    [action, binding, scope, fireInInputs, preventDefault, handler],
  );

  // react-hotkeys-hook options: enableOnFormTags / enableOnContentEditable so
  // we receive events in inputs and decide via our own logic above.
  const hotkeysOptions = useMemo(
    () => ({
      enabled,
      enableOnFormTags: ['INPUT', 'TEXTAREA', 'SELECT'] as Array<'INPUT' | 'TEXTAREA' | 'SELECT'>,
      enableOnContentEditable: true,
      preventDefault: false, // We call preventDefault ourselves for clarity.
    }),
    [enabled],
  );

  useHotkeys(toHotkeysFormat(binding), wrapped, hotkeysOptions, [wrapped, binding]);
}
