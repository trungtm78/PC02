import { useEffect, useRef, useState } from 'react';
import { Copy, KeyRound, AlertTriangle } from 'lucide-react';
import { tempPasswordHandover as t } from '@/locales/vi';

interface Props {
  /** The plaintext temp password to display ONCE. Must never be persisted. */
  tempPassword: string;
  /** Cán bộ display name (e.g. "Nguyễn Văn A") shown for confirmation. */
  userDisplayName: string;
  /** Cán bộ email or username for context. */
  userEmail: string;
  /**
   * Called only after the admin acknowledges (copy succeeded OR explicit
   * checkbox). Backdrop click and Esc are intentionally suppressed —
   * non-dismissible by design (Design review F1).
   */
  onAcknowledged: () => void;
}

/**
 * F1: shows the system-generated temp password to admin EXACTLY ONCE.
 *
 * Non-dismissible:
 *   - no backdrop close
 *   - Esc key blocked
 *   - close button enabled only when admin either copied successfully OR
 *     ticked the explicit acknowledgment checkbox
 *
 * If admin closes the browser tab without copying, the temp password is
 * lost — they must call admin reset again. This is acceptable (rare) and
 * better than leaving the password retrievable.
 */
export function TempPasswordHandoverModal({
  tempPassword,
  userDisplayName,
  userEmail,
  onAcknowledged,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const passwordRef = useRef<HTMLDivElement>(null);

  // Block Esc to close — admin must explicitly acknowledge.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  const canClose = copied || acknowledged;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(tempPassword);
        setCopied(true);
        setCopyFailed(false);
      } else {
        // Older browsers / non-https — fall back to manual selection.
        setCopyFailed(true);
        const range = document.createRange();
        if (passwordRef.current) {
          range.selectNodeContents(passwordRef.current);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
    } catch {
      setCopyFailed(true);
    }
  };

  const handleClose = () => {
    if (canClose) onAcknowledged();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="temp-pw-title"
      // No onClick — backdrop click does NOT close.
    >
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md sm:max-w-lg overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <KeyRound className="w-5 h-5 text-slate-700" aria-hidden="true" />
          <h2 id="temp-pw-title" className="text-base font-bold text-slate-800">
            {t.title}
          </h2>
        </div>

        <div className="p-5 space-y-4">
          {/* Warning banner */}
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-300 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-red-800 leading-snug">{t.warning}</p>
          </div>

          {/* User context */}
          <div className="text-sm text-slate-700">
            <span className="font-medium">{t.userLabel}:</span>{' '}
            <span>{userDisplayName}</span>{' '}
            <span className="text-slate-500">({userEmail})</span>
          </div>

          {/* Password display — large monospace, selectable */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">{t.passwordLabel}</label>
            <div
              ref={passwordRef}
              className="font-mono text-xl sm:text-2xl tracking-wider px-4 py-3 bg-slate-100 border-2 border-slate-300 rounded-lg select-all break-all"
              data-testid="temp-pw-display"
            >
              {tempPassword}
            </div>
          </div>

          {/* Copy state announcement */}
          <div role="status" aria-live="polite" className="min-h-[1.25rem]">
            {copied && (
              <p className="text-sm text-green-700 font-medium">{t.copySuccess}</p>
            )}
            {copyFailed && !copied && (
              <p className="text-sm text-amber-700">{t.copyFallback}</p>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
            >
              <Copy className="w-4 h-4" aria-hidden="true" />
              {t.copyButton}
            </button>

            {/* Explicit acknowledgment as alternative path to close */}
            <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300"
              />
              <span className="leading-snug">{t.acknowledgeCheckbox}</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={!canClose}
            className="px-5 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t.closeButton}
          </button>
        </div>
      </div>
    </div>
  );
}
