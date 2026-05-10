/**
 * Canonical binding format for keyboard shortcuts.
 *
 * Examples:
 *   'F9', 'Escape', 'Delete', 'Enter', 'Tab', 'Backspace', 'Space'
 *   'Slash', 'Comma', 'Period', 'Minus', 'Equal'  (preferred over `?`, `,`, `.`, `-`, `=`)
 *   'A', 'Z', '0', '9'  (uppercase letter or digit)
 *   'Ctrl+S', 'Shift+Slash', 'Alt+N', 'Ctrl+Shift+S', 'Ctrl+Alt+P'
 *
 * Modifier order: Ctrl+ Alt+ Shift+ Meta+ (canonical, alphabetic).
 *
 * Regex MUST mirror frontend/src/shortcuts/registry.ts BINDING_REGEX. Single source
 * of truth lives there; this constant copies it for backend validation. Update both.
 */
export const BINDING_REGEX =
  /^(Ctrl\+)?(Alt\+)?(Shift\+)?(Meta\+)?([A-Z]|[0-9]|F[1-9]|F1[0-2]|Escape|Delete|Enter|Tab|Backspace|Space|Slash|Comma|Period|Minus|Equal|Semicolon|Quote|Backquote|BracketLeft|BracketRight|Backslash|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown|Insert)$/;

/**
 * Action name format: starts with letter, max 33 chars total. No path traversal,
 * no whitelist (FE registry is source of truth).
 */
export const ACTION_REGEX = /^[a-zA-Z][a-zA-Z0-9]{0,32}$/;
