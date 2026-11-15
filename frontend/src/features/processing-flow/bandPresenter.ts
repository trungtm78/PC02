/**
 * THE words and colours of an alert band, for every place that shows one: the step table of a record, the tracking
 * screen and the alert column of the three lists. The server computes the band and the days; the browser only chooses
 * the sentence and the colour, and it chooses them HERE so two screens never disagree.
 */
import { processingFlow as L } from '@/locales/processingFlow.vi';

const R = L.recordTabs;

export type Tone = 'over' | 'red' | 'yellow' | 'green' | 'blue' | 'done' | 'neutral';

export const TONE_CLASS: Record<Tone, string> = {
  over: 'border-red-900 bg-red-900 text-white',
  red: 'border-red-300 bg-red-100 text-red-800',
  yellow: 'border-amber-300 bg-amber-100 text-amber-900',
  green: 'border-green-300 bg-green-100 text-green-800',
  blue: 'border-blue-300 bg-blue-100 text-blue-800',
  done: 'border-green-300 bg-green-100 text-green-800',
  neutral: 'border-slate-300 bg-slate-100 text-slate-600',
};

/** The same tones on a count card (icon tile, icon, number): beside the chips so a band has ONE place for its colours. */
export const TONE_CARD_CLASS: Record<Tone, { iconBgClass: string; iconColorClass: string; valueColorClass: string }> = {
  over: { iconBgClass: 'bg-red-900', iconColorClass: 'text-white', valueColorClass: 'text-red-900' },
  red: { iconBgClass: 'bg-red-100', iconColorClass: 'text-red-700', valueColorClass: 'text-red-700' },
  yellow: { iconBgClass: 'bg-amber-100', iconColorClass: 'text-amber-700', valueColorClass: 'text-amber-700' },
  green: { iconBgClass: 'bg-green-100', iconColorClass: 'text-green-700', valueColorClass: 'text-green-700' },
  blue: { iconBgClass: 'bg-blue-100', iconColorClass: 'text-blue-700', valueColorClass: 'text-blue-700' },
  done: { iconBgClass: 'bg-green-100', iconColorClass: 'text-green-700', valueColorClass: 'text-green-700' },
  neutral: { iconBgClass: 'bg-slate-100', iconColorClass: 'text-slate-600', valueColorClass: 'text-slate-700' },
};

const BAND_TONE: Record<string, Tone> = { OVERDUE: 'over', RED: 'red', YELLOW: 'yellow', GREEN: 'green', NONE: 'neutral' };

/** The tone of a band; a band this build does not know is shown without a colour rather than not at all. */
export const bandTone = (band: string): Tone => BAND_TONE[band] ?? 'neutral';

/** The name of a band alone ("Đỏ"), for a card or a filter. */
export const bandLabel = (band: string): string => R.bands[band] ?? R.bands.NONE;

/** "Đỏ · còn 1 ngày", "Xanh · hạn hôm nay", "Quá hạn 2 ngày". `days`: civil days left, negative after the deadline. */
export function bandText(band: string, days: number | null): string {
  if (band === 'OVERDUE') return days !== null && days < 0 ? R.overdueBy(-days) : R.overdue;
  return days === null ? bandLabel(band) : `${bandLabel(band)} · ${R.daysLeft(days)}`;
}

/** The alert of one record on a list, as `GET /petitions|/incidents|/cases` answers it while the records switch is on. */
export interface RecordAlertDto {
  /** `FLOW`: from the steps of the record's flow. `RECORD_DEADLINE`: the record has no flow; from its own deadline. */
  source: string;
  band: string;
  remainingDays: number;
  stepName: string | null;
  dueAt: string;
}

export interface AlertBadge {
  tone: Tone;
  /** The colour and the days: what the chip says. */
  text: string;
  /** The step the colour comes from; `null` for a record with no flow. */
  step: string | null;
  /** The whole of it in one line: "Đỏ · còn 1 ngày · Xác minh". */
  sentence: string;
}

export function alertBadge(alert: RecordAlertDto): AlertBadge {
  const text = bandText(alert.band, alert.remainingDays);
  const step = alert.stepName?.trim() ? alert.stepName.trim() : null;
  return { tone: bandTone(alert.band), text, step, sentence: step ? `${text} · ${step}` : text };
}
