/**
 * Keyboard shortcut registry — single source of truth for the application.
 *
 * Each `ShortcutAction` defines a default binding, scope, and label. Users may
 * override the binding via Settings; FE registry defaults are the fallback when
 * no per-user override exists in DB.
 *
 * Bindings use canonical form: `Ctrl+Alt+Shift+Meta+KEY` (modifiers in fixed
 * order). Helper `serializeKey` converts a KeyboardEvent to canonical form.
 *
 * IMPORTANT: BINDING_REGEX MUST mirror backend/src/user-shortcuts/binding-regex.const.ts.
 * Update both when adding a new key class.
 */

export type ShortcutAction =
  | 'save'
  | 'saveDraft'
  | 'cancel'
  | 'search'
  | 'newRecord'
  | 'delete'
  | 'print'
  | 'export'
  | 'logout'
  | 'refreshList'
  | 'expandAbbreviation'
  | 'convertAddress'
  | 'toggleLegacyMode'
  | 'showCheatSheet';

export type ShortcutScope = 'global' | 'form' | 'list' | 'modal' | 'input';

export interface ShortcutDef {
  action: ShortcutAction;
  label: string;
  description?: string;
  group: 'Toàn cục' | 'Trong form' | 'Trong danh sách' | 'Trong nhập liệu';
  defaultBinding: string;
  scope: ShortcutScope;
  /** True for shortcuts that act ON the focused input (F9 expand, F10 address). */
  fireInInputs?: boolean;
}

export const SHORTCUTS: Record<ShortcutAction, ShortcutDef> = {
  save: {
    action: 'save',
    label: 'Lưu',
    description: 'Lưu hồ sơ đang mở',
    group: 'Trong form',
    defaultBinding: 'Ctrl+Shift+S',
    scope: 'form',
  },
  saveDraft: {
    action: 'saveDraft',
    label: 'Lưu nháp',
    description: 'Lưu nháp hồ sơ vào trình duyệt',
    group: 'Trong form',
    defaultBinding: 'Ctrl+D',
    scope: 'form',
  },
  cancel: {
    action: 'cancel',
    label: 'Hủy / Quay lại',
    description: 'Hủy thao tác hoặc quay lại danh sách',
    group: 'Trong form',
    defaultBinding: 'Escape',
    scope: 'form',
  },
  toggleLegacyMode: {
    action: 'toggleLegacyMode',
    label: 'Bật/tắt chế độ Quận/Huyện cũ',
    description: 'Cho phép nhập địa chỉ theo cấu trúc hành chính cũ',
    group: 'Trong form',
    defaultBinding: 'Ctrl+Shift+L',
    scope: 'form',
  },
  newRecord: {
    action: 'newRecord',
    label: 'Thêm mới',
    description: 'Tạo bản ghi mới trên trang đang mở',
    group: 'Trong danh sách',
    defaultBinding: 'Alt+N',
    scope: 'list',
  },
  delete: {
    action: 'delete',
    label: 'Xóa (cần chọn dòng)',
    description: 'Xóa bản ghi đang xem',
    group: 'Trong danh sách',
    defaultBinding: 'Delete',
    scope: 'list',
  },
  export: {
    action: 'export',
    label: 'Xuất Excel',
    description: 'Xuất danh sách ra Excel',
    group: 'Trong danh sách',
    defaultBinding: 'Ctrl+E',
    scope: 'list',
  },
  refreshList: {
    action: 'refreshList',
    label: 'Làm mới danh sách',
    description: 'Tải lại dữ liệu danh sách',
    group: 'Trong danh sách',
    defaultBinding: 'Alt+R',
    scope: 'list',
  },
  expandAbbreviation: {
    action: 'expandAbbreviation',
    label: 'Mở rộng từ viết tắt',
    description: 'Tra cứu và thay thế từ viết tắt trong ô nhập liệu',
    group: 'Trong nhập liệu',
    defaultBinding: 'F9',
    scope: 'input',
    fireInInputs: true,
  },
  convertAddress: {
    action: 'convertAddress',
    label: 'Chuyển đổi địa chỉ',
    description: 'Chuyển địa chỉ Quận/Huyện cũ sang cấu trúc Phường/Xã mới',
    group: 'Trong nhập liệu',
    defaultBinding: 'F10',
    scope: 'input',
    fireInInputs: true,
  },
  search: {
    action: 'search',
    label: 'Tìm kiếm',
    description: 'Mở thanh tìm kiếm toàn cục',
    group: 'Toàn cục',
    defaultBinding: 'Ctrl+K',
    scope: 'global',
  },
  print: {
    action: 'print',
    label: 'In',
    description: 'In trang hiện tại',
    group: 'Toàn cục',
    defaultBinding: 'Ctrl+Alt+P',
    scope: 'global',
  },
  logout: {
    action: 'logout',
    label: 'Đăng xuất',
    description: 'Đăng xuất khỏi hệ thống',
    group: 'Toàn cục',
    defaultBinding: 'Ctrl+Shift+Q',
    scope: 'global',
  },
  showCheatSheet: {
    action: 'showCheatSheet',
    label: 'Mở bảng phím tắt',
    description: 'Hiển thị bảng tổng hợp phím tắt',
    group: 'Toàn cục',
    defaultBinding: 'Shift+Slash',
    scope: 'global',
  },
};

