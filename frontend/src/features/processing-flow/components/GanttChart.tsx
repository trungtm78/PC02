/**
 * The read-only Gantt chart of a flow: one bar per step on a day axis, the tail of each bar tinted by the alert
 * thresholds. It is drawn from the instants the server computed (`buildGantt`); nothing here works out a deadline.
 * It scrolls inside its own box so it stays legible on a 400 px screen.
 */
import type { CSSProperties } from 'react';
import { AlertCircle } from 'lucide-react';
import { formatVNDate } from '@/lib/dates';
import { errorText, processingFlow as L } from '@/locales/processingFlow.vi';
import { buildGantt, type SegmentKind } from '../gantt';
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

interface Props {
  steps: Pick<StepDraft, 'name' | 'setsRecordDeadline'>[];
  data: SchedulePreviewDto | null;
}

export function GanttChart({ steps, data }: Props) {
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
          const label = `${bar.stepIndex + 1}. ${step?.name ?? ''}${step?.setsRecordDeadline ? ' ★' : ''}`;
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
                          className={`block ${SEGMENT_CLASS[seg.kind]}`}
                          style={{ flexGrow: seg.size, flexBasis: 0 }}
                        />
                      ))}
                    </div>
                    <span className="absolute top-1.5 whitespace-nowrap pl-1.5 text-[11.5px] text-slate-600" style={{ left: `${bar.duePct}%` }}>
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
                  <span data-testid={`gantt-problem-${i}`} className="absolute left-2 top-1.5 whitespace-nowrap text-xs text-red-700">
                    {S.problem(errorText(bar.problem ?? undefined))}
                  </span>
                )}
              </div>
            </div>
          );
        })}

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
