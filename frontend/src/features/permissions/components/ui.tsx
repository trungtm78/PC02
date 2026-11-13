import { permissions as L } from '@/locales/permissions.vi';
import type { ExplainedError } from '../errors';
import { deltaText, type CatalogueIndex, type DeltaKind } from '../labels';
import type { PermissionDelta, PreviewResult } from '../types';

export const BTN = 'px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50';
export const BTN_PRIMARY = 'px-3 py-1.5 text-sm bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50';
export const BTN_DANGER = 'px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50';
export const BTN_SMALL = 'px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50';
export const INPUT = 'px-3 py-1.5 border border-slate-300 rounded-md text-sm disabled:bg-slate-50';
export const CARD = 'bg-white border border-slate-200 rounded-lg shadow-sm';

/** A refused request in words: the headline, the reasons under it, and "load again" when somebody else got there first. */
export function ErrorBox({ error, onReload, testId = 'authz-error' }: { error: ExplainedError | null; onReload?: () => void; testId?: string }) {
  if (!error) return null;
  return (
    <div role="alert" data-testid={testId} className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <p>{error.message}</p>
      {error.reasons.length > 0 && (
        <ul className="mt-1 list-disc pl-5" data-testid={`${testId}-reasons`}>
          {error.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {error.conflict && onReload && (
        <button type="button" data-testid={`${testId}-reload`} onClick={onReload} className="mt-2 rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium hover:bg-red-100">
          {L.common.reload}
        </button>
      )}
    </div>
  );
}

export function Notice({ text, testId }: { text: string; testId: string }) {
  if (!text) return null;
  return (
    <div role="status" data-testid={testId} className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
      {text}
    </div>
  );
}

const KINDS: { kind: DeltaKind; label: string }[] = [
  { kind: 'gained', label: L.preview.gained },
  { kind: 'lost', label: L.preview.lost },
  { kind: 'changed', label: L.preview.changed },
];

/** Who a change would touch, and what each of them gains, loses or keeps at another reach. Nothing has been saved. */
export function PreviewBox({ result, index, testId = 'authz-preview' }: { result: PreviewResult | null; index: CatalogueIndex; testId?: string }) {
  if (!result) return null;
  const names = result.teamNames ?? {};
  return (
    <div data-testid={testId} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-slate-800">
      <p className="font-semibold" data-testid={`${testId}-count`}>
        {result.impacts.length > 0 ? L.preview.affected(result.impacts.length, result.people) : L.preview.nobody(result.people)}
      </p>
      <ul className="mt-1 max-h-72 space-y-1 overflow-y-auto">
        {result.impacts.map((impact) => (
          <li key={impact.userId} data-testid={`${testId}-person-${impact.userId}`}>
            <span className="font-medium">{impact.name}</span>
            <ul className="list-disc pl-5 text-xs">
              {KINDS.flatMap(({ kind, label }) =>
                (impact[kind] as PermissionDelta[]).map((delta) => (
                  <li key={`${kind}-${delta.permission}`}>
                    {label}: {deltaText(index, kind, delta, names)}
                  </li>
                )),
              )}
            </ul>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-slate-500">{L.preview.undoNote}</p>
    </div>
  );
}
