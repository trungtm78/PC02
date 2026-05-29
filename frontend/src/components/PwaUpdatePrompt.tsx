import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

/**
 * PWA Update Prompt — non-blocking bottom banner that appears when a new
 * service worker version is available.
 *
 * Design decisions (autoplan auto-decisions #8, #12):
 * - registerType='prompt' (configured in vite.config.ts): no silent autoUpdate
 *   so user's in-progress form work is never wiped by SW replacement
 * - Bottom banner (not blocking modal): user can keep working
 * - z-30: visible above main content but below modal overlay (z-40)
 *   so if a modal is open, the prompt waits behind it
 * - Vietnamese messaging matches PC02 localization
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      // Periodic check (every 60 minutes) for new SW.
      // Avoids stale clients but doesn't hammer the network.
      if (registration) {
        setInterval(
          () => {
            registration.update().catch(() => {
              // Network error — silently ignore, next attempt will retry
            });
          },
          60 * 60 * 1000,
        );
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      data-testid="pwa-update-prompt"
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-30 bg-primary text-white rounded-lg shadow-xl p-4 flex items-start gap-3"
    >
      <RefreshCw className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold mb-1">Có bản cập nhật mới</p>
        <p className="text-xs text-white/80 mb-3">
          Cập nhật để có tính năng và bản vá mới nhất.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => updateServiceWorker(true)}
            className="px-3 py-1.5 text-sm font-medium bg-white text-primary rounded hover:bg-white/90 transition-colors min-h-[36px]"
          >
            Cập nhật ngay
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="px-3 py-1.5 text-sm font-medium text-white/90 hover:text-white transition-colors min-h-[36px]"
          >
            Để sau
          </button>
        </div>
      </div>
      <button
        onClick={() => setNeedRefresh(false)}
        className="p-1 -mt-1 -mr-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
        aria-label="Đóng thông báo cập nhật"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
