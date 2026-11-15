/**
 * The read-only Gantt chart of a flow: one bar per step on a day axis, the tail of each bar tinted by the alert
 * thresholds. It is drawn from the instants the server computed (`buildGantt`); nothing here works out a deadline.
 * It scrolls inside its own box so it stays legible on a 400 px screen.
 */
import type { CSSProperties } from 'react';
import { AlertCircle } from 'lucide-react';
import { formatVNDate } from '@/lib/dates';
import { errorText, processingFlow as L } from '@/locales/processingFlow.vi';
import { axisPct, buildGantt, type SegmentKind } from '../gantt';
import type { StepDraft } from '../steps';
import type { SchedulePreviewDto } from '../types';

const S = L.editor.schedule;

const SEGMENT_CLASS: Record<SegmentKind, string> = {
  base: 'bg-slate-400',
  green: 'bg-green-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-600',
};

const shortDate = (iso: string | null): string => formatVNDate(iso).slice(0, 5);

/** What only a record's chart has: a row that is finished, a note in place of a bar, the regulatory deadline behind an earlier target. */
export interface GanttRowExtra {
  /** Replaces the row label (a tick for a finished step, "(bỏ qua)" for a skipped one). */
  label?: string;
  /** The step is finished: its bar is drawn in one grey, with no alert bands. */
  done?: boolean;
  /** Shown instead of the "cannot draw" text on a row that has no bar and no problem (a step that waits, a skipped step). */
  note?: string;
  /** The regulatory deadline, when the unit's own target is earlier: the gap is drawn as a dashed box behind the bar. */
  regulatoryAt?: string | null;
}

export interface GanttExtras {
  /** The instant "now" for the vertical line of today. */
  todayAt?: string | null;
  /** One entry per row, in the order of `steps`. */
  rows?: Array<GanttRowExtra | undefined>;
}

interface Props {
  steps: Pick<StepDraft, 'name' | 'setsRecordDeadline'>[];
  data: SchedulePreviewDto | null;
  extras?: GanttExtras;
}

