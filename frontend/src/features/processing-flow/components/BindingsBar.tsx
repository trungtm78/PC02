/**
 * "Áp cho": the information types (and, for a petition, the deadline groups) a flow is applied to. Each change is its
 * own write of ALL the bindings with the revision of the flow; the server answers TYPE_ALREADY_BOUND when another flow
 * of the same record kind already holds one of them.
 */
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { DEADLINE_GROUPS } from '../codes';
import type { FlowDetailDto } from '../types';

const B = L.editor.bindings;

interface Props {
  flow: Pick<FlowDetailDto, 'recordKind' | 'boundTypes' | 'boundGroups'>;
  /** The catalogue of information types: value = directory id. */
  catalogue: Array<{ value: string; label: string }>;
  editable: boolean;
  busy: boolean;
  onSave: (directoryIds: string[], deadlineGroups: string[]) => void;
  /** The sentence of the last refusal, with the flows that hold the types. */
  error: string | null;
}

export function BindingsBar({ flow, catalogue, editable, busy, onSave, error }: Props) {
  const boundIds = flow.boundTypes.map((t) => t.directoryId);
  const offered = catalogue.filter((c) => !boundIds.includes(c.value));
  const groupsOffered = DEADLINE_GROUPS.filter((g) => !flow.boundGroups.includes(g));

  return (
    <div data-testid="editor-bindings" className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-xs text-slate-600">{B.label}</b>
        {flow.boundTypes.length === 0 && flow.boundGroups.length === 0 && (
          <span data-testid="binding-none" className="text-xs font-medium text-red-700">
            {B.none}
          </span>
        )}
        {flow.boundTypes.map((t) => (
          <span key={t.directoryId} data-testid={`binding-chip-${t.directoryId}`} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[12.5px] font-medium text-slate-800">
            {t.name}
            {!t.isActive && <span className="text-[11px] text-slate-500">({B.inactive})</span>}
            {t.renamed && (
              <span data-testid={`binding-renamed-${t.directoryId}`} title={B.renamed} className="cursor-help rounded bg-amber-100 px-1 text-[10.5px] font-semibold text-amber-800">
                ≠
              </span>
            )}
            {editable && (
              <button
                type="button"
                data-testid={`binding-remove-${t.directoryId}`}
                aria-label={B.remove(t.name)}
                disabled={busy}
                className="px-0.5 font-bold text-slate-500 hover:text-red-700 disabled:opacity-40"
                onClick={() =>
                  onSave(
                    boundIds.filter((id) => id !== t.directoryId),
                    flow.boundGroups,
                  )
                }
              >
                ×
              </button>
            )}
          </span>
        ))}
        {flow.boundGroups.map((g) => (
          <span key={g} data-testid={`binding-chip-group-${g}`} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-0.5 text-[12.5px] font-medium text-slate-800">
            {L.deadlineGroups[g] ?? g}
            {editable && (
              <button
                type="button"
                data-testid={`binding-remove-group-${g}`}
                aria-label={B.remove(L.deadlineGroups[g] ?? g)}
                disabled={busy}
                className="px-0.5 font-bold text-slate-500 hover:text-red-700 disabled:opacity-40"
                onClick={() =>
                  onSave(
                    boundIds,
                    flow.boundGroups.filter((x) => x !== g),
                  )
                }
              >
                ×
              </button>
            )}
          </span>
        ))}
        {editable && offered.length > 0 && (
          <select
            data-testid="binding-add-type"
            aria-label={B.add}
            value=""
            disabled={busy}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            onChange={(e) => {
              if (e.target.value) onSave([...boundIds, e.target.value], flow.boundGroups);
            }}
          >
            <option value="">{B.add}</option>
            {offered.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}
        {editable && flow.recordKind === 'PETITION' && groupsOffered.length > 0 && (
          <select
            data-testid="binding-add-group"
            aria-label={B.addGroup}
            value=""
            disabled={busy}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            onChange={(e) => {
              if (e.target.value) onSave(boundIds, [...flow.boundGroups, e.target.value]);
            }}
          >
            <option value="">{B.addGroup}</option>
            {groupsOffered.map((g) => (
              <option key={g} value={g}>
                {L.deadlineGroups[g]}
              </option>
            ))}
          </select>
        )}
      </div>
      {error && (
        <p data-testid="binding-error" role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
