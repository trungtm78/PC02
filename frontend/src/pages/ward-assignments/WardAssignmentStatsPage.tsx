import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { extractApiError } from '@/lib/api-errors';
import { wardAssignmentAlerts as t } from '@/locales/wardAssignmentAlerts.vi';
import { wardAlertsApi, wardListLink, type AlertLevel, type WardStats, type WardStatsQuery } from '@/features/ward-assignments/api/alerts';

/**
 * "Thống kê hồ sơ phân công phường/xã" (`/ho-so-phan-cong/thong-ke`): within the person's read scope, by the
 * request's first submission. Every number opens the list of its rows: the list takes the same filters
 * (`submitted`, `from`, `to`, `teamId`, `crimeId`, `caseType`, `kind`, `status`, `alert`), so the rows are the number.
 */

const FILTER_KEYS = ['from', 'to', 'teamId', 'crimeId', 'caseType'] as const;

function queryFrom(params: URLSearchParams): WardStatsQuery {
  const q: WardStatsQuery = {};
  for (const key of FILTER_KEYS) {
    const v = params.get(key);
    if (v) (q as Record<string, string>)[key] = v;
  }
  return q;
}

const rateText = (v: number | null | undefined) => (v === null || v === undefined ? t.stats.none : `${v}%`);
const numberText = (v: number | null | undefined) => (v === null || v === undefined ? t.stats.none : String(v));
const monthText = (month: string) => `${month.slice(5, 7)}/${month.slice(0, 4)}`;

interface CellLink {
  teamId?: string | null;
  crimeId?: string | null;
  status?: string;
  alert?: AlertLevel;
  kind?: 'NEW' | 'REASSIGN';
}

