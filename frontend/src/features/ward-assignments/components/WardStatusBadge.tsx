import { wardAssignments as L } from '@/locales/wardAssignments.vi';
import type { WardDisplayStatus } from '../formModel';

const STYLE: Record<WardDisplayStatus, string> = {
  DRAFT: 'border-slate-300 bg-slate-100 text-slate-700',
  SUBMITTED: 'border-blue-200 bg-blue-50 text-blue-800',
  RESUBMITTED: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  RETURNED: 'border-amber-200 bg-amber-50 text-amber-800',
  APPROVED: 'border-green-200 bg-green-50 text-green-800',
  ARCHIVED: 'border-slate-300 bg-white text-slate-500',
};

export function wardStatusLabel(status: WardDisplayStatus): string {
  if (status === 'RESUBMITTED') return L.resubmitted;
  if (status === 'ARCHIVED') return L.archived;
  return L.status[status];
}

export function WardStatusBadge({ status, testId }: { status: WardDisplayStatus; testId?: string }) {
  return (
    <span data-testid={testId} className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${STYLE[status]}`}>
      {wardStatusLabel(status)}
    </span>
  );
}
