import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Keyboard, RotateCcw, X, Check, Loader2, Search } from 'lucide-react';
import {
  ALL_ACTIONS,
  BINDING_REGEX,
  BROWSER_RESERVED,
  SHORTCUTS,
  isBrowserReserved,
  normalizeBindingText,
  serializeKey,
  type ShortcutAction,
  type ShortcutDef,
} from '@/shortcuts/registry';
import {
  setCaptureModeActive,
  useDeleteUserShortcut,
  useResetUserShortcuts,
  useSwapUserShortcuts,
  useUpsertUserShortcut,
  useUserShortcutList,
  useUserShortcutMap,
} from '@/hooks/useUserShortcuts';

// Group ordering by frequency-of-use for case officer (per autoplan Design D9).
const GROUP_ORDER = ['Trong form', 'Trong danh sách', 'Trong nhập liệu', 'Toàn cục'] as const;

type Group = (typeof GROUP_ORDER)[number];

interface RowState {
  /** Pending binding entered via typing or capture, not yet committed. */
  pending: string;
  /** Whether the row is currently in capture mode (waiting for keypress). */
  capturing: boolean;
  /** Inline error / warning state. */
  warning: { kind: 'browser' | 'conflict' | 'invalid'; message: string; conflictAction?: ShortcutAction } | null;
  /** True after a successful commit; flashes the row green for 600ms. */
  flash: boolean;
}

const EMPTY_ROW: RowState = { pending: '', capturing: false, warning: null, flash: false };

