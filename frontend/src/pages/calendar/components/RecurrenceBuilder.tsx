import { useMemo } from 'react';

export type RecurrencePreset = 'none' | 'yearly' | 'monthly' | 'weekly' | 'custom';

const WEEKDAY_LABELS: Array<{ value: string; label: string }> = [
  { value: 'MO', label: 'T2' },
  { value: 'TU', label: 'T3' },
  { value: 'WE', label: 'T4' },
  { value: 'TH', label: 'T5' },
  { value: 'FR', label: 'T6' },
  { value: 'SA', label: 'T7' },
  { value: 'SU', label: 'CN' },
];

interface Props {
  preset: RecurrencePreset;
  customInterval: number;
  customByDays: string[];
  recurrenceEndDate: string;
  onPresetChange: (p: RecurrencePreset) => void;
  onCustomIntervalChange: (n: number) => void;
  onByDaysChange: (days: string[]) => void;
  onEndDateChange: (d: string) => void;
}

/**
 * Build an RRULE string from preset + optional custom rules.
 * Returns '' for 'none', else a valid RFC 5545 RRULE string.
 */
export function buildRRule(
  preset: RecurrencePreset,
  customInterval: number,
  customByDays: string[],
): string {
  if (preset === 'none') return '';
  if (preset === 'yearly') return 'FREQ=YEARLY';
  if (preset === 'monthly') return 'FREQ=MONTHLY';
  if (preset === 'weekly') return 'FREQ=WEEKLY';
  // custom: weekly with BYDAY + INTERVAL
  const parts = ['FREQ=WEEKLY'];
  if (customInterval > 1) parts.push(`INTERVAL=${customInterval}`);
  if (customByDays.length > 0) parts.push(`BYDAY=${customByDays.join(',')}`);
  return parts.join(';');
}

export function RecurrenceBuilder({
  preset,
  customInterval,
  customByDays,
  recurrenceEndDate,
  onPresetChange,
  onCustomIntervalChange,
  onByDaysChange,
  onEndDateChange,
}: Props) {
  const previewText = useMemo(() => {
    if (preset === 'none') return null;
    if (preset === 'yearly') return 'Lặp lại mỗi năm';
    if (preset === 'monthly') return 'Lặp lại mỗi tháng';
    if (preset === 'weekly') return 'Lặp lại mỗi tuần';
    // custom
    if (customByDays.length === 0) return 'Chọn ít nhất 1 thứ trong tuần';
    const dayNames = customByDays
      .map((d) => WEEKDAY_LABELS.find((w) => w.value === d)?.label ?? d)
      .join(', ');
    const intervalText = customInterval > 1 ? ` mỗi ${customInterval} tuần` : ' hàng tuần';
    return `Lặp lại vào ${dayNames}${intervalText}`;
  }, [preset, customInterval, customByDays]);

  const toggleDay = (day: string) => {
    if (customByDays.includes(day)) {
      onByDaysChange(customByDays.filter((d) => d !== day));
    } else {
      onByDaysChange([...customByDays, day]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        {[
          { value: 'none', label: 'Không lặp' },
          { value: 'yearly', label: 'Hàng năm' },
          { value: 'monthly', label: 'Hàng tháng' },
          { value: 'weekly', label: 'Hàng tuần' },
          { value: 'custom', label: 'Tùy chỉnh' },
        ].map((p) => (
          <label
            key={p.value}
            className="flex items-center gap-1.5 cursor-pointer px-3 py-1.5 border border-slate-300 rounded-lg has-[:checked]:bg-[#003973] has-[:checked]:text-white has-[:checked]:border-[#003973]"
          >
            <input
              type="radio"
              className="sr-only"
              checked={preset === p.value}
              onChange={() => onPresetChange(p.value as RecurrencePreset)}
              data-testid={`recurrence-preset-${p.value}`}
            />
            {p.label}
          </label>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div>
            <label className="block text-xs text-slate-600 mb-1.5">Thứ trong tuần</label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((w) => (
                <label
                  key={w.value}
                  className="cursor-pointer px-3 py-1 border border-slate-300 rounded-lg text-sm has-[:checked]:bg-[#003973] has-[:checked]:text-white has-[:checked]:border-[#003973]"
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={customByDays.includes(w.value)}
                    onChange={() => toggleDay(w.value)}
                    data-testid={`recurrence-day-${w.value}`}
                  />
                  {w.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1.5">Lặp lại mỗi (tuần)</label>
            <input
              type="number"
              min={1}
              max={52}
              value={customInterval}
              onChange={(e) => onCustomIntervalChange(Math.max(1, Number(e.target.value)))}
              className="w-24 px-2 py-1 border border-slate-300 rounded text-sm"
              data-testid="recurrence-interval"
            />
          </div>
        </div>
      )}

      {preset !== 'none' && (
        <div className="space-y-1">
          <label className="block text-xs text-slate-600">Kết thúc lặp (tùy chọn)</label>
          <input
            type="date"
            value={recurrenceEndDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded text-sm"
            data-testid="recurrence-end-date"
          />
          {previewText && (
            <p className="text-xs text-slate-500 italic">{previewText}</p>
          )}
        </div>
      )}
    </div>
  );
}
