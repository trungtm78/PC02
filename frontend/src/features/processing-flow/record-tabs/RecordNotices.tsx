/** The notices the two tabs share: a refused write, a done write, and the locked screen after a revision conflict. */
import { BTN_SECONDARY } from '@/constants/styles';
import { processingFlow as L } from '@/locales/processingFlow.vi';

interface Props {
  testPrefix: string;
  message: string | null;
  error: string | null;
  conflict: boolean;
  refreshing: boolean;
  refreshFailed: boolean;
  onTakeNewer: () => void;
}

export function RecordNotices({ testPrefix, message, error, conflict, refreshing, refreshFailed, onTakeNewer }: Props) {
  return (
    <>
      {message && (
        <p data-testid={`${testPrefix}-message`} role="status" className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </p>
      )}
      {error && (
        <p data-testid={`${testPrefix}-error`} role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {conflict && (
        <div
          data-testid={`${testPrefix}-conflict`}
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <div className="min-w-0 flex-1">
            <b>{L.conflict.title}</b> {L.conflict.body}
          </div>
          <button type="button" data-testid={`${testPrefix}-conflict-reload`} className={BTN_SECONDARY} disabled={refreshing} onClick={onTakeNewer}>
            {refreshing ? L.conflict.reloading : refreshFailed ? L.common.retry : L.conflict.reload}
          </button>
          {refreshFailed && !refreshing && (
            <span data-testid={`${testPrefix}-refresh-failed`} className="basis-full text-red-700">
              {L.conflict.refreshFailed}
            </span>
          )}
        </div>
      )}
    </>
  );
}
