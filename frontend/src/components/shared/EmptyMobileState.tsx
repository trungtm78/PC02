import type { ReactNode } from 'react';
import { InboxIcon, AlertCircle, RefreshCw } from 'lucide-react';

interface EmptyMobileStateProps {
  /** Icon to display. Defaults to an inbox icon. */
  icon?: ReactNode;
  /** Vietnamese title (e.g., "Không có vụ án nào") */
  title: string;
  /** Optional description below the title */
  description?: string;
  /** Callback for the retry / primary action button */
  onRetry?: () => void;
  /** Label for the retry button. Defaults to "Tải lại". */
  retryLabel?: string;
  /** Variant — "empty" for no-results, "error" for error states */
  variant?: 'empty' | 'error';
}

/**
 * Empty/error state component optimized for mobile list views.
 * Centers icon + Vietnamese message + retry CTA. Touch-friendly button.
 *
 * Per autoplan auto-decision #9 (Design Review): list pages on mobile need
 * explicit empty/error states for field use (low connectivity, no data scenarios).
 */
export function EmptyMobileState({
  icon,
  title,
  description,
  onRetry,
  retryLabel = 'Tải lại',
  variant = 'empty',
}: EmptyMobileStateProps) {
  const defaultIcon =
    variant === 'error' ? (
      <AlertCircle className="w-12 h-12 text-red-400" />
    ) : (
      <InboxIcon className="w-12 h-12 text-slate-300" />
    );

  return (
    <div
      data-testid={`empty-mobile-${variant}`}
      className="flex flex-col items-center justify-center px-6 py-12 text-center"
    >
      <div className="mb-3">{icon ?? defaultIcon}</div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 mb-4 max-w-xs">{description}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm font-medium text-white bg-primary hover:bg-primary-light rounded-md transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
