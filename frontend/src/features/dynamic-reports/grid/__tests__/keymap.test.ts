import { describe, expect, it } from 'vitest';
import { isPrintable, resolveKey } from '../keymap';
import type { GridMode, KeyLike } from '../keymap';

const k = (key: string, mods: Partial<KeyLike> = {}): KeyLike => ({ key, ...mods });
const cmd = (key: string, mode: GridMode, mods: Partial<KeyLike> = {}) => resolveKey(k(key, mods), mode);

describe('nav mode', () => {
  it.each([
    ['ArrowUp', 'up'],
    ['ArrowDown', 'down'],
    ['ArrowLeft', 'left'],
    ['ArrowRight', 'right'],
  ] as const)('%s moves, Shift extends, Ctrl jumps, Ctrl+Shift does both', (key, dir) => {
    expect(cmd(key, 'nav')).toEqual({ type: 'move', dir, extend: false, jump: false });
    expect(cmd(key, 'nav', { shiftKey: true })).toEqual({ type: 'move', dir, extend: true, jump: false });
    expect(cmd(key, 'nav', { ctrlKey: true })).toEqual({ type: 'move', dir, extend: false, jump: true });
    expect(cmd(key, 'nav', { ctrlKey: true, shiftKey: true })).toEqual({ type: 'move', dir, extend: true, jump: true });
    expect(cmd(key, 'nav', { metaKey: true })).toEqual({ type: 'move', dir, extend: false, jump: true });
  });

  it('Alt+Arrow belongs to the browser (Back / Forward)', () => {
    expect(cmd('ArrowLeft', 'nav', { altKey: true })).toBeNull();
    expect(cmd('ArrowRight', 'nav', { altKey: true })).toBeNull();
  });

  it('Tab and Enter walk forwards, Shift reverses', () => {
    expect(cmd('Tab', 'nav')).toEqual({ type: 'tab', back: false });
    expect(cmd('Tab', 'nav', { shiftKey: true })).toEqual({ type: 'tab', back: true });
    expect(cmd('Enter', 'nav')).toEqual({ type: 'enter', back: false });
    expect(cmd('Enter', 'nav', { shiftKey: true })).toEqual({ type: 'enter', back: true });
  });

  it('Home / End / Ctrl+Home / Ctrl+End / PageUp / PageDown', () => {
    expect(cmd('Home', 'nav')).toEqual({ type: 'home' });
    expect(cmd('End', 'nav')).toEqual({ type: 'end' });
    expect(cmd('Home', 'nav', { ctrlKey: true })).toEqual({ type: 'gridStart' });
    expect(cmd('End', 'nav', { ctrlKey: true })).toEqual({ type: 'gridEnd' });
    expect(cmd('PageDown', 'nav')).toEqual({ type: 'page', dir: 'down', extend: false });
    expect(cmd('PageUp', 'nav', { shiftKey: true })).toEqual({ type: 'page', dir: 'up', extend: true });
  });

  it('F2 edits; Delete clears; Backspace starts over an empty cell', () => {
    expect(cmd('F2', 'nav')).toEqual({ type: 'beginEdit' });
    expect(cmd('Delete', 'nav')).toEqual({ type: 'clear' });
    expect(cmd('Backspace', 'nav')).toEqual({ type: 'beginOverwrite' });
  });

  it('Ctrl+A, Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z', () => {
    expect(cmd('a', 'nav', { ctrlKey: true })).toEqual({ type: 'selectAll' });
    expect(cmd('A', 'nav', { ctrlKey: true })).toEqual({ type: 'selectAll' });
    expect(cmd('z', 'nav', { ctrlKey: true })).toEqual({ type: 'undo' });
    expect(cmd('y', 'nav', { ctrlKey: true })).toEqual({ type: 'redo' });
    expect(cmd('Z', 'nav', { ctrlKey: true, shiftKey: true })).toEqual({ type: 'redo' });
  });

  it('typing a character starts typing over the cell', () => {
    for (const key of ['5', 'a', 'Đ', '-', ',', '.', ' ', '😀']) {
      expect(cmd(key, 'nav')).toEqual({ type: 'beginOverwrite' });
    }
  });

  it('modifier-only, function and navigation keys never start typing', () => {
    for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'F5', 'F12', 'Escape', 'Insert', 'ContextMenu', 'Dead']) {
      expect(cmd(key, 'nav')).toBeNull();
    }
  });

  it('Ctrl+C / X / V are left to the clipboard events', () => {
    for (const key of ['c', 'x', 'v']) expect(cmd(key, 'nav', { ctrlKey: true })).toBeNull();
  });

  it('Ctrl+; inserts today, Ctrl+Shift+; the time (the browser reports ":" while Shift is held)', () => {
    expect(cmd(';', 'nav', { ctrlKey: true })).toEqual({ type: 'insertToday' });
    expect(cmd(':', 'nav', { ctrlKey: true, shiftKey: true })).toEqual({ type: 'insertNow' });
    expect(cmd(';', 'nav', { ctrlKey: true, shiftKey: true })).toEqual({ type: 'insertNow' });
  });

  it('Ctrl+Tab and Ctrl+Shift+Tab switch browser tabs, never cells', () => {
    for (const mode of ['nav', 'enter', 'edit'] as const) {
      expect(cmd('Tab', mode, { ctrlKey: true })).toBeNull();
      expect(cmd('Tab', mode, { ctrlKey: true, shiftKey: true })).toBeNull();
      expect(cmd('Tab', mode, { metaKey: true })).toBeNull();
    }
  });
});

