import type { ReactNode } from 'react';

/**
 * A KPI tile.
 *
 * Exists because three report pages each built one inline with
 * `` className={`text-${stat.color}-600`} ``. Tailwind's JIT compiler scans
 * source files for complete class names; a string assembled at runtime is
 * never in that scan, so those classes were absent from the production
 * stylesheet and every tile rendered colourless. It looked fine in dev only
 * because the dev build is less aggressive.
 *
 * The map below is the fix: every class appears in the source verbatim.
 */
export type StatTone = 'blue' | 'purple' | 'red' | 'green' | 'amber' | 'slate';

const TONE_VALUE: Record<StatTone, string> = {
  blue: 'text-blue-600',
  purple: 'text-purple-600',
  red: 'text-red-600',
  green: 'text-green-600',
  amber: 'text-amber-600',
  slate: 'text-slate-600',
};

const TONE_BADGE: Record<StatTone, string> = {
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  red: 'bg-red-100 text-red-700',
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  slate: 'bg-slate-100 text-slate-700',
};

export interface StatCardProps {
  label: string;
  value: ReactNode;
  tone?: StatTone;
  /**
   * Change versus the previous period, e.g. `"+12%"`.
   *
   * Optional and rendered only when supplied. The pages used to hardcode
   * these — "+12%" sat next to a real total on every month, for every user,
   * forever. A number that never moves is worse than no number: it reads as
   * measurement.
   */
  change?: string | null;
  icon?: ReactNode;
  testId?: string;
}

export function StatCard({
  label,
  value,
  tone = 'blue',
  change,
  icon,
  testId,
}: StatCardProps) {
  return (
    <div
      data-testid={testId}
      className="rounded-lg border border-slate-200 bg-white p-6"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-slate-600">{label}</span>
        {change ? (
          <span
            className={`rounded px-2 py-1 text-xs font-medium ${TONE_BADGE[tone]}`}
          >
            {change}
          </span>
        ) : (
          icon
        )}
      </div>
      <div className={`text-3xl font-bold ${TONE_VALUE[tone]}`}>{value}</div>
    </div>
  );
}