export function ShortcutsModule() {
  const { isLoading, isError, refetch } = useUserShortcutList();
  const map = useUserShortcutMap();
  const upsert = useUpsertUserShortcut();
  const remove = useDeleteUserShortcut();
  const resetAll = useResetUserShortcuts();
  const swap = useSwapUserShortcuts();

  const [rowState, setRowState] = useState<Record<ShortcutAction, RowState>>(() =>
    Object.fromEntries(ALL_ACTIONS.map((a) => [a, { ...EMPTY_ROW }])) as Record<ShortcutAction, RowState>,
  );
  const [filter, setFilter] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const captureTimerRef = useRef<number | null>(null);

  // Counter: number of overrides
  const customizedCount = useMemo(() => {
    let count = 0;
    for (const action of ALL_ACTIONS) {
      const def = SHORTCUTS[action];
      const current = map.get(action) ?? def.defaultBinding;
      if (current !== def.defaultBinding) count++;
    }
    return count;
  }, [map]);

  // Filter actions
  const visibleByGroup = useMemo(() => {
    const lower = filter.trim().toLowerCase();
    const result: Record<Group, ShortcutDef[]> = {
      'Trong form': [],
      'Trong danh sách': [],
      'Trong nhập liệu': [],
      'Toàn cục': [],
    };
    for (const action of ALL_ACTIONS) {
      const def = SHORTCUTS[action];
      if (lower && !def.label.toLowerCase().includes(lower) && !action.toLowerCase().includes(lower)) {
        continue;
      }
      result[def.group].push(def);
    }
    return result;
  }, [filter]);

  // Cleanup capture timer + capture mode flag on unmount
  useEffect(() => {
    return () => {
      if (captureTimerRef.current) {
        window.clearTimeout(captureTimerRef.current);
      }
      setCaptureModeActive(false);
    };
  }, []);

  function startCapture(action: ShortcutAction) {
    setCaptureModeActive(true);
    setRowState((prev) => ({ ...prev, [action]: { ...prev[action], capturing: true, warning: null } }));
    if (captureTimerRef.current) window.clearTimeout(captureTimerRef.current);
    captureTimerRef.current = window.setTimeout(() => stopCapture(action), 10000);
  }

  function stopCapture(action: ShortcutAction) {
    setCaptureModeActive(false);
    setRowState((prev) => ({ ...prev, [action]: { ...prev[action], capturing: false } }));
    if (captureTimerRef.current) {
      window.clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;
    }
  }

  /** Capture-mode keydown handler attached to the row's <input>. */
  function handleCaptureKeyDown(action: ShortcutAction, e: React.KeyboardEvent<HTMLInputElement>) {
    e.preventDefault();
    e.stopPropagation();
    // Esc cancels capture (cannot bind Escape via capture mode — must use typing mode)
    if (e.key === 'Escape') {
      stopCapture(action);
      return;
    }
    const binding = serializeKey(e.nativeEvent);
    if (!binding) return;
    setRowState((prev) => ({ ...prev, [action]: { ...prev[action], pending: binding, capturing: false } }));
    setCaptureModeActive(false);
    if (captureTimerRef.current) window.clearTimeout(captureTimerRef.current);
    validatePending(action, binding);
  }

  function handleTextChange(action: ShortcutAction, value: string) {
    setRowState((prev) => ({ ...prev, [action]: { ...prev[action], pending: value, warning: null } }));
  }

  function handleTextBlur(action: ShortcutAction) {
    const state = rowState[action];
    if (!state.pending) return;
    const normalized = normalizeBindingText(state.pending);
    if (!normalized) {
      setRowState((prev) => ({
        ...prev,
        [action]: {
          ...prev[action],
          warning: { kind: 'invalid', message: 'Định dạng không hợp lệ. Ví dụ: Ctrl+Shift+S, Alt+8, F9' },
        },
      }));
      return;
    }
    setRowState((prev) => ({ ...prev, [action]: { ...prev[action], pending: normalized } }));
    validatePending(action, normalized);
  }

  function validatePending(action: ShortcutAction, binding: string) {
    if (!BINDING_REGEX.test(binding)) {
      setRowState((prev) => ({
        ...prev,
        [action]: {
          ...prev[action],
          warning: { kind: 'invalid', message: 'Định dạng không hợp lệ' },
        },
      }));
      return;
    }
    // Check action conflict (binding already used by another action)
    const conflict = ALL_ACTIONS.find((a) => a !== action && map.get(a) === binding);
    if (conflict) {
      setRowState((prev) => ({
        ...prev,
        [action]: {
          ...prev[action],
          warning: {
            kind: 'conflict',
            message: `Phím tắt "${binding}" đang dùng cho hành động "${SHORTCUTS[conflict].label}".`,
            conflictAction: conflict,
          },
        },
      }));
      return;
    }
    // Browser reserved → show warning but allow commit on confirm.
    if (isBrowserReserved(binding)) {
      setRowState((prev) => ({
        ...prev,
        [action]: {
          ...prev[action],
          warning: {
            kind: 'browser',
            message: `Phím "${binding}" có thể bị trình duyệt chặn. Bấm "Vẫn dùng" để xác nhận.`,
          },
        },
      }));
      return;
    }
    // No issues → commit immediately.
    commitBinding(action, binding);
  }

  function commitBinding(action: ShortcutAction, binding: string) {
    upsert.mutate(
      { action, binding },
      {
        onSuccess: () => {
          setRowState((prev) => ({
            ...prev,
            [action]: { ...EMPTY_ROW, flash: true },
          }));
          // Clear flash after 600ms
          window.setTimeout(() => {
            setRowState((prev) => ({ ...prev, [action]: { ...prev[action], flash: false } }));
          }, 600);
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? 'Không lưu được. Thử lại?';
          setRowState((prev) => ({
            ...prev,
            [action]: { ...prev[action], warning: { kind: 'invalid', message: msg } },
          }));
        },
      },
    );
  }

  function commitWithBrowserOverride(action: ShortcutAction) {
    const state = rowState[action];
    if (state.pending) commitBinding(action, state.pending);
  }

  function cancelPending(action: ShortcutAction) {
    setRowState((prev) => ({ ...prev, [action]: { ...EMPTY_ROW } }));
  }

  function handleSwap(action: ShortcutAction) {
    const state = rowState[action];
    if (state.warning?.kind !== 'conflict' || !state.warning.conflictAction) return;
    swap.mutate(
      { fromAction: action, toAction: state.warning.conflictAction },
      {
        onSuccess: () => {
          setRowState((prev) => ({ ...prev, [action]: { ...EMPTY_ROW, flash: true } }));
          window.setTimeout(() => {
            setRowState((prev) => ({ ...prev, [action]: { ...prev[action], flash: false } }));
          }, 600);
        },
      },
    );
  }

  function handleResetRow(action: ShortcutAction) {
    remove.mutate(action, {
      onSuccess: () => {
        setRowState((prev) => ({ ...prev, [action]: { ...EMPTY_ROW } }));
      },
      onError: (err: any) => {
        // 404 = already at default — quietly clear pending.
        if (err?.response?.status === 404) {
          setRowState((prev) => ({ ...prev, [action]: { ...EMPTY_ROW } }));
        }
      },
    });
  }

  function handleResetAll() {
    resetAll.mutate(undefined, {
      onSuccess: () => {
        setRowState(
          Object.fromEntries(ALL_ACTIONS.map((a) => [a, { ...EMPTY_ROW }])) as Record<ShortcutAction, RowState>,
        );
        setShowResetConfirm(false);
      },
    });
  }

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Phím tắt
            <span
              className="ml-2 inline-flex rounded-full bg-blue-50 text-[#003973] px-2.5 py-0.5 text-xs font-medium"
              data-testid="shortcuts-customized-count"
            >
              Đã tùy chỉnh: {customizedCount}/{ALL_ACTIONS.length}
            </span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Tùy chỉnh phím tắt để thao tác nhanh hơn. Thay đổi áp dụng ngay trên thiết bị này
            và đồng bộ sang các thiết bị khác.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          disabled={customizedCount === 0 || resetAll.isPending}
          className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-red-300 hover:text-red-700 px-4 py-2 rounded-md text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="shortcuts-reset-all"
        >
          <RotateCcw className="w-4 h-4" />
          Reset toàn bộ
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <input
          type="search"
          placeholder="Tìm hành động…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#003973] focus:border-[#003973] text-sm"
          data-testid="shortcuts-filter"
          aria-label="Tìm phím tắt"
        />
      </div>

      {isLoading && (
        <div className="space-y-2" data-testid="shortcuts-loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-100 animate-pulse rounded" />
          ))}
        </div>
      )}

      {isError && (
        <div role="alert" className="bg-red-50 border-l-4 border-red-400 text-red-900 p-3 rounded-md mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <div className="flex-1">
            <div>Không tải được phím tắt.</div>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-sm underline hover:no-underline mt-1"
            >
              Thử lại
            </button>
          </div>
        </div>
      )}

      {!isLoading &&
        GROUP_ORDER.map((group) => {
          const defs = visibleByGroup[group];
          if (defs.length === 0) return null;
          return (
            <div key={group} className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">{group}</h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                {defs.map((def, idx) => (
                  <ShortcutRow
                    key={def.action}
                    def={def}
                    state={rowState[def.action]}
                    currentBinding={map.get(def.action) ?? def.defaultBinding}
                    isLast={idx === defs.length - 1}
                    onStartCapture={() => startCapture(def.action)}
                    onStopCapture={() => stopCapture(def.action)}
                    onCaptureKeyDown={(e) => handleCaptureKeyDown(def.action, e)}
                    onTextChange={(v) => handleTextChange(def.action, v)}
                    onTextBlur={() => handleTextBlur(def.action)}
                    onTextEnter={() => handleTextBlur(def.action)}
                    onCommitOverride={() => commitWithBrowserOverride(def.action)}
                    onSwap={() => handleSwap(def.action)}
                    onCancel={() => cancelPending(def.action)}
                    onReset={() => handleResetRow(def.action)}
                    isPending={upsert.isPending || swap.isPending || remove.isPending}
                  />
                ))}
              </div>
            </div>
          );
        })}

      {showResetConfirm && (
        <ResetConfirmDialog
          count={customizedCount}
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={handleResetAll}
          isPending={resetAll.isPending}
        />
      )}
    </section>
  );
}

