/**
 * "Sơ đồ": the sample dates, and the chart of the steps as they are now on screen (unsaved edits included). The chart
 * is asked of the server (`preview-schedule`) 400 ms after the last edit; the dates of the imagined record are the
 * person's to change and are only for looking: they are never saved.
 */
import { useMemo, useState } from 'react';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { CRIME_GRAVITIES } from '../codes';
import { DEFAULT_SAMPLE_ANCHORS, anchorsBody, sampleAnchorKeys } from '../sampleAnchors';
import { toPreviewPayload, type StepDraft } from '../steps';
import type { CrimeGravity, PreviewScheduleBody, RecordAnchorKey, RecordKind } from '../types';
import { usePreviewSchedule } from '../usePreviewSchedule';
import { GanttChart, GanttError } from './GanttChart';

const S = L.editor.schedule;

interface Props {
  recordKind: RecordKind;
  steps: StepDraft[];
}

export function SchedulePreviewSection({ recordKind, steps }: Props) {
  const [anchors, setAnchors] = useState<Record<RecordAnchorKey, string>>(DEFAULT_SAMPLE_ANCHORS);
  const [gravity, setGravity] = useState<CrimeGravity | ''>('');

  const body = useMemo<PreviewScheduleBody | null>(
    () =>
      steps.length === 0
        ? null
        : {
            recordKind,
            steps: toPreviewPayload(steps),
            anchors: anchorsBody(anchors, recordKind),
            ...(recordKind === 'CASE' && gravity ? { conditions: { CRIME_GRAVITY: gravity } } : {}),
          },
    [steps, recordKind, anchors, gravity],
  );
  const preview = usePreviewSchedule(body);

  return (
    <section data-testid="schedule-section" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">{S.title}</h2>
        <span className="text-xs text-slate-500">{S.hint}</span>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3" data-testid="sample-dates">
        <span className="text-xs font-semibold text-slate-600">{S.samples}</span>
        {sampleAnchorKeys(recordKind).map((key) => (
          <label key={key} className="flex flex-col gap-0.5 text-xs text-slate-600">
            {L.anchors[key]}
            <input
              type="date"
              data-testid={`sample-${key}`}
              value={anchors[key]}
              onChange={(e) => setAnchors((prev) => ({ ...prev, [key]: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
        ))}
        {recordKind === 'CASE' && (
          <label className="flex flex-col gap-0.5 text-xs text-slate-600">
            {S.conditions}
            <select
              data-testid="sample-gravity"
              value={gravity}
              onChange={(e) => setGravity(e.target.value as CrimeGravity | '')}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">{S.noGravity}</option>
              {CRIME_GRAVITIES.map((g) => (
                <option key={g} value={g}>
                  {L.crimeGravities[g]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {preview.error && <GanttError message={preview.error.message} />}
      {preview.loading && (
        <p data-testid="gantt-loading" role="status" className="text-xs text-slate-500">
          {S.drawing}
        </p>
      )}
      <GanttChart steps={preview.answeredFor?.steps ?? steps} data={preview.data} />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" data-testid="gantt-key">
        <span>
          <i className="mr-1.5 inline-block h-2 w-3.5 rounded-sm bg-slate-400" />
          {S.keyBase}
        </span>
        <span>
          <i className="mr-1.5 inline-block h-2 w-3.5 rounded-sm bg-green-500" />
          {S.keyGreen}
        </span>
        <span>
          <i className="mr-1.5 inline-block h-2 w-3.5 rounded-sm bg-amber-500" />
          {S.keyYellow}
        </span>
        <span>
          <i className="mr-1.5 inline-block h-2 w-3.5 rounded-sm bg-red-600" />
          {S.keyRed}
        </span>
        <span data-testid="gantt-record-deadline-note">
          {preview.data?.recordDeadline ? S.recordDeadlineKey : S.noRecordDeadline}
        </span>
      </div>
    </section>
  );
}
