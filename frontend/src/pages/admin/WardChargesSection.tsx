import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MapPin } from 'lucide-react';
import { MultiFKSelect, type MultiFKOption } from '@/components/MultiFKSelect';
import { extractApiError } from '@/lib/api-errors';
import { teams as L } from '@/locales/vi';
import { conflictsOf, wardChargesApi, type WardChargeConflict } from './ward-charges.api';

const W = L.wardCharges;

/**
 * "Phường/xã phụ trách" of a PC02 team (wardId = null), inside its edit form. Saved with its own button, as its own
 * request: the team's other fields are not touched. A ward is removed by removing its chip and saving.
 */
export function WardChargesSection({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient();
  /** What the person changed; null = what the server holds. */
  const [edited, setEdited] = useState<string[] | null>(null);
  const [conflicts, setConflicts] = useState<WardChargeConflict[]>([]);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const choices = useQuery({ queryKey: ['teams', 'ward-charge-choices'], queryFn: wardChargesApi.choices });
  const current = useQuery({ queryKey: ['teams', teamId, 'ward-charges'], queryFn: () => wardChargesApi.list(teamId) });

  const values = edited ?? (current.data ?? []).map((c) => c.wardId);

  /** One option per WARD (two ward teams of one ward are one choice); held by another team = taken. */
  const options: MultiFKOption[] = useMemo(() => {
    const byWard = new Map<string, MultiFKOption>();
    for (const c of Array.isArray(choices.data) ? choices.data : []) {
      const heldElsewhere = c.managerTeam && c.managerTeam.id !== teamId ? c.managerTeam : null;
      const known = byWard.get(c.wardId);
      if (known) {
        known.label = `${known.label} / ${c.name}`;
        continue;
      }
      byWard.set(c.wardId, {
        value: c.wardId,
        label: c.name,
        hint: heldElsewhere ? W.heldBy(heldElsewhere.name) : undefined,
        taken: !!heldElsewhere,
      });
    }
    return [...byWard.values()];
  }, [choices.data, teamId]);

  const selectedLabels = useMemo(
    () => Object.fromEntries((current.data ?? []).map((c) => [c.wardId, c.wardTeamName ?? c.wardName])),
    [current.data],
  );

  const save = useMutation({
    mutationFn: () => wardChargesApi.replace(teamId, values),
    onSuccess: (saved) => {
      setConflicts([]);
      setEdited(null);
      queryClient.setQueryData(['teams', teamId, 'ward-charges'], saved);
      setMessage({ kind: 'ok', text: W.saved(saved.length) });
      void queryClient.invalidateQueries({ queryKey: ['teams', 'admin'] });
      void queryClient.invalidateQueries({ queryKey: ['teams', 'ward-charge-choices'] });
    },
    onError: (err) => {
      const { code } = extractApiError(err, W.saveFailed);
      if (code === 'TEAM_WARD_ALREADY_CHARGED') {
        setConflicts(conflictsOf(err));
        setMessage(null);
        void queryClient.invalidateQueries({ queryKey: ['teams', 'ward-charge-choices'] });
        return;
      }
      setConflicts([]);
      setMessage({ kind: 'error', text: (code && W.errors[code]) || W.saveFailed });
    },
  });

  const loadFailed = choices.isError || current.isError;

  return (
    <section className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3" data-testid="ward-charges-section">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <MapPin className="w-4 h-4 text-primary" />
        {W.title}
      </h3>
      <p className="mt-1 mb-2 text-xs text-slate-500">{W.hint}</p>
      {loadFailed && (
        <p role="alert" className="mb-2 text-sm text-red-700" data-testid="ward-charges-load-error">
          {W.loadFailed}
        </p>
      )}
      <MultiFKSelect
        label={W.pick}
        values={values}
        onChange={(next) => {
          setEdited(next);
          setMessage(null);
        }}
        options={options}
        selectedLabels={selectedLabels}
        // Locked while a save is on its way: the answer replaces the choice, so nothing may be picked meanwhile.
        disabled={save.isPending}
        loading={choices.isLoading || current.isLoading}
        testId="ward-charges"
      />

      {conflicts.length > 0 && (
        <div role="alert" data-testid="ward-charges-conflicts" className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-semibold">{W.conflictTitle}</p>
          <ul className="mt-1 list-disc pl-5">
            {conflicts.map((c) => (
              <li key={c.wardId} data-testid={`ward-charges-conflict-${c.wardId}`}>
                {W.conflict(c.wardName, c.teamName)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          data-testid={message.kind === 'error' ? 'ward-charges-error' : 'ward-charges-saved'}
          className={`mt-2 text-sm ${message.kind === 'error' ? 'text-red-700' : 'text-green-700'}`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          data-testid="ward-charges-save"
          onClick={() => save.mutate()}
          disabled={save.isPending || current.isLoading || loadFailed}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {save.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {save.isPending ? W.saving : W.save}
        </button>
      </div>
    </section>
  );
}