export default function WardAssignmentStatsPage() {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => queryFrom(params), [params]);
  const [draft, setDraft] = useState<WardStatsQuery>(query);
  // The numbers with the filters they were counted with: the links of a number always open ITS rows, and an
  // answer to an earlier filter never replaces the answer to the current one.
  const [shown, setShown] = useState<{ query: WardStatsQuery; stats: WardStats } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setLoading(true);
    setError(null);
    setShown(null);
    try {
      const stats = await wardAlertsApi.stats(query);
      if (ticket === latest.current) setShown({ query, stats });
    } catch (e) {
      if (ticket !== latest.current) return;
      const normalized = extractApiError(e);
      setError((normalized.code && t.errors[normalized.code]) || t.stats.loadFailed);
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [query]);
  const stats = shown?.stats ?? null;
  const counted = shown?.query ?? query;

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => setDraft(query), [query]);

  const apply = () => {
    const next = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const v = draft[key];
      if (v) next.set(key, v);
    }
    setParams(next);
  };

  /** The list of the rows of one number: the period and filters of the page, plus the cell's own. */
  const linkTo = (cell: CellLink) =>
    wardListLink({
      submitted: 'true',
      from: counted.from,
      to: counted.to,
      caseType: counted.caseType,
      teamId: cell.teamId ?? counted.teamId,
      crimeId: cell.crimeId ?? counted.crimeId,
      status: cell.status,
      alert: cell.alert,
      kind: cell.kind,
    });

  const NumberLink = ({ value, cell, testId }: { value: number; cell: CellLink; testId?: string }) =>
    value > 0 ? (
      <Link to={linkTo(cell)} className="text-blue-700 hover:underline" data-testid={testId} title={t.stats.openList}>
        {value}
      </Link>
    ) : (
      <span data-testid={testId}>0</span>
    );

  const chartData = (stats?.byMonth ?? []).map((m) => ({ name: monthText(m.month), [t.stats.cards.new]: m.new, [t.stats.cards.reassign]: m.reassign }));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t.stats.title}</h1>
        <p className="text-sm text-slate-500">{t.stats.subtitle}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <label className="flex flex-col text-sm">
          {t.stats.from}
          <input type="date" className="rounded border px-2 py-1" value={draft.from ?? ''} onChange={(e) => setDraft({ ...draft, from: e.target.value || undefined })} />
        </label>
        <label className="flex flex-col text-sm">
          {t.stats.to}
          <input type="date" className="rounded border px-2 py-1" value={draft.to ?? ''} onChange={(e) => setDraft({ ...draft, to: e.target.value || undefined })} />
        </label>
        <label className="flex flex-col text-sm">
          {t.stats.caseType}
          <select
            className="rounded border px-2 py-1"
            value={draft.caseType ?? ''}
            onChange={(e) => setDraft({ ...draft, caseType: (e.target.value || undefined) as WardStatsQuery['caseType'] })}
          >
            <option value="">{t.stats.caseTypeAll}</option>
            <option value="INCIDENT">{t.stats.caseTypes.INCIDENT}</option>
            <option value="CASE">{t.stats.caseTypes.CASE}</option>
          </select>
        </label>
        <button type="button" className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700" onClick={apply}>
          {t.stats.apply}
        </button>
        <button type="button" className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50" onClick={() => setParams(new URLSearchParams())}>
          {t.stats.reset}
        </button>
      </div>

      {error && <LoadErrorBanner error={error} onRetry={() => void load()} loading={loading} what={t.stats.what} />}
      {loading && !stats && !error && <p className="text-sm text-slate-500">{t.stats.loading}</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="ward-stats-cards">
            {(
              [
                ['total', stats.cards.total, {}],
                ['new', stats.cards.new, { kind: 'NEW' }],
                ['reassign', stats.cards.reassign, { kind: 'REASSIGN' }],
                ['pending', stats.cards.pending, { status: 'SUBMITTED' }],
                ['returned', stats.cards.returned, { status: 'RETURNED' }],
                ['overdue', stats.cards.overdue, { alert: 'OVERDUE' }],
              ] as [keyof typeof t.stats.cards, number, CellLink][]
            ).map(([key, value, cell]) => (
              <div key={key} className="rounded-lg border p-3">
                <div className="text-xs text-slate-500">{t.stats.cards[key]}</div>
                <div className="text-2xl font-semibold">
                  <NumberLink value={value} cell={cell} testId={`ward-card-${key}`} />
                </div>
              </div>
            ))}
            {(
              [
                ['onTimeRate', rateText(stats.cards.onTimeRate)],
                ['firstPassRate', rateText(stats.cards.firstPassRate)],
                ['avgSubmissions', numberText(stats.cards.avgSubmissions)],
                ['avgReviewDays', numberText(stats.cards.avgReviewDays)],
              ] as [keyof typeof t.stats.cards, string][]
            ).map(([key, text]) => (
              <div key={key} className="rounded-lg border p-3">
                <div className="text-xs text-slate-500">{t.stats.cards[key]}</div>
                <div className="text-2xl font-semibold" data-testid={`ward-card-${key}`}>
                  {text}
                </div>
              </div>
            ))}
          </div>

          {stats.cards.total === 0 ? (
            <p className="text-sm text-slate-500">{t.stats.empty}</p>
          ) : (
            <>
              <section>
                <h2 className="mb-2 text-lg font-semibold">{t.stats.byMonth}</h2>
                <div className="rounded-lg border p-4">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey={t.stats.cards.new} stackId="a" fill="#2563eb" />
                      <Bar dataKey={t.stats.cards.reassign} stackId="a" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold">{t.stats.byUnit}</h2>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-full text-sm" data-testid="ward-stats-units">
                    <thead className="bg-slate-50 text-left">
                      <tr>
                        {(['unit', 'total', 'new', 'reassign', 'pending', 'returned', 'overdue', 'onTimeRate', 'avgSubmissions', 'avgReviewDays'] as const).map((c) => (
                          <th key={c} className="px-3 py-2 font-medium">
                            {t.stats.columns[c]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byUnit.map((u) => (
                        <tr key={u.teamId} className="border-t">
                          <td className="px-3 py-2">{u.name}</td>
                          <td className="px-3 py-2"><NumberLink value={u.total} cell={{ teamId: u.teamId }} /></td>
                          <td className="px-3 py-2"><NumberLink value={u.new} cell={{ teamId: u.teamId, kind: 'NEW' }} /></td>
                          <td className="px-3 py-2"><NumberLink value={u.reassign} cell={{ teamId: u.teamId, kind: 'REASSIGN' }} /></td>
                          <td className="px-3 py-2"><NumberLink value={u.pending} cell={{ teamId: u.teamId, status: 'SUBMITTED' }} /></td>
                          <td className="px-3 py-2"><NumberLink value={u.returned} cell={{ teamId: u.teamId, status: 'RETURNED' }} /></td>
                          <td className="px-3 py-2"><NumberLink value={u.overdue} cell={{ teamId: u.teamId, alert: 'OVERDUE' }} /></td>
                          <td className="px-3 py-2">{rateText(u.onTimeRate)}</td>
                          <td className="px-3 py-2">{numberText(u.avgSubmissions)}</td>
                          <td className="px-3 py-2">{numberText(u.avgReviewDays)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold">{t.stats.byCrime}</h2>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-full text-sm" data-testid="ward-stats-crimes">
                    <thead className="bg-slate-50 text-left">
                      <tr>
                        {(['crime', 'total', 'new', 'reassign'] as const).map((c) => (
                          <th key={c} className="px-3 py-2 font-medium">
                            {t.stats.columns[c]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byCrime.map((c) => (
                        <tr key={c.crimeId ?? '-'} className="border-t">
                          <td className="px-3 py-2">{c.name ?? t.stats.crimeOther}</td>
                          {/* A crime outside the catalogue has no list filter of its own: its numbers are not links. */}
                          {(['total', 'new', 'reassign'] as const).map((k) => (
                            <td key={k} className="px-3 py-2">
                              {c.crimeId ? <NumberLink value={c[k]} cell={{ crimeId: c.crimeId, ...(k === 'new' ? { kind: 'NEW' } : k === 'reassign' ? { kind: 'REASSIGN' } : {}) }} /> : c[k]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
