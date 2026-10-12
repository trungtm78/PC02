/**
 * The grid's keyboard, as data. A key press is looked up in `BINDINGS` and
 * turned into a command; the component only executes commands. Adding or
 * changing a key is a one-line table edit with its own test, never a new
 * branch in an event handler.
 *
 * Three modes mirror Excel:
 *   nav    a cell is selected, nothing is being typed
 *   enter  the officer started typing over a cell ("Enter" mode): arrow keys
 *          confirm the text and move on
 *   edit   F2 / double-click opened the existing text ("Edit" mode): arrow
 *          keys move the caret inside the text
 *
 * Nothing is ever resolved while an IME composition is in progress (Telex /
 * VNI turn several key presses into one letter); the editor must not steal
 * those keys.
 */

export type GridMode = 'nav' | 'enter' | 'edit';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type GridCommand =
  | { type: 'move'; dir: Direction; extend: boolean; jump: boolean }
  | { type: 'tab'; back: boolean }
  | { type: 'enter'; back: boolean }
  | { type: 'home' }
  | { type: 'end' }
  | { type: 'gridStart' }
  | { type: 'gridEnd' }
  | { type: 'page'; dir: 'up' | 'down'; extend: boolean }
  | { type: 'selectAll' }
  | { type: 'beginEdit' }
  | { type: 'beginOverwrite' }
  | { type: 'commit' }
  | { type: 'cancel' }
  | { type: 'clear' }
  | { type: 'newline' }
  | { type: 'insertToday' }
  | { type: 'insertNow' }
  | { type: 'undo' }
  | { type: 'redo' }
  /** Nothing to do, but the browser must not act on it either (e.g. a stray Tab in the editor). */
  | { type: 'swallow' };

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  keyCode?: number;
}

interface Binding {
  key: string;
  /** Ctrl (or Cmd on macOS). undefined = either. */
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  modes: readonly GridMode[];
  command: GridCommand | ((e: KeyLike) => GridCommand);
}

const NAV: readonly GridMode[] = ['nav'];
const NAV_ENTER: readonly GridMode[] = ['nav', 'enter'];
const ALL: readonly GridMode[] = ['nav', 'enter', 'edit'];
const TYPING: readonly GridMode[] = ['enter', 'edit'];

const arrows: Array<[string, Direction]> = [
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
];

const BINDINGS: readonly Binding[] = [
  // Arrows: free movement in nav mode; in Enter mode they confirm and move (never extend/jump).
  ...arrows.flatMap(([key, dir]): Binding[] => [
    { key, ctrl: false, shift: false, modes: NAV_ENTER, command: { type: 'move', dir, extend: false, jump: false } },
    { key, ctrl: false, shift: true, modes: NAV, command: { type: 'move', dir, extend: true, jump: false } },
    { key, ctrl: true, shift: false, modes: NAV, command: { type: 'move', dir, extend: false, jump: true } },
    { key, ctrl: true, shift: true, modes: NAV, command: { type: 'move', dir, extend: true, jump: true } },
  ]),

  // Tab / Enter walk the input cells; in the editor they confirm first.
  // Ctrl+Tab / Ctrl+Shift+Tab switch browser tabs: never a cell move.
  { key: 'Tab', ctrl: false, shift: false, modes: ALL, command: { type: 'tab', back: false } },
  { key: 'Tab', ctrl: false, shift: true, modes: ALL, command: { type: 'tab', back: true } },
  { key: 'Enter', ctrl: false, shift: false, modes: ALL, command: { type: 'enter', back: false } },
  { key: 'Enter', ctrl: false, shift: true, modes: ALL, command: { type: 'enter', back: true } },
  { key: 'Enter', ctrl: false, shift: false, alt: true, modes: TYPING, command: { type: 'newline' } },

  { key: 'Home', ctrl: false, shift: false, modes: NAV, command: { type: 'home' } },
  { key: 'End', ctrl: false, shift: false, modes: NAV, command: { type: 'end' } },
  { key: 'Home', ctrl: true, shift: false, modes: NAV, command: { type: 'gridStart' } },
  { key: 'End', ctrl: true, shift: false, modes: NAV, command: { type: 'gridEnd' } },
  { key: 'PageUp', ctrl: false, modes: NAV, command: (e) => ({ type: 'page', dir: 'up', extend: !!e.shiftKey }) },
  { key: 'PageDown', ctrl: false, modes: NAV, command: (e) => ({ type: 'page', dir: 'down', extend: !!e.shiftKey }) },

  { key: 'F2', ctrl: false, shift: false, alt: false, modes: NAV, command: { type: 'beginEdit' } },
  { key: 'F2', ctrl: false, shift: false, alt: false, modes: ['enter'], command: { type: 'beginEdit' } },
  { key: 'Escape', modes: TYPING, command: { type: 'cancel' } },
  { key: 'Delete', ctrl: false, modes: NAV, command: { type: 'clear' } },
  { key: 'Backspace', ctrl: false, modes: NAV, command: { type: 'beginOverwrite' } },

  { key: 'a', ctrl: true, shift: false, modes: NAV, command: { type: 'selectAll' } },
  { key: 'z', ctrl: true, shift: false, modes: NAV, command: { type: 'undo' } },
  { key: 'y', ctrl: true, shift: false, modes: NAV, command: { type: 'redo' } },
  { key: 'z', ctrl: true, shift: true, modes: NAV, command: { type: 'redo' } },
  { key: ';', ctrl: true, shift: false, modes: ALL, command: { type: 'insertToday' } },
  { key: ';', ctrl: true, shift: true, modes: ALL, command: { type: 'insertNow' } },
  // With Shift held a US/Vietnamese keyboard reports ':' for that same physical key.
  { key: ':', ctrl: true, shift: true, modes: ALL, command: { type: 'insertNow' } },
];

const NAMED_KEYS_THAT_ARE_NOT_TEXT = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock', 'ContextMenu', 'Dead',
  'Process', 'Unidentified', 'Insert', 'PrintScreen', 'Pause', 'Fn', 'FnLock', 'OS',
]);

/** True when the key press produces a character (so it should start typing over the cell). */
export function isPrintable(e: KeyLike): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (NAMED_KEYS_THAT_ARE_NOT_TEXT.has(e.key)) return false;
  // One code point: a letter, digit, symbol or emoji. "Enter", "F2", "ArrowUp"… are longer.
  return [...e.key].length === 1;
}

function matches(b: Binding, e: KeyLike): boolean {
  const ctrl = !!(e.ctrlKey || e.metaKey);
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (b.key.toLowerCase() !== key.toLowerCase()) return false;
  if (b.ctrl !== undefined && b.ctrl !== ctrl) return false;
  if (b.shift !== undefined && b.shift !== !!e.shiftKey) return false;
  // Alt is never ignored: Alt+Left is the browser's Back, Alt+Enter is a newline, nothing else uses it.
  if ((b.alt ?? false) !== !!e.altKey) return false;
  return true;
}

/**
 * The command for a key press, or null when the grid has nothing to do with
 * it (the browser, the IME or the clipboard events handle it). Ctrl+C/X/V are
 * deliberately absent: they arrive as copy/cut/paste events.
 */
export function resolveKey(e: KeyLike, mode: GridMode): GridCommand | null {
  if (e.isComposing || e.keyCode === 229 || e.key === 'Process') return null;
  for (const b of BINDINGS) {
    if (!b.modes.includes(mode) || !matches(b, e)) continue;
    return typeof b.command === 'function' ? b.command(e) : b.command;
  }
  if (mode === 'nav' && isPrintable(e)) return { type: 'beginOverwrite' };
  return null;
}
