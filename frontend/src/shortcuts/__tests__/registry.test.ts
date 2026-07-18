import { describe, it, expect } from 'vitest';
import {
  ALL_ACTIONS,
  BINDING_REGEX,
  BROWSER_RESERVED,
  SHORTCUTS,
  bindingMatches,
  formatBinding,
  isBrowserReserved,
  normalizeBindingText,
  parseKey,
  serializeKey,
} from '../registry';

function ke(opts: Partial<KeyboardEventInit & { code?: string }>): KeyboardEvent {
  // code nằm trong KeyboardEventInit ở lib types hiện tại nên không cần ép.
  return new KeyboardEvent('keydown', opts);
}

describe('SHORTCUTS registry', () => {
  it('every ShortcutAction has an entry in SHORTCUTS', () => {
    for (const action of ALL_ACTIONS) {
      expect(SHORTCUTS[action]).toBeDefined();
      expect(SHORTCUTS[action].defaultBinding).toMatch(BINDING_REGEX);
    }
  });

  it('all default bindings pass BINDING_REGEX', () => {
    for (const action of ALL_ACTIONS) {
      expect(BINDING_REGEX.test(SHORTCUTS[action].defaultBinding)).toBe(true);
    }
  });

  it('groups are limited to canonical Vietnamese labels', () => {
    const validGroups = new Set([
      'Toàn cục',
      'Trong form',
      'Trong danh sách',
      'Trong nhập liệu',
    ]);
    for (const action of ALL_ACTIONS) {
      expect(validGroups.has(SHORTCUTS[action].group)).toBe(true);
    }
  });

  it('default F-key bindings theo yêu cầu: Lưu=F2, Xóa=F3, Xuất Word=F4', () => {
    expect(SHORTCUTS.save.defaultBinding).toBe('F2');
    expect(SHORTCUTS.delete.defaultBinding).toBe('F3');
    expect(SHORTCUTS.exportDocx).toBeDefined();
    expect(SHORTCUTS.exportDocx.defaultBinding).toBe('F4');
  });

  it('save/delete/exportDocx phải fireInInputs (F-key chạy cả khi đang gõ trong field)', () => {
    expect(SHORTCUTS.save.fireInInputs).toBe(true);
    expect(SHORTCUTS.delete.fireInInputs).toBe(true);
    expect(SHORTCUTS.exportDocx.fireInInputs).toBe(true);
  });

  it('action list (newRecord/refreshList/export) fireInInputs — chạy kể cả khi con trỏ trong ô tìm kiếm', () => {
    expect(SHORTCUTS.newRecord.fireInInputs).toBe(true);
    expect(SHORTCUTS.refreshList.fireInInputs).toBe(true);
    expect(SHORTCUTS.export.fireInInputs).toBe(true);
  });

  it('resetForm (init/làm trống form) tồn tại, default F8, fireInInputs', () => {
    expect(SHORTCUTS.resetForm).toBeDefined();
    expect(SHORTCUTS.resetForm.defaultBinding).toBe('F8');
    expect(SHORTCUTS.resetForm.scope).toBe('form');
    expect(SHORTCUTS.resetForm.fireInInputs).toBe(true);
  });

  it('KHÔNG có 2 action trùng defaultBinding trong CÙNG scope (tránh xung đột dispatch)', () => {
    const byScope = new Map<string, Map<string, string>>();
    for (const action of ALL_ACTIONS) {
      const def = SHORTCUTS[action];
      const scopeMap = byScope.get(def.scope) ?? new Map<string, string>();
      const clash = scopeMap.get(def.defaultBinding);
      expect(
        clash,
        `Trùng phím ${def.defaultBinding} trong scope ${def.scope}: ${clash} & ${action}`,
      ).toBeUndefined();
      scopeMap.set(def.defaultBinding, action);
      byScope.set(def.scope, scopeMap);
    }
  });
});

describe('serializeKey()', () => {
  it('serializes letter via e.code (KeyA → A)', () => {
    expect(serializeKey(ke({ key: 'a', code: 'KeyA' }))).toBe('A');
  });

  it('serializes digit via e.code (Digit8 → 8)', () => {
    expect(serializeKey(ke({ key: '8', code: 'Digit8' }))).toBe('8');
  });

  it('serializes letter with modifiers in canonical order', () => {
    expect(
      serializeKey(
        ke({ key: 'S', code: 'KeyS', ctrlKey: true, shiftKey: true }),
      ),
    ).toBe('Ctrl+Shift+S');
    expect(
      serializeKey(
        ke({ key: 'p', code: 'KeyP', ctrlKey: true, altKey: true }),
      ),
    ).toBe('Ctrl+Alt+P');
  });

  it('serializes named keys (Escape, Enter, F9)', () => {
    expect(serializeKey(ke({ key: 'Escape', code: 'Escape' }))).toBe('Escape');
    expect(serializeKey(ke({ key: 'F9', code: 'F9' }))).toBe('F9');
  });

  it('returns null for stand-alone modifier press', () => {
    expect(serializeKey(ke({ key: 'Control', code: 'ControlLeft' }))).toBeNull();
    expect(serializeKey(ke({ key: 'Shift', code: 'ShiftLeft' }))).toBeNull();
  });

  it('serializes Shift+8 as Shift+8 (e.code wins over Vietnamese-layout e.key)', () => {
    // On Vietnamese layout Shift+8 might give "*" via e.key. e.code stays Digit8.
    expect(serializeKey(ke({ key: '*', code: 'Digit8', shiftKey: true }))).toBe('Shift+8');
  });
});

