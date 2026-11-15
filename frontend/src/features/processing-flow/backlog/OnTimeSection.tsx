/**
 * "Tỷ lệ đúng hạn theo kỳ": per unit, the work done on time and late in a period, the work still open, the rate and
 * the mean days. The period defaults to the current month in Vietnam; the kind and the role are those of the table above.
 */
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { A11Y_FOCUS_RING, BTN_SECONDARY } from '@/constants/styles';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { explainError } from '../errors';
import type { RecordKind } from '../types';
import { backlogApi } from './api';
import { BACKLOG_QUERY_KEYS } from './backlogKeys';
import { treeOrder } from './tree';
import type { OnTimeFigures, OnTimeQuery, WorkRole } from './types';

const T = L.backlog.onTime;

const INPUT = 'rounded border border-slate-300 bg-white px-3 py-2 text-sm';
const TH = 'px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600';
const TD = 'px-3 py-2 text-sm tabular-nums text-slate-800';

const count = (value: number) => value.toLocaleString('vi-VN');

/** The six figures of a row, as cells. A rate that does not exist (nothing done, nothing overdue) is a dash, not 0%. */
function Figures({ figures, testId }: { figures: OnTimeFigures; testId: string }) {
  return (
    <>
      <td className={`${TD} text-right`}>{count(figures.doneOnTime)}</td>
      <td className={`${TD} text-right`}>{count(figures.doneLate)}</td>
      <td className={`${TD} text-right`}>{count(figures.openInTime)}</td>
      <td className={`${TD} text-right`}>{count(figures.openOverdue)}</td>
      <td className={`${TD} text-right font-semibold`} data-testid={`${testId}-rate`}>
        {figures.onTimeRate === null ? L.backlog.none : T.rate(figures.onTimeRate * 100)}
      </td>
      <td className={`${TD} text-right`} data-testid={`${testId}-days`}>
        {figures.averageDays === null ? L.backlog.none : T.days(figures.averageDays)}
      </td>
    </>
  );
}

interface OnTimeSectionProps {
  kind: RecordKind | null;
  role: WorkRole;
  from: string;
  to: string;
  /** The unit filter of the table above (and whether it reaches the units under it). */
  unitId: string | null;
  rolledUp: boolean;
  /** The period is not the default one: offer the way back to it. */
  customPeriod: boolean;
  onPeriodChange: (updates: { from?: string | null; to?: string | null }) => void;
}

export function OnTimeSection({ kind, role, from, to, unitId, rolledUp, customPeriod, onPeriodChange }: OnTimeSectionProps) {
  const query: OnTimeQuery = { kind, role, from, to, unitId, rolledUp: unitId !== null && rolledUp };
  const reportQ = useQuery({
    queryKey: BACKLOG_QUERY_KEYS.onTime(query),
    queryFn: () => backlogApi.onTime(query),
    staleTime: 30_000,
    retry: false,
  });
  const error = reportQ.isError ? explainError(reportQ.error) : null;
  const report = reportQ.data ?? null;

  return (
    <section data-testid="backlog-on-time" aria-labelledby="backlog-on-time-title" className="m-4 rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h2 id="backlog-on-time-title" className="text-base font-semibold text-slate-800">
            {T.title}
          </h2>
          <p className="text-xs text-slate-500">{T.hint}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600">
            {T.from}
            <input
              type="date"
              data-testid="backlog-period-from"
              className={INPUT}
              value={from}
              max={to}
              onChange={(e) => onPeriodChange({ from: e.target.value || null })}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600">
            {T.to}
            <input
              type="date"
              data-testid="backlog-period-to"
              className={INPUT}
              value={to}
              min={from}
              onChange={(e) => onPeriodChange({ to: e.target.value || null })}
            />
          </label>
          {customPeriod && (
            <button
              type="button"
              data-testid="backlog-period-reset"
              className={`py-2 text-sm text-blue-700 hover:underline ${A11Y_FOCUS_RING}`}
              onClick={() => onPeriodChange({ from: null, to: null })}
            >
              {T.thisMonth}
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div data-testid="backlog-on-time-error" role="alert" className="m-4 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-red-700">{error.message || L.common.loadFailed}</p>
          <button type="button" data-testid="backlog-on-time-retry" className={BTN_SECONDARY} onClick={() => void reportQ.refetch()}>
            {L.common.retry}
          </button>
        </div>
      ) : report === null ? (
        <p data-testid="backlog-on-time-loading" role="status" className="px-4 py-6 text-sm text-slate-500">
          {L.common.loading}
        </p>
      ) : report.rows.length === 0 ? (
        <p data-testid="backlog-on-time-empty" className="px-4 py-6 text-sm text-slate-600">
          {T.empty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table aria-label={T.tableTitle} className="w-full min-w-[720px] border-collapse">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className={`${TH} text-left`}>
                  {T.columns.unit}
                </th>
                {([T.columns.doneOnTime, T.columns.doneLate, T.columns.openInTime, T.columns.openOverdue, T.columns.rate, T.columns.averageDays] as const).map(
                  (header) => (
                    <th key={header} scope="col" className={`${TH} text-right`}>
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {treeOrder(report.rows).map(({ row, depth }) => (
                <tr key={row.teamId} data-testid={`backlog-on-time-row-${row.teamId}`} className="border-t border-slate-200">
                  <th scope="row" className={`${TD} text-left font-medium`} style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}>
                    {row.teamName}
                  </th>
                  <Figures figures={row} testId={`backlog-on-time-${row.teamId}`} />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr data-testid="backlog-on-time-totals" className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <th scope="row" className={`${TD} text-left`}>
                  {L.backlog.totals}
                </th>
                <Figures figures={report.totals} testId="backlog-on-time-totals" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
