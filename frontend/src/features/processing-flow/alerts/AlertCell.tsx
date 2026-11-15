import { processingFlow as L } from '@/locales/processingFlow.vi';
import { TONE_CLASS, alertBadge, type RecordAlertDto } from '../bandPresenter';

/**
 * The alert of one record on a list: a chip in the colour of the band with the days ("Đỏ · còn 1 ngày",
 * "Quá hạn 2 ngày"), then the step the colour comes from. A record with no alert (finished, suspended, no deadline) and
 * a record that has not reached any threshold yet show a dash, as the other columns do for "no value". The words and
 * the colour come from the one band presenter.
 */
export function AlertCell({ alert }: { alert: RecordAlertDto | null | undefined }) {
  const badge = alertBadge(alert);
  if (!alert || !badge) {
    return (
      <span data-testid="alert-cell" className="text-slate-400">
        {L.listAlert.none}
      </span>
    );
  }
  return (
    <span data-testid="alert-cell" data-band={alert.band} title={badge.sentence} className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
      <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[badge.tone]}`}>
        {badge.text}
      </span>
      {badge.step && <span className="text-xs text-slate-600">{` · ${badge.step}`}</span>}
    </span>
  );
}