export const ALL_ACTIONS = Object.keys(SHORTCUTS) as ShortcutAction[];

/**
 * Browser-reserved key combinations. UI shows a warning if user tries to bind one
 * of these, but does not block — user can override with confirmation.
 */
export const BROWSER_RESERVED = new Set<string>([
  'Ctrl+W',
  'Ctrl+T',
  'Ctrl+R',
  'Ctrl+S',
  'Ctrl+P',
  'Ctrl+N',
  'F5',
  'F11',
  'F12',
  'Ctrl+Shift+I',
  'Ctrl+Shift+J',
  'Ctrl+Shift+T',
]);

/** Mirror of backend BINDING_REGEX. */
export const BINDING_REGEX =
  /^(Ctrl\+)?(Alt\+)?(Shift\+)?(Meta\+)?([A-Z]|[0-9]|F[1-9]|F1[0-2]|Escape|Delete|Enter|Tab|Backspace|Space|Slash|Comma|Period|Minus|Equal|Semicolon|Quote|Backquote|BracketLeft|BracketRight|Backslash|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown|Insert)$/;

const NAMED_KEYS = new Set([
  'Escape', 'Delete', 'Enter', 'Tab', 'Backspace', 'Space',
  'Slash', 'Comma', 'Period', 'Minus', 'Equal', 'Semicolon', 'Quote',
  'Backquote', 'BracketLeft', 'BracketRight', 'Backslash',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Home', 'End', 'PageUp', 'PageDown', 'Insert',
]);

/**
 * Map common typed aliases to canonical key tokens. Used by `normalizeBindingText`.
 */
const ALIAS_MAP: Record<string, string> = {
  esc: 'Escape',
  escape: 'Escape',
  del: 'Delete',
  delete: 'Delete',
  return: 'Enter',
  enter: 'Enter',
  tab: 'Tab',
  bs: 'Backspace',
  backspace: 'Backspace',
  space: 'Space',
  spacebar: 'Space',
  '?': 'Shift+Slash',
  '/': 'Slash',
  ',': 'Comma',
  '.': 'Period',
  '-': 'Minus',
  '=': 'Equal',
  ';': 'Semicolon',
  "'": 'Quote',
  '`': 'Backquote',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  pgup: 'PageUp',
  pageup: 'PageUp',
  pgdn: 'PageDown',
  pagedown: 'PageDown',
  ins: 'Insert',
  insert: 'Insert',
};

const MOD_ALIAS: Record<string, 'Ctrl' | 'Alt' | 'Shift' | 'Meta'> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  meta: 'Meta',
  cmd: 'Meta',
  command: 'Meta',
  win: 'Meta',
};

/**
 * Convert a KeyboardEvent into the canonical binding string.
 *
 * Use `e.code` for letter (KeyA-Z) and digit (Digit0-9) keys to be layout-safe;
 * use `e.key` for named keys (Escape, F-keys, arrows). This avoids Vietnamese
 * keyboard layout surprises where `Shift+8` produces `*` via `e.key` but stays
 * `Digit8` via `e.code`.
 */