export function GanttChart({ steps, data, extras }: Props) {
  if (steps.length === 0) {
    return (
      <p data-testid="gantt-empty" className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
        {S.empty}
      </p>
    );
  }
  if (!data) return null;

  const model = buildGantt(data.steps, data.recordDeadline);
  const deadlineFraction = model.recordDeadlinePct === null ? null : model.recordDeadlinePct / 100;
  const todayPct = extras?.todayAt ? axisPct(model, extras.todayAt) : null;
  const todayShown = todayPct !== null && todayPct >= 0 && todayPct <= 100 ? todayPct / 100 : null;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white px-3 py-2.5" data-testid="gantt-scroll">
      <div
        data-testid="gantt"
        role="img"
        aria-label={S.chartLabel}
        className="relative min-w-[660px] pb-10"
        style={{ '--lw': '170px' } as CSSProperties}
      >
        <div className="flex h-[22px] items-center">
          <div className="w-[170px] flex-none" />
          <div className="relative h-full flex-1 border-b border-slate-300">
            {model.ticks.map((t) => (
              <span key={t.pct} className="absolute top-0.5 translate-x-0.5 whitespace-nowrap text-[11px] text-slate-500" style={{ left: `${t.pct}%` }}>
                {t.label}
              </span>
            ))}
          </div>
        </div>

        {model.bars.map((bar, i) => {
          const step = steps[bar.stepIndex] ?? steps[i];
          const extra = extras?.rows?.[bar.stepIndex] ?? extras?.rows?.[i];
          const label = extra?.label ?? `${bar.stepIndex + 1}. ${step?.name ?? ''}${step?.setsRecordDeadline ? ' ★' : ''}`;
          const regulatoryPct = extra?.regulatoryAt ? axisPct(model, extra.regulatoryAt) : null;
          const gapPct = bar.drawn && regulatoryPct !== null && regulatoryPct > bar.duePct ? Math.min(regulatoryPct, 100) - bar.duePct : 0;
          return (
            <div key={bar.stepIndex} data-testid={`gantt-row-${i}`} className="flex h-[30px] items-center">
              <div className="w-[170px] flex-none truncate pr-2 text-[12.5px] text-slate-800" title={label}>
                {label}
              </div>
              <div className="relative h-full min-w-0 flex-1 border-l border-slate-100">
                {bar.drawn ? (
                  <>
                    <div
                      data-testid={`gantt-bar-${i}`}
                      data-start-pct={bar.startPct.toFixed(3)}
                      data-width-pct={bar.widthPct.toFixed(3)}
                      title={S.barTip(label, shortDate(bar.startAt), shortDate(bar.dueAt))}
                      className="absolute top-[7px] flex h-4 min-w-[3px] overflow-hidden rounded"
                      style={{ left: `${bar.startPct}%`, width: `${bar.widthPct}%` }}
                    >
                      {bar.segments.map((seg) => (
                        <span
                          key={seg.kind}
                          data-testid={`gantt-seg-${i}-${seg.kind}`}
                          className={`block ${extra?.done ? 'bg-slate-300' : SEGMENT_CLASS[seg.kind]}`}
                          style={{ flexGrow: seg.size, flexBasis: 0 }}
                        />
                      ))}
                    </div>
                    {gapPct > 0 && (
                      <div
                        data-testid={`gantt-gap-${i}`}
                        className="absolute top-[7px] h-4 rounded-r border border-l-2 border-dashed border-slate-400 border-l-slate-800"
                        style={{ left: `${bar.duePct}%`, width: `${gapPct}%` }}
                      />
                    )}
                    <span className="absolute top-1.5 whitespace-nowrap pl-1.5 text-[11.5px] text-slate-600" style={{ left: `${Math.max(bar.duePct, gapPct > 0 ? bar.duePct + gapPct : 0)}%` }}>
                      {shortDate(bar.dueAt)}
                      {bar.provisional && (
                        <span
                          data-testid={`gantt-provisional-${i}`}
                          title={S.provisionalTip}
                          className="ml-1.5 cursor-help rounded border border-dashed border-amber-500 bg-amber-50 px-1 text-[10.5px] font-semibold text-amber-800"
                        >
                          {S.provisional}
                        </span>
                      )}
                    </span>
                  </>
                ) : (
                  <span
                    data-testid={`gantt-problem-${i}`}
                    className={`absolute left-2 top-1.5 whitespace-nowrap text-xs ${extra?.note && !bar.problem ? 'text-slate-500' : 'text-red-700'}`}
                  >
                    {extra?.note && !bar.problem ? extra.note : S.problem(errorText(bar.problem ?? undefined))}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {todayShown !== null && (
          <div
            data-testid="gantt-today"
            className="pointer-events-none absolute bottom-0 top-0 border-l-2 border-blue-600"
            style={{ left: `calc(var(--lw) + (100% - var(--lw)) * ${todayShown.toFixed(4)})` }}
          >
            <em className={`absolute bottom-5 whitespace-nowrap bg-white px-1 text-[11.5px] font-semibold not-italic text-blue-600 ${todayShown > 0.8 ? 'right-1' : 'left-1'}`}>
              {L.recordTabs.gantt.today(formatVNDate(extras?.todayAt))}
            </em>
          </div>
        )}

        {deadlineFraction !== null && (
          <div
            data-testid="gantt-record-deadline"
            className="pointer-events-none absolute bottom-0 top-0 border-l-2 border-dashed border-blue-900"
            style={{ left: `calc(var(--lw) + (100% - var(--lw)) * ${deadlineFraction.toFixed(4)})` }}
          >
            <em
              className={`absolute bottom-0 whitespace-nowrap bg-white px-1 text-[11.5px] font-semibold not-italic text-blue-900 ${deadlineFraction > 0.62 ? 'right-1' : 'left-1'}`}
            >
              {S.recordDeadline(formatVNDate(data.recordDeadline))}
            </em>
          </div>
        )}
      </div>
    </div>
  );
}

export function GanttError({ message }: { message: string }) {
  return (
    <p data-testid="gantt-error" role="alert" className="mb-2 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>
        {S.failed}: {message}
      </span>
    </p>
  );
}