describe('parseKey()', () => {
  it('parses "Ctrl+Shift+S" into modifier flags + key', () => {
    expect(parseKey('Ctrl+Shift+S')).toEqual({
      ctrl: true, alt: false, shift: true, meta: false, key: 'S',
    });
  });

  it('parses bare "Escape"', () => {
    expect(parseKey('Escape')).toEqual({
      ctrl: false, alt: false, shift: false, meta: false, key: 'Escape',
    });
  });

  it('returns null for unknown modifier', () => {
    expect(parseKey('Hyper+S')).toBeNull();
  });
});

describe('bindingMatches()', () => {
  it('matches when serializeKey(event) === binding', () => {
    expect(
      bindingMatches('Ctrl+Shift+S', ke({ key: 'S', code: 'KeyS', ctrlKey: true, shiftKey: true })),
    ).toBe(true);
    expect(
      bindingMatches('Ctrl+S', ke({ key: 'S', code: 'KeyS', ctrlKey: true })),
    ).toBe(true);
  });

  it('does not match when modifier differs', () => {
    expect(
      bindingMatches('Ctrl+Shift+S', ke({ key: 'S', code: 'KeyS', ctrlKey: true })),
    ).toBe(false);
  });
});

describe('BROWSER_RESERVED', () => {
  it('contains expected browser conflict keys', () => {
    expect(BROWSER_RESERVED.has('Ctrl+S')).toBe(true);
    expect(BROWSER_RESERVED.has('Ctrl+P')).toBe(true);
    expect(BROWSER_RESERVED.has('F5')).toBe(true);
    expect(BROWSER_RESERVED.has('F11')).toBe(true);
  });

  it('does NOT contain safe combos used as defaults', () => {
    expect(BROWSER_RESERVED.has('Ctrl+Shift+S')).toBe(false);
    expect(BROWSER_RESERVED.has('Alt+R')).toBe(false);
    expect(BROWSER_RESERVED.has('Ctrl+K')).toBe(false);
    expect(BROWSER_RESERVED.has('F9')).toBe(false);
  });

  it('isBrowserReserved() helper agrees with the Set', () => {
    expect(isBrowserReserved('Ctrl+S')).toBe(true);
    expect(isBrowserReserved('Alt+R')).toBe(false);
  });
});

describe('normalizeBindingText() — text input mode', () => {
  it('normalizes case (ctrl+s → Ctrl+S)', () => {
    expect(normalizeBindingText('ctrl+s')).toBe('Ctrl+S');
    expect(normalizeBindingText('CTRL+SHIFT+S')).toBe('Ctrl+Shift+S');
  });

  it('reorders modifiers into canonical order', () => {
    expect(normalizeBindingText('Shift+Ctrl+A')).toBe('Ctrl+Shift+A');
    expect(normalizeBindingText('Meta+Alt+Shift+Ctrl+X')).toBe('Ctrl+Alt+Shift+Meta+X');
  });

  it('handles modifier aliases (cmd → Meta, option → Alt)', () => {
    expect(normalizeBindingText('cmd+k')).toBe('Meta+K');
    expect(normalizeBindingText('option+n')).toBe('Alt+N');
    expect(normalizeBindingText('control+s')).toBe('Ctrl+S');
  });

  it('handles `?` → Shift+Slash', () => {
    expect(normalizeBindingText('?')).toBe('Shift+Slash');
  });

  it('handles named keys typed in mixed case', () => {
    expect(normalizeBindingText('escape')).toBe('Escape');
    expect(normalizeBindingText('ESC')).toBe('Escape');
    expect(normalizeBindingText('return')).toBe('Enter');
  });

  it('handles digits and letters', () => {
    expect(normalizeBindingText('Alt+8')).toBe('Alt+8');
    expect(normalizeBindingText('alt+shift+8')).toBe('Alt+Shift+8');
    expect(normalizeBindingText('a')).toBe('A');
  });

  it('returns null for empty / invalid input', () => {
    expect(normalizeBindingText('')).toBeNull();
    expect(normalizeBindingText('   ')).toBeNull();
    expect(normalizeBindingText('not-a-key')).toBeNull();
    expect(normalizeBindingText('Hyper+X')).toBeNull();
  });

  it('forgives duplicate modifier (Ctrl+Ctrl+S → Ctrl+S — collapses duplicates)', () => {
    // Implementation is forgiving: duplicate Ctrl is folded into a single Ctrl modifier.
    expect(normalizeBindingText('Ctrl+Ctrl+S')).toBe('Ctrl+S');
  });
});

describe('formatBinding (hiển thị đẹp)', () => {
  it('giữ nguyên modifier + phím thường', () => {
    expect(formatBinding('Alt+N')).toBe('Alt+N');
    expect(formatBinding('Ctrl+E')).toBe('Ctrl+E');
    expect(formatBinding('F2')).toBe('F2');
    expect(formatBinding('Ctrl+Shift+Q')).toBe('Ctrl+Shift+Q');
  });

  it('tổ hợp đầy đủ có ký hiệu thân thiện: Shift+Slash → ?', () => {
    expect(formatBinding('Shift+Slash')).toBe('?');
  });

  it('đổi named key sang ký hiệu: mũi tên, Escape, Slash', () => {
    expect(formatBinding('ArrowUp')).toBe('↑');
    expect(formatBinding('ArrowDown')).toBe('↓');
    expect(formatBinding('Escape')).toBe('Esc');
    expect(formatBinding('Slash')).toBe('/');
    expect(formatBinding('Alt+ArrowLeft')).toBe('Alt+←');
  });

  it('chuỗi rỗng → rỗng', () => {
    expect(formatBinding('')).toBe('');
  });

  it('mọi defaultBinding format được, không rỗng', () => {
    for (const action of ALL_ACTIONS) {
      expect(formatBinding(SHORTCUTS[action].defaultBinding)).toBeTruthy();
    }
  });
});
