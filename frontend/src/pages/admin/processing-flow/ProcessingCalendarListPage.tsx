/**
 * /admin/lich-lam-viec — the years of the working calendar deadlines are counted on: status (draft / confirmed) and
 * how many days off and compensatory working days each holds. A year with no row yet behaves as "weekends off" and
 * its deadlines are provisional; "Thêm năm" opens it to be filled in.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarDays } from 'lucide-react';
import { ListPageShell, ColumnPicker, useBoCucCot, type ColumnDef } from '@/components/shared/ListPageShell';
import { A11Y_FOCUS_RING, BTN_PRIMARY, BTN_SECONDARY } from '@/constants/styles';
import { formatVNDate } from '@/lib/dates';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { processingCalendarApi } from '@/features/processing-flow/api';
import { FeatureOffState } from '@/features/processing-flow/components/FeatureOffState';
import { explainError, isFeatureOff } from '@/features/processing-flow/errors';
import { CALENDAR_PATH } from '@/features/processing-flow/menu';
import { PROCESSING_QUERY_KEYS } from '@/features/processing-flow/queryKeys';
import type { CalendarYearSummaryDto } from '@/features/processing-flow/types';
import { useProcessingPermissions } from '@/features/processing-flow/usePermissions';

const C = L.calendar;

export default function ProcessingCalendarListPage() {
  const navigate = useNavigate();
  const perms = useProcessingPermissions();
  const [newYear, setNewYear] = useState('');

  const listQ = useQuery({
    queryKey: PROCESSING_QUERY_KEYS.calendarYears,
    queryFn: () => processingCalendarApi.list(),
    staleTime: 15_000,
    retry: false,
  });
  const rows = useMemo(() => listQ.data ?? [], [listQ.data]);

  const columns: ColumnDef<CalendarYearSummaryDto>[] = [
    {
      key: 'year',
      header: C.columns.year,
      width: '8rem',
      cellClassName: 'px-3 py-3 font-medium text-slate-800',
      render: (y) => <span data-testid={`calendar-year-${y.year}`}>{y.year}</span>,
    },
    {
      key: 'status',
      header: C.columns.status,
      width: '10rem',
      optional: 'show',
      cellClassName: 'px-3 py-3',
      render: (y) => (
        <span
          data-testid={`calendar-status-${y.year}`}
          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
            y.status === 'CONFIRMED' ? 'border-green-200 bg-green-50 text-green-800' : 'border-slate-300 bg-slate-100 text-slate-700'
          }`}
        >
          {C.status[y.status]}
        </span>
      ),
    },
    {
      key: 'off',
      header: C.columns.off,
      width: '8rem',
      optional: 'show',
      headerClassName: 'px-3 py-3 text-right text-xs font-semibold tracking-wide text-slate-600',
      cellClassName: 'px-3 py-3 text-right tabular-nums text-slate-700',
      render: (y) => <span data-testid={`calendar-off-${y.year}`}>{y.daysOff}</span>,
    },
    {
      key: 'working',
      header: C.columns.working,
      width: '8rem',
      optional: 'show',
      headerClassName: 'px-3 py-3 text-right text-xs font-semibold tracking-wide text-slate-600',
      cellClassName: 'px-3 py-3 text-right tabular-nums text-slate-700',
      render: (y) => <span data-testid={`calendar-working-${y.year}`}>{y.workingDays}</span>,
    },
    {
      key: 'updated',
      header: C.columns.updated,
      width: '10rem',
      optional: 'show',
      cellClassName: 'px-3 py-3 text-slate-600',
      render: (y) => formatVNDate(y.updatedAt),
    },
    {
      key: 'actions',
      header: C.columns.actions,
      width: '8rem',
      khongDoiBeRong: true,
      cellClassName: 'px-3 py-3',
      render: (y) => (
        <button
          type="button"
          data-testid={`calendar-open-${y.year}`}
          className={`text-xs text-blue-700 hover:underline ${A11Y_FOCUS_RING}`}
          onClick={() => navigate(`${CALENDAR_PATH}/${y.year}`)}
        >
          {C.open}
        </button>
      ),
    },
  ];

  const { coGhiDeBeRong, visibleColumns, toggleableColumns, isVisible, batTat, datBeRong, xoaBeRong, doiCho, datLai } = useBoCucCot('processing-calendar-years', columns);

  if (listQ.isError && isFeatureOff(listQ.error)) return <FeatureOffState />;
  const loadError = listQ.isError ? explainError(listQ.error).message : null;
  const yearOk = /^\d{4}$/.test(newYear);

  return (
    <div data-testid="processing-calendar-list-page">
      <ListPageShell>
        <ListPageShell.Header
          icon={CalendarDays}
          title={C.title}
          subtitle={C.subtitle}
          actions={<ColumnPicker columns={toggleableColumns} isVisible={isVisible} onToggle={batTat} onReset={datLai} onDoiCho={doiCho} />}
        />

        {perms.canEditCalendar && (
          <form
            className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-white px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (yearOk) navigate(`${CALENDAR_PATH}/${newYear}`);
            }}
          >
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              {C.yearLabel}
              <input
                data-testid="calendar-new-year"
                inputMode="numeric"
                maxLength={4}
                value={newYear}
                onChange={(e) => setNewYear(e.target.value.trim())}
                className="w-28 rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button type="submit" data-testid="calendar-new-submit" className={BTN_PRIMARY} disabled={!yearOk}>
              {C.addYear}
            </button>
            <span className="text-xs text-slate-500">{C.yearHint}</span>
          </form>
        )}

        {loadError ? (
          <div data-testid="calendar-list-load-error" role="alert" className="m-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
            <p className="flex-1 text-sm text-red-700">{loadError}</p>
            <button type="button" data-testid="calendar-list-retry" className={BTN_SECONDARY} onClick={() => void listQ.refetch()}>
              {L.common.retry}
            </button>
          </div>
        ) : (
          <ListPageShell.Table<CalendarYearSummaryDto>
            state={listQ.isLoading ? 'loading' : rows.length === 0 ? 'empty' : 'ready'}
            fixedLayout
            onKeoGian={datBeRong}
            onVeMacDinhCot={xoaBeRong}
            datTongBeRong={coGhiDeBeRong}
            columns={visibleColumns}
            data={rows}
            rowKey={(y) => y.id}
            title={C.title}
            totalCount={rows.length}
            emptyState={{ title: C.empty }}
          />
        )}
      </ListPageShell>
    </div>
  );
}
