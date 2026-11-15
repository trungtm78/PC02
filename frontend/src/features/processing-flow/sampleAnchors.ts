/** The imagined record the chart is drawn for: fixed illustrative dates the person may change. Never a real record. */
import type { PreviewScheduleBody, RecordAnchorKey, RecordKind } from './types';

export const DEFAULT_SAMPLE_ANCHORS: Record<RecordAnchorKey, string> = {
  RECEIVED: '2026-12-01',
  PROPOSED: '2026-12-02',
  ASSIGNED_TO_UNIT: '2026-12-03',
  ACCEPTED: '2026-12-05',
  PROSECUTED: '2026-12-15',
  MINUTES_RECEIVED: '2026-12-16',
};

const RECORD_ANCHORS: RecordAnchorKey[] = ['RECEIVED', 'PROPOSED', 'ASSIGNED_TO_UNIT', 'ACCEPTED'];
const CASE_ANCHORS: RecordAnchorKey[] = [...RECORD_ANCHORS, 'PROSECUTED', 'MINUTES_RECEIVED'];

/** The dates of the record that exist for this kind (a petition has no day of prosecution). */
export function sampleAnchorKeys(kind: RecordKind): RecordAnchorKey[] {
  return kind === 'CASE' ? CASE_ANCHORS : RECORD_ANCHORS;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The `anchors` of a preview request: only the dates of this kind that hold a whole day (an empty box is left out). */
export function anchorsBody(values: Partial<Record<RecordAnchorKey, string>>, kind: RecordKind): NonNullable<PreviewScheduleBody['anchors']> {
  const out: NonNullable<PreviewScheduleBody['anchors']> = {};
  for (const key of sampleAnchorKeys(kind)) {
    const v = values[key];
    if (v && ISO_DAY.test(v)) out[key] = v;
  }
  return out;
}