export function serializeKey(e: KeyboardEvent): string | null {
  // Skip stand-alone modifier keypresses.
  if (e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta') {
    return null;
  }

  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');

  let key: string | null = null;

  // Layout-safe: use e.code for letters/digits.
  if (e.code) {
    if (/^Key[A-Z]$/.test(e.code)) {
      key = e.code.slice(3); // KeyA → A
    } else if (/^Digit[0-9]$/.test(e.code)) {
      key = e.code.slice(5); // Digit0 → 0
    } else if (/^F[1-9]$|^F1[0-2]$/.test(e.code)) {
      key = e.code; // F1..F12 already canonical
    } else if (NAMED_KEYS.has(e.code)) {
      key = e.code;
    } else if (e.code.startsWith('Numpad')) {
      // Numpad fallback to e.key for now (rare in shortcuts)
      key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    }
  }

  // Fallback: e.key for keys without a code mapping.
  if (key === null) {
    if (e.key.length === 1) {
      key = e.key.toUpperCase();
    } else if (NAMED_KEYS.has(e.key) || /^F[1-9]$|^F1[0-2]$/.test(e.key)) {
      key = e.key;
    } else {
      // Unrecognized key — bail.
      return null;
    }
  }

  parts.push(key);
  return parts.join('+');
}

export function parseKey(s: string): {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
} | null {
  const segments = s.split('+');
  if (segments.length === 0) return null;
  const result = { ctrl: false, alt: false, shift: false, meta: false, key: '' };
  const last = segments[segments.length - 1];
  const mods = segments.slice(0, -1);
  for (const m of mods) {
    if (m === 'Ctrl') result.ctrl = true;
    else if (m === 'Alt') result.alt = true;
    else if (m === 'Shift') result.shift = true;
    else if (m === 'Meta') result.meta = true;
    else return null;
  }
  result.key = last;
  return result;
}

/**
 * Check if a serialized binding matches a KeyboardEvent.
 */
export function bindingMatches(binding: string, e: KeyboardEvent): boolean {
  const got = serializeKey(e);
  return got === binding;
}

export function isBrowserReserved(binding: string): boolean {
  return BROWSER_RESERVED.has(binding);
}

/**
 * Normalize free-form text input (e.g. "ctrl+s", "Cmd+Shift+A", "?") into the
 * canonical binding form. Returns null if input cannot be parsed into a valid
 * binding.
 */
export function normalizeBindingText(input: string): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Single-token alias (e.g. "?" → "Shift+Slash")
  const aliasDirect = ALIAS_MAP[trimmed.toLowerCase()] ?? ALIAS_MAP[trimmed];
  if (aliasDirect) {
    return BINDING_REGEX.test(aliasDirect) ? aliasDirect : null;
  }

  const parts = trimmed.split('+').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const mods = { Ctrl: false, Alt: false, Shift: false, Meta: false };
  let keyToken: string | null = null;

  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i];
    const lower = raw.toLowerCase();
    if (i < parts.length - 1) {
      const canonical = MOD_ALIAS[lower];
      if (!canonical) return null;
      mods[canonical] = true;
    } else {
      // Last segment = key
      const aliased = ALIAS_MAP[lower] ?? ALIAS_MAP[raw];
      if (aliased) {
        // Alias may itself include a modifier (e.g. `?` → `Shift+Slash`)
        const sub = parseKey(aliased);
        if (!sub) return null;
        if (sub.ctrl) mods.Ctrl = true;
        if (sub.alt) mods.Alt = true;
        if (sub.shift) mods.Shift = true;
        if (sub.meta) mods.Meta = true;
        keyToken = sub.key;
      } else if (raw.length === 1) {
        // Single char letter or digit: uppercase A-Z, keep digits as-is
        const c = raw.toUpperCase();
        if (/^[A-Z]$/.test(c) || /^[0-9]$/.test(c)) {
          keyToken = c;
        } else {
          return null;
        }
      } else if (NAMED_KEYS.has(raw)) {
        keyToken = raw;
      } else if (/^F[1-9]$|^F1[0-2]$/i.test(raw)) {
        keyToken = raw.toUpperCase();
      } else {
        // Try title-cased named key (e.g. "escape" → "Escape")
        const titled = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
        if (NAMED_KEYS.has(titled)) {
          keyToken = titled;
        } else {
          return null;
        }
      }
    }
  }

  if (!keyToken) return null;

  const orderedMods: string[] = [];
  if (mods.Ctrl) orderedMods.push('Ctrl');
  if (mods.Alt) orderedMods.push('Alt');
  if (mods.Shift) orderedMods.push('Shift');
  if (mods.Meta) orderedMods.push('Meta');

  const result = [...orderedMods, keyToken].join('+');
  return BINDING_REGEX.test(result) ? result : null;
}
