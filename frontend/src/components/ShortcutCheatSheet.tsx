import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Keyboard, X, Settings } from 'lucide-react';
import {
  ALL_ACTIONS,
  SHORTCUTS,
  type ShortcutAction,
  type ShortcutDef,
} from '@/shortcuts/registry';
import { useUserShortcutMap } from '@/hooks/useUserShortcuts';
import { useShortcut } from '@/hooks/useShortcut';

const GROUP_ORDER = ['Trong form', 'Trong danh sách', 'Trong nhập liệu', 'Toàn cục'] as const;

/**
 * Global keyboard cheat sheet — opens with the `showCheatSheet` shortcut
 * (default `Shift+Slash` aka `?`). Modal lists all bindings grouped by scope
 * with link to Settings for customization.
 *
 * Mounted once at the app root (App.tsx).
 */
export function ShortcutCheatSheet() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const map = useUserShortcutMap();

  useShortcut('showCheatSheet', () => setOpen((v) => !v));

  // Esc-to-close handled here so we do NOT subscribe to the `cancel` shortcut
  // (which would conflict with form-scope handlers).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [open]);

  const grouped = useMemo(() => {
    const result: Record<string, ShortcutDef[]> = {};
    for (const group of GROUP_ORDER) result[group] = [];
    for (const action of ALL_ACTIONS) {
      const def = SHORTCUTS[action];
      result[def.group].push(def);
    }
    return result;
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cheatsheet-title"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 id="cheatsheet-title" className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Phím tắt
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Đóng"
            data-testid="cheatsheet-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          {GROUP_ORDER.map((group) => (
            <div key={group}>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">{group}</h3>
              <div className="space-y-1.5">
                {grouped[group].map((def) => {
                  const binding = map.get(def.action) ?? def.defaultBinding;
                  return (
                    <div key={def.action} className="flex items-center justify-between py-1">
                      <div className="text-sm text-slate-700">{def.label}</div>
                      <kbd className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-700">
                        {binding}
                      </kbd>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center rounded-b-lg">
          <span className="text-xs text-slate-500">
            Nhấn <kbd className="px-1 py-0.5 border border-slate-300 rounded text-xs font-mono">?</kbd> hoặc{' '}
            <kbd className="px-1 py-0.5 border border-slate-300 rounded text-xs font-mono">Esc</kbd> để đóng
          </span>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/cai-dat?module=shortcuts');
            }}
            className="text-sm text-[#003973] hover:underline flex items-center gap-1"
          >
            <Settings className="w-4 h-4" />
            Tùy chỉnh phím tắt
          </button>
        </div>
      </div>
    </div>
  );
}

interface ShortcutHintProps {
  action: ShortcutAction;
  className?: string;
}

/**
 * Inline `<kbd>` element showing the current binding for an action. Use beside
 * action buttons (e.g. Save, New) to expose the shortcut.
 */
export function ShortcutHint({ action, className }: ShortcutHintProps) {
  const map = useUserShortcutMap();
  const binding = map.get(action) ?? SHORTCUTS[action].defaultBinding;
  return (
    <kbd
      className={`inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 ${
        className ?? ''
      }`}
      aria-hidden="true"
    >
      {binding}
    </kbd>
  );
}
