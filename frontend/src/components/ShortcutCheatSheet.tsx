import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { Keyboard, X, Settings } from 'lucide-react';
import {
  ALL_ACTIONS,
  SHORTCUTS,
  formatBinding,
  serializeKey,
  type ShortcutAction,
  type ShortcutDef,
} from '@/shortcuts/registry';
import { useUserShortcutMap } from '@/hooks/useUserShortcuts';
import { useShortcut } from '@/hooks/useShortcut';
import { useShortcutHintsEnabled } from '@/hooks/useShortcutHints';

const GROUP_ORDER = ['Trong form', 'Trong danh sách', 'Trong nhập liệu', 'Toàn cục'] as const;

/**
 * Store mở/đóng cheat-sheet ở cấp module (singleton — cheat-sheet mount 1 lần).
 * Cho phép mở từ nhiều nơi (phím `?`, chip header) mà không cần Context Provider.
 */
let cheatSheetOpen = false;
const listeners = new Set<() => void>();
function emitCheatSheet() {
  for (const l of listeners) l();
}
export function setCheatSheetOpen(value: boolean): void {
  if (cheatSheetOpen === value) return;
  cheatSheetOpen = value;
  emitCheatSheet();
}
export function toggleCheatSheet(): void {
  cheatSheetOpen = !cheatSheetOpen;
  emitCheatSheet();
}
function subscribeCheatSheet(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getCheatSheetSnapshot(): boolean {
  return cheatSheetOpen;
}
export function useCheatSheetOpen(): boolean {
  return useSyncExternalStore(subscribeCheatSheet, getCheatSheetSnapshot, getCheatSheetSnapshot);
}

/**
 * Global keyboard cheat sheet — opens with the `showCheatSheet` shortcut
 * (default `Shift+Slash` aka `?`) hoặc chip "Phím tắt" ở header. Modal liệt kê
 * mọi binding theo nhóm + link tới Settings.
 *
 * Mounted once tại MainLayout.
 */
export function ShortcutCheatSheet() {
  const open = useCheatSheetOpen();
  const navigate = useNavigate();
  const map = useUserShortcutMap();

  useShortcut('showCheatSheet', () => toggleCheatSheet());

  const cheatBinding = map.get('showCheatSheet') ?? SHORTCUTS.showCheatSheet.defaultBinding;

  // Đóng bằng Esc HOẶC bằng chính phím mở cheat-sheet (mặc định `?`). Xử lý ở
  // capture-phase riêng vì `useShortcut('showCheatSheet')` scope global bị guard
  // "modal đang mở" của useShortcut nuốt khi dialog hiển thị. Không subscribe
  // `cancel` để tránh xung đột form-scope. Tôn trọng user rebind qua serializeKey.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || serializeKey(e) === cheatBinding) {
        e.preventDefault();
        e.stopPropagation();
        setCheatSheetOpen(false);
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [open, cheatBinding]);

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
      onClick={() => setCheatSheetOpen(false)}
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
            onClick={() => setCheatSheetOpen(false)}
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
                        {formatBinding(binding)}
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
              setCheatSheetOpen(false);
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

/**
 * Chip "Phím tắt" luôn hiển thị ở header (chỉ desktop). Bấm mở cheat-sheet.
 * Điểm vào giúp EU biết hệ thống có phím tắt + xem toàn bộ.
 */
export function CheatSheetButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => toggleCheatSheet()}
      title="Xem phím tắt (?)"
      aria-label="Xem phím tắt"
      data-testid="cheatsheet-open-btn"
      className={`hidden lg:inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-800 ${
        className ?? ''
      }`}
    >
      <Keyboard className="w-4 h-4" />
      <span className="hidden xl:inline">Phím tắt</span>
      <kbd className="rounded border border-slate-300 bg-slate-50 px-1 font-mono text-[10px] leading-4">?</kbd>
    </button>
  );
}

interface ShortcutHintProps {
  action: ShortcutAction;
  className?: string;
}

/**
 * Inline `<kbd>` hiển thị binding hiện tại của một action. Đặt cạnh nút hành
 * động (Lưu, Tạo mới, Xuất...) để lộ phím tắt. Chỉ hiện trên desktop và khi
 * user chưa tắt gợi ý (Settings → Phím tắt).
 */
export function ShortcutHint({ action, className }: ShortcutHintProps) {
  const map = useUserShortcutMap();
  const enabled = useShortcutHintsEnabled();
  if (!enabled) return null;
  const binding = map.get(action) ?? SHORTCUTS[action].defaultBinding;
  return (
    <kbd
      className={`hidden lg:inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 ${
        className ?? ''
      }`}
      aria-hidden="true"
    >
      {formatBinding(binding)}
    </kbd>
  );
}