interface RowProps {
  def: ShortcutDef;
  state: RowState;
  currentBinding: string;
  isLast: boolean;
  onStartCapture: () => void;
  onStopCapture: () => void;
  onCaptureKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onTextChange: (value: string) => void;
  onTextBlur: () => void;
  onTextEnter: () => void;
  onCommitOverride: () => void;
  onSwap: () => void;
  onCancel: () => void;
  onReset: () => void;
  isPending: boolean;
}

function ShortcutRow({
  def,
  state,
  currentBinding,
  isLast,
  onStartCapture,
  onStopCapture,
  onCaptureKeyDown,
  onTextChange,
  onTextBlur,
  onTextEnter,
  onCommitOverride,
  onSwap,
  onCancel,
  onReset,
  isPending,
}: RowProps) {
  const isCustomized = currentBinding !== def.defaultBinding;
  const inputRef = useRef<HTMLInputElement>(null);

  // When entering capture mode, auto-focus the input so the keydown listener
  // captures the next keystroke from the right element.
  useEffect(() => {
    if (state.capturing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state.capturing]);

  return (
    <div
      className={`grid grid-cols-12 gap-3 py-3 px-4 items-center transition-colors duration-200 ${
        !isLast ? 'border-b border-slate-100' : ''
      } ${state.flash ? 'bg-emerald-50' : 'bg-white'}`}
      data-testid={`shortcut-row-${def.action}`}
    >
      <div className="col-span-3">
        <div className="text-sm font-medium text-slate-800">{def.label}</div>
        {def.description && <div className="text-xs text-slate-500 mt-0.5">{def.description}</div>}
      </div>
      <div className="col-span-2">
        <kbd className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-500">
          {def.defaultBinding}
        </kbd>
      </div>
      <div className="col-span-4">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={state.capturing ? '' : state.pending || currentBinding}
            placeholder={state.capturing ? 'Nhấn tổ hợp phím… (Esc để hủy)' : 'Ctrl+Shift+S'}
            onChange={(e) => !state.capturing && onTextChange(e.target.value)}
            onBlur={() => !state.capturing && onTextBlur()}
            onKeyDown={(e) => {
              if (state.capturing) {
                onCaptureKeyDown(e);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                onTextEnter();
              }
            }}
            readOnly={state.capturing}
            className={`flex-1 px-2 py-1.5 border rounded-md text-sm font-mono ${
              state.warning?.kind === 'invalid' || state.warning?.kind === 'conflict'
                ? 'border-red-300 bg-red-50'
                : state.warning?.kind === 'browser'
                ? 'border-amber-300 bg-amber-50'
                : state.capturing
                ? 'border-[#003973] ring-2 ring-[#003973] ring-offset-1 bg-blue-50'
                : 'border-slate-300'
            }`}
            aria-label={`Phím tắt cho ${def.label}`}
            aria-describedby={state.warning ? `warning-${def.action}` : undefined}
            data-testid={`shortcut-input-${def.action}`}
          />
          {state.capturing ? (
            <button
              type="button"
              onClick={onStopCapture}
              className="px-2 py-1 border border-slate-300 rounded-md text-xs hover:bg-slate-50 flex items-center gap-1"
              aria-label="Hủy bắt phím"
              data-testid={`shortcut-stop-capture-${def.action}`}
            >
              <X className="w-3.5 h-3.5" />
              Hủy
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartCapture}
              className="px-2 py-1 border border-slate-300 rounded-md text-xs hover:bg-slate-50 flex items-center gap-1"
              aria-label={`Bắt phím cho ${def.label}`}
              data-testid={`shortcut-capture-${def.action}`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              Bắt phím
            </button>
          )}
        </div>
        {/* Capture-mode live region for screen readers */}
        {state.capturing && (
          <div aria-live="polite" className="sr-only">
            Đang bắt phím cho hành động {def.label}. Nhấn tổ hợp phím để gán. Nhấn Escape để hủy.
          </div>
        )}
        {state.warning && (
          <div
            id={`warning-${def.action}`}
            role="alert"
            className={`mt-2 p-2 rounded-md flex items-start gap-2 text-xs ${
              state.warning.kind === 'browser'
                ? 'bg-amber-50 border border-amber-200 text-amber-900'
                : 'bg-red-50 border border-red-200 text-red-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div>{state.warning.message}</div>
              <div className="flex gap-2 mt-1.5">
                {state.warning.kind === 'browser' && (
                  <button
                    type="button"
                    onClick={onCommitOverride}
                    disabled={isPending}
                    className="bg-amber-600 text-white px-2 py-0.5 rounded text-xs hover:bg-amber-700 disabled:opacity-50"
                    data-testid={`shortcut-confirm-browser-${def.action}`}
                  >
                    Vẫn dùng
                  </button>
                )}
                {state.warning.kind === 'conflict' && state.warning.conflictAction && (
                  <button
                    type="button"
                    onClick={onSwap}
                    disabled={isPending}
                    className="bg-[#003973] text-white px-2 py-0.5 rounded text-xs hover:bg-[#002255] disabled:opacity-50"
                    data-testid={`shortcut-swap-${def.action}`}
                  >
                    Hoán đổi 2 phím
                  </button>
                )}
                <button
                  type="button"
                  onClick={onCancel}
                  className="bg-white border border-slate-300 text-slate-700 px-2 py-0.5 rounded text-xs hover:bg-slate-50"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="col-span-2 text-xs">
        {isPending ? (
          <span className="inline-flex items-center gap-1 text-slate-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            Đang lưu…
          </span>
        ) : isCustomized ? (
          <span className="font-medium text-[#003973]">Đã tùy chỉnh</span>
        ) : (
          <span className="text-slate-500">Mặc định</span>
        )}
      </div>
      <div className="col-span-1 text-right">
        {isCustomized && !state.capturing && (
          <button
            type="button"
            onClick={onReset}
            disabled={isPending}
            className="text-slate-400 hover:text-slate-700 disabled:opacity-50"
            aria-label={`Khôi phục mặc định cho ${def.label}`}
            data-testid={`shortcut-reset-${def.action}`}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        {state.flash && (
          <span className="text-emerald-600">
            <Check className="w-4 h-4" />
          </span>
        )}
      </div>
    </div>
  );
}

interface ResetDialogProps {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

function ResetConfirmDialog({ count, onCancel, onConfirm, isPending }: ResetDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-dialog-title"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 id="reset-dialog-title" className="text-lg font-semibold text-slate-800 mb-2">
          Khôi phục toàn bộ phím tắt?
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Sẽ xóa {count} tùy chỉnh và đưa toàn bộ về mặc định. Thao tác không hoàn tác được.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 border border-slate-300 rounded-md text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            data-testid="shortcuts-reset-confirm"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Reset toàn bộ
          </button>
        </div>
      </div>
    </div>
  );
}
