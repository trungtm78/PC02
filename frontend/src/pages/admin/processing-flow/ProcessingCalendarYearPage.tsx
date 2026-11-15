/**
 * /admin/lich-lam-viec/:year — the working calendar of one year: the weekly days off, and the days that differ (public
 * holidays: OFF; compensatory working days: WORKING). A year is saved with the row and revision the person looked at
 * (`expected`, or null for a year with no row), confirmed when its days are complete, and not editable while confirmed.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '@/constants/styles';
import { formatVNDateTime } from '@/lib/dates';
import { errorText, processingFlow as L } from '@/locales/processingFlow.vi';
import { processingCalendarApi } from '@/features/processing-flow/api';
import {
  addDaysInYear,
  calendarDirty,
  editStateFrom,
  expandRange,
  removeDay,
  toggleWeekendDay,
  toSaveBody,
  type CalendarEditState,
} from '@/features/processing-flow/calendar';
import { CALENDAR_DAY_KINDS } from '@/features/processing-flow/codes';
import { FeatureOffState } from '@/features/processing-flow/components/FeatureOffState';
import { explainError, isFeatureOff } from '@/features/processing-flow/errors';
import { CALENDAR_PATH } from '@/features/processing-flow/menu';
import { PROCESSING_QUERY_KEYS } from '@/features/processing-flow/queryKeys';
import type { CalendarDayKind, CalendarYearDto, CalendarYearRead } from '@/features/processing-flow/types';
import { useProcessingPermissions } from '@/features/processing-flow/usePermissions';

const C = L.calendar;
const YEAR = /^\d{4}$/;

export default function ProcessingCalendarYearPage() {
  const { year: yearParam = '' } = useParams<{ year: string }>();
  const queryClient = useQueryClient();
  const valid = YEAR.test(yearParam);
  const year = Number(yearParam);

  const yearQ = useQuery({
    queryKey: PROCESSING_QUERY_KEYS.calendarYear(year),
    queryFn: () => processingCalendarApi.get(year),
    enabled: valid,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (!valid || yearQ.isError) {
    if (valid && isFeatureOff(yearQ.error)) return <FeatureOffState />;
    const message = !valid ? errorText('CALENDAR_YEAR_INVALID') : explainError(yearQ.error).message;
    return (
      <div data-testid="calendar-load-error" role="alert" className="m-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
        <p className="flex-1 text-sm text-red-700">{message}</p>
        {valid && (
          <button type="button" className={BTN_SECONDARY} onClick={() => void yearQ.refetch()}>
            {L.common.retry}
          </button>
        )}
        <Link to={CALENDAR_PATH} className="text-sm text-blue-700 hover:underline">
          {C.back}
        </Link>
      </div>
    );
  }
  if (!yearQ.data) {
    return (
      <p data-testid="calendar-loading" role="status" className="m-4 text-sm text-slate-500">
        {L.common.loading}
      </p>
    );
  }

  return (
    <YearBody
      key={year}
      year={year}
      stored={yearQ.data.stored}
      setStored={(next) => {
        const read: CalendarYearRead = { year, stored: next };
        queryClient.setQueryData(PROCESSING_QUERY_KEYS.calendarYear(year), read);
        void queryClient.invalidateQueries({ queryKey: PROCESSING_QUERY_KEYS.calendarYears });
      }}
      reload={() => void yearQ.refetch()}
    />
  );
}

interface BodyProps {
  year: number;
  stored: CalendarYearDto | null;
  setStored: (stored: CalendarYearDto | null) => void;
  reload: () => void;
}

function YearBody({ year, stored, setStored, reload }: BodyProps) {
  const navigate = useNavigate();
  const perms = useProcessingPermissions();
  const [state, setState] = useState<CalendarEditState>(() => editStateFrom(stored));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [date, setDate] = useState('');
  const [kind, setKind] = useState<CalendarDayKind>('OFF');
  const [label, setLabel] = useState('');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const confirmed = stored?.status === 'CONFIRMED';
  const editable = perms.canEditCalendar && !confirmed && !busy;
  const dirty = calendarDirty(state, stored);
  const expected = stored ? { id: stored.id, revision: stored.revision } : null;

  function apply(next: CalendarYearDto | null) {
    setStored(next);
    setState(editStateFrom(next));
  }

  async function run(job: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    setError(null);
    setConflict(false);
    try {
      await job();
    } catch (err) {
      const e = explainError(err);
      if (e.conflict) {
        setConflict(true);
        reload();
      } else setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      apply(await processingCalendarApi.save(year, toSaveBody(state, expected)));
      setMessage(C.saved);
    });

  const confirm = () =>
    run(async () => {
      if (!expected) return;
      apply(await processingCalendarApi.confirm(year, expected));
      setMessage(C.confirmed);
    });

  const unconfirm = () =>
    run(async () => {
      if (!expected) return;
      apply(await processingCalendarApi.unconfirm(year, expected));
      setMessage(C.unconfirmed);
    });

  const remove = () =>
    run(async () => {
      if (!expected) return;
      await processingCalendarApi.remove(year, expected);
      setStored(null);
      navigate(CALENDAR_PATH);
    });

  function addDays(dates: string[]) {
    setMessage(null);
    setError(null);
    if (dates.length === 0) {
      setError(C.add.invalid);
      return;
    }
    const { days, skipped } = addDaysInYear(state.days, year, dates, kind, label);
    setState((s) => ({ ...s, days }));
    setMessage([C.add.added(dates.length - skipped), skipped > 0 ? C.add.skipped(skipped) : ''].filter(Boolean).join(' '));
  }

  return (
    <div data-testid="processing-calendar-year-page" className="flex flex-col gap-3 p-4">
      <div>
        <Link to={CALENDAR_PATH} className="text-sm text-blue-700 hover:underline">
          {C.back}
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#003973]">
            {C.title} {year}
          </h1>
          <p className="text-sm text-slate-600">
            {stored ? (
              <>
                <span data-testid="calendar-status" className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${confirmed ? 'border-green-200 bg-green-50 text-green-800' : 'border-slate-300 bg-slate-100 text-slate-700'}`}>
                  {C.status[stored.status]}
                </span>
                {confirmed && stored.confirmedAt && <span className="ml-2 text-xs text-slate-500">{C.confirmedBy(formatVNDateTime(stored.confirmedAt))}</span>}
              </>
            ) : (
              <span data-testid="calendar-not-stored">{C.notStored}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {perms.canEditCalendar && !confirmed && (
            <button type="button" data-testid="calendar-save" className={BTN_PRIMARY} disabled={busy || (stored !== null && !dirty)} onClick={() => void save()}>
              {busy ? L.common.saving : C.save}
            </button>
          )}
          {perms.canConfirmCalendar && stored && !confirmed && (
            <button type="button" data-testid="calendar-confirm" className={BTN_SECONDARY} disabled={busy || dirty} title={dirty ? C.needSaveFirst : undefined} onClick={() => void confirm()}>
              {C.confirm}
            </button>
          )}
          {perms.canConfirmCalendar && confirmed && (
            <button type="button" data-testid="calendar-unconfirm" className={BTN_SECONDARY} disabled={busy} onClick={() => void unconfirm()}>
              {C.unconfirm}
            </button>
          )}
          {perms.canEditCalendar && stored && !confirmed && (
            <button type="button" data-testid="calendar-delete" className={BTN_SECONDARY} disabled={busy} onClick={() => setDeleteOpen(true)}>
              {C.deleteYear}
            </button>
          )}
        </div>
      </div>

      {!confirmed && (
        <p data-testid="calendar-unconfirmed-banner" className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          {C.unconfirmedBanner}
        </p>
      )}
      {confirmed && (
        <p data-testid="calendar-confirmed-note" className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {C.confirmedNote}
        </p>
      )}
      {message && (
        <p data-testid="calendar-message" role="status" className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </p>
      )}
      {error && (
        <p data-testid="calendar-error" role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {conflict && (
        <p data-testid="calendar-conflict" role="alert" className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <b>{L.conflict.title}</b> {L.conflict.body}
        </p>
      )}
      {dirty && <p className="text-xs text-amber-800">{C.unsaved}</p>}

      {deleteOpen && (
        <section data-testid="calendar-delete-panel" className="flex flex-col gap-2 rounded-lg border border-red-200 bg-white p-3">
          <p className="text-sm text-slate-700">{C.deleteConfirm(year)}</p>
          <p className="text-xs text-slate-500">{C.deleteHint}</p>
          <div className="flex gap-2">
            <button type="button" className={BTN_SECONDARY} onClick={() => setDeleteOpen(false)} disabled={busy}>
              {L.common.cancel}
            </button>
            <button type="button" data-testid="calendar-delete-confirm" className={BTN_DANGER} disabled={busy} onClick={() => void remove()}>
              {L.common.remove}
            </button>
          </div>
        </section>
      )}

      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-white p-3">
        <legend className="px-1 text-xs font-semibold text-slate-600">{C.weekend}</legend>
        {C.weekdays.map((name, d) => (
          <label key={d} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
            <input
              type="checkbox"
              data-testid={`weekend-${d}`}
              checked={state.weekendDays.includes(d)}
              disabled={!editable}
              onChange={(e) => setState((s) => ({ ...s, weekendDays: toggleWeekendDay(s.weekendDays, d, e.target.checked) }))}
            />
            {name}
          </label>
        ))}
      </fieldset>

      <section className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <h2 className="text-sm font-semibold text-slate-800">{C.add.title}</h2>
        <div className="flex flex-wrap items-end gap-3">
          {!rangeOpen && (
            <label className="flex flex-col gap-0.5 text-xs text-slate-600">
              {C.add.date}
              <input type="date" data-testid="day-date" value={date} disabled={!editable} onChange={(e) => setDate(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" />
            </label>
          )}
          {rangeOpen && (
            <>
              <label className="flex flex-col gap-0.5 text-xs text-slate-600">
                {C.add.from}
                <input type="date" data-testid="range-from" value={from} disabled={!editable} onChange={(e) => setFrom(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" />
              </label>
              <label className="flex flex-col gap-0.5 text-xs text-slate-600">
                {C.add.to}
                <input type="date" data-testid="range-to" value={to} disabled={!editable} onChange={(e) => setTo(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" />
              </label>
            </>
          )}
          <label className="flex flex-col gap-0.5 text-xs text-slate-600">
            {C.add.kind}
            <select data-testid="day-kind" value={kind} disabled={!editable} onChange={(e) => setKind(e.target.value as CalendarDayKind)} className="rounded border border-slate-300 px-2 py-1 text-sm">
              {CALENDAR_DAY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {C.kinds[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-48 flex-1 flex-col gap-0.5 text-xs text-slate-600">
            {C.add.label}
            <input data-testid="day-label" value={label} disabled={!editable} onChange={(e) => setLabel(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          {!rangeOpen ? (
            <button type="button" data-testid="day-add" className={BTN_SECONDARY} disabled={!editable} onClick={() => addDays(date ? [date] : [])}>
              {C.add.submit}
            </button>
          ) : (
            <button type="button" data-testid="range-add" className={BTN_SECONDARY} disabled={!editable} onClick={() => addDays(expandRange(from, to))}>
              {C.add.submitRange}
            </button>
          )}
          <label className="inline-flex items-center gap-1.5 pb-1 text-xs text-slate-700">
            <input type="checkbox" data-testid="range-toggle" checked={rangeOpen} disabled={!editable} onChange={(e) => setRangeOpen(e.target.checked)} />
            {C.add.range}
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-800">{C.days}</h2>
        {state.days.length === 0 ? (
          <p data-testid="days-empty" className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
            {C.noDays}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
                  <th className="px-2.5 py-2">{C.dayColumns.date}</th>
                  <th className="px-2.5 py-2">{C.dayColumns.kind}</th>
                  <th className="px-2.5 py-2">{C.dayColumns.label}</th>
                  <th className="px-2.5 py-2" />
                </tr>
              </thead>
              <tbody>
                {state.days.map((d) => (
                  <tr key={d.date} data-testid={`day-row-${d.date}`} className="border-t border-slate-100">
                    <td className="px-2.5 py-1.5 tabular-nums">{d.date}</td>
                    <td className="px-2.5 py-1.5">{C.kinds[d.kind]}</td>
                    <td className="px-2.5 py-1.5">{d.label ?? ''}</td>
                    <td className="px-2.5 py-1.5 text-right">
                      {perms.canEditCalendar && !confirmed && (
                        <button
                          type="button"
                          data-testid={`day-remove-${d.date}`}
                          aria-label={C.removeDay(d.date)}
                          disabled={busy}
                          className="rounded border border-slate-300 px-1.5 text-slate-600 hover:text-red-700 disabled:opacity-40"
                          onClick={() => setState((s) => ({ ...s, days: removeDay(s.days, d.date) }))}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <label className="flex flex-col gap-1 text-sm text-slate-700">
        {C.note}
        <textarea
          data-testid="calendar-note"
          rows={2}
          value={state.note}
          disabled={!editable}
          onChange={(e) => setState((s) => ({ ...s, note: e.target.value }))}
          className="rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
        />
      </label>
    </div>
  );
}
