/**
 * The rows of work (a step × the unit that works it) as the tracking screen lists them, with their pages. ONE table for
 * every place that lists such rows (the tracking screen, the cell of the backlog table), so the two never drift apart.
 * A record opens on the assignment tab by the link on its code (`rowHref`): never by a bare row click, which every list
 * screen takes from the hook `useBamDong`.
 */
import { Link } from 'react-router-dom';
import { ListPageShell, type ColumnDef } from '@/components/shared/ListPageShell';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { TONE_CLASS, bandText, bandTone } from '../bandPresenter';
import { recordTabHref } from '../record-tabs/recordLink';
import { dueText } from './trackingKeys';
import type { TrackingItemDto } from './types';

const T = L.tracking;

/** One row per piece of work: the id the server gives it. Record + step is NOT unique (a step may have two MAIN parties). */
const rowId = (item: TrackingItemDto): string => item.id;

const COLUMNS: ColumnDef<TrackingItemDto>[] = [
  {
    key: 'alert',
    header: T.columns.alert,
    width: '11rem',
    render: (item) => (
      <span
        data-testid="tracking-band"
        className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[bandTone(item.band)]}`}
      >
        {bandText(item.band, item.remainingDays)}
      </span>
    ),
  },
  {
    key: 'record',
    header: T.columns.record,
    width: '15rem',
    render: (item) => {
      const code = item.recordCode ?? T.noCode;
      return (
        <div className="min-w-0">
          <Link
            to={recordTabHref(item.recordKind, item.recordId)}
            aria-label={T.open(code)}
            className={`font-semibold text-blue-800 hover:underline ${A11Y_FOCUS_RING}`}
          >
            {code}
          </Link>
          {item.recordLabel && <span className="text-slate-700"> · {item.recordLabel}</span>}
          <div className="text-xs text-slate-500">{L.recordKinds[item.recordKind] ?? item.recordKind}</div>
        </div>
      );
    },
  },
  { key: 'step', header: T.columns.step, width: '12rem', render: (item) => item.stepName },
  {
    key: 'unit',
    header: T.columns.unit,
    width: '14rem',
    render: (item) =>
      item.responsibleName ? (
        `${item.teamName ?? T.noUnit} · ${item.responsibleName}`
      ) : (
        <>
          {item.teamName ?? T.noUnit}
          <div className="text-xs text-slate-500">{T.noPerson}</div>
        </>
      ),
  },
  {
    key: 'due',
    header: T.columns.due,
    width: '9rem',
    cellClassName: 'px-4 py-3 align-top text-sm text-slate-800 tabular-nums',
    render: (item) => dueText(item.dueAt),
  },
];

interface TrackingItemsTableProps {
  /** Still waiting for the rows (or for a page that is being replaced). */
  loading: boolean;
  rows: TrackingItemDto[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (next: number) => void;
  title: string;
  emptyTitle: string;
  emptyDescription?: string;
}

export function TrackingItemsTable({ loading, rows, total, page, pageSize, onPageChange, title, emptyTitle, emptyDescription }: TrackingItemsTableProps) {
  return (
    <>
      <ListPageShell.Table<TrackingItemDto>
        state={loading ? 'loading' : rows.length === 0 ? 'empty' : 'ready'}
        fixedLayout
        xuongDong
        columns={COLUMNS}
        data={rows}
        rowKey={rowId}
        title={title}
        totalCount={total}
        emptyState={{ title: emptyTitle, description: emptyDescription }}
        rowHref={(item) => recordTabHref(item.recordKind, item.recordId)}
        rowTestId={(item) => `tracking-row-${rowId(item)}`}
      />
      <ListPageShell.Pagination page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} totalCount={total} onPageChange={onPageChange} />
    </>
  );
}