describe('enter mode (typing over a cell)', () => {
  it('Enter / Tab / arrows confirm and move on', () => {
    expect(cmd('Enter', 'enter')).toEqual({ type: 'enter', back: false });
    expect(cmd('Tab', 'enter', { shiftKey: true })).toEqual({ type: 'tab', back: true });
    expect(cmd('ArrowDown', 'enter')).toEqual({ type: 'move', dir: 'down', extend: false, jump: false });
  });
  it('Escape cancels; Alt+Enter adds a line; F2 switches to editing the text', () => {
    expect(cmd('Escape', 'enter')).toEqual({ type: 'cancel' });
    expect(cmd('Enter', 'enter', { altKey: true })).toEqual({ type: 'newline' });
    expect(cmd('F2', 'enter')).toEqual({ type: 'beginEdit' });
  });
  it('ordinary characters are left to the textarea', () => {
    expect(cmd('a', 'enter')).toBeNull();
    expect(cmd('5', 'enter')).toBeNull();
  });
  it('Shift+arrows and Ctrl+arrows are left to the textarea', () => {
    expect(cmd('ArrowLeft', 'enter', { shiftKey: true })).toBeNull();
    expect(cmd('ArrowLeft', 'enter', { ctrlKey: true })).toBeNull();
  });
});

describe('edit mode (F2: caret inside the text)', () => {
  it('arrows, Home, End and Delete belong to the caret', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Delete', 'Backspace']) {
      expect(cmd(key, 'edit')).toBeNull();
    }
  });
  it('Enter, Tab and Escape still confirm / cancel', () => {
    expect(cmd('Enter', 'edit')).toEqual({ type: 'enter', back: false });
    expect(cmd('Enter', 'edit', { shiftKey: true })).toEqual({ type: 'enter', back: true });
    expect(cmd('Tab', 'edit')).toEqual({ type: 'tab', back: false });
    expect(cmd('Escape', 'edit')).toEqual({ type: 'cancel' });
  });
  it('Ctrl+Z / Ctrl+A act on the text, not on the grid', () => {
    expect(cmd('z', 'edit', { ctrlKey: true })).toBeNull();
    expect(cmd('a', 'edit', { ctrlKey: true })).toBeNull();
  });
  it('Alt+Enter inserts a newline', () => {
    expect(cmd('Enter', 'edit', { altKey: true })).toEqual({ type: 'newline' });
  });
});

describe('IME composition (Telex / VNI)', () => {
  it('never resolves a key while composing, in any mode', () => {
    for (const mode of ['nav', 'enter', 'edit'] as const) {
      expect(resolveKey({ key: 'Enter', isComposing: true }, mode)).toBeNull();
      expect(resolveKey({ key: 'a', isComposing: true }, mode)).toBeNull();
      expect(resolveKey({ key: 'Tab', keyCode: 229 }, mode)).toBeNull();
      expect(resolveKey({ key: 'Process' }, mode)).toBeNull();
    }
  });
});

describe('isPrintable', () => {
  it('rejects chords', () => {
    expect(isPrintable(k('a', { ctrlKey: true }))).toBe(false);
    expect(isPrintable(k('a', { altKey: true }))).toBe(false);
    expect(isPrintable(k('a', { metaKey: true }))).toBe(false);
  });
  it('accepts Shift (capital letters, symbols)', () => {
    expect(isPrintable(k('A', { shiftKey: true }))).toBe(true);
    expect(isPrintable(k('!', { shiftKey: true }))).toBe(true);
  });
});
