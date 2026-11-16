/**
 * "Danh bạ Điều tra viên của đơn vị": the investigators a ward unit may propose (not necessarily people with an
 * account). Add, edit, stop (no longer offered) and resume; nothing is deleted, a request may name them.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/shared/Modal';
import { BTN_PRIMARY, BTN_SECONDARY, FIELD_ERROR_TEXT } from '@/constants/styles';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';
import { wardInvestigatorsApi, WARD_QUERY_KEYS, type WardInvestigatorInput } from '../api';
import { explainWardError } from '../errors';
import type { WardInvestigator } from '../types';

const T = L.investigators;
const CELL_INPUT = 'w-full rounded border border-slate-300 px-2 py-1.5 text-sm';
const FIELDS = ['fullName', 'rank', 'position', 'grade'] as const;
type Draft = Record<(typeof FIELDS)[number], string>;
const EMPTY: Draft = { fullName: '', rank: '', position: '', grade: '' };

const toInput = (d: Draft): WardInvestigatorInput => ({
  fullName: d.fullName.trim(),
  rank: d.rank.trim() || null,
  position: d.position.trim() || null,
  grade: d.grade.trim() || null,
});

function DraftInputs({ draft, onChange, prefix }: { draft: Draft; onChange: (d: Draft) => void; prefix: string }) {
  return (
    <>
      {FIELDS.map((f) => (
        <td key={f} className="px-2 py-1">
          <input data-testid={`${prefix}-${f}`} aria-label={T[f]} className={CELL_INPUT} value={draft[f]} onChange={(e) => onChange({ ...draft, [f]: e.target.value })} />
        </td>
      ))}
    </>
  );
}

export interface InvestigatorDirectoryDialogProps {
  open: boolean;
  teamId: string;
  onClose: () => void;
  /** A new investigator was added: the form chooses them. */
  onCreated?: (investigator: WardInvestigator) => void;
}

export function InvestigatorDirectoryDialog({ open, teamId, onClose, onCreated }: InvestigatorDirectoryDialogProps) {
  const qc = useQueryClient();
  const [showStopped, setShowStopped] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: WARD_QUERY_KEYS.investigators(teamId, showStopped),
    queryFn: () => wardInvestigatorsApi.list(teamId, showStopped),
    enabled: open && !!teamId,
    retry: false,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['ward-investigators', teamId] });
  const fail = (e: unknown) => setError(explainWardError(e).message);

  const create = useMutation({
    mutationFn: () => wardInvestigatorsApi.create(teamId, toInput(draft)),
    onSuccess: (created) => {
      setDraft(EMPTY);
      setError(null);
      void refresh();
      onCreated?.(created);
    },
    onError: fail,
  });
  const update = useMutation({
    mutationFn: (v: { inv: WardInvestigator; draft: Draft }) => wardInvestigatorsApi.update(v.inv.id, toInput(v.draft), v.inv.updatedAt),
    onSuccess: () => {
      setEditing(null);
      setError(null);
      void refresh();
    },
    onError: fail,
  });
  const toggle = useMutation({
    mutationFn: (inv: WardInvestigator) => (inv.isActive ? wardInvestigatorsApi.deactivate(inv.id, inv.updatedAt) : wardInvestigatorsApi.reactivate(inv.id, inv.updatedAt)),
    onSuccess: () => {
      setError(null);
      void refresh();
    },
    onError: fail,
  });

  const rows = listQ.data ?? [];
  return (
    <Modal open={open} onClose={onClose} title={T.title} maxWidth="max-w-5xl" footer={<div className="flex justify-end"><button type="button" className={BTN_SECONDARY} onClick={onClose}>{T.close}</button></div>}>
      <div data-testid="ward-inv-directory" className="space-y-3">
        {!teamId ? (
          <p className="text-sm text-slate-500">{T.pickUnitFirst}</p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" data-testid="ward-inv-show-stopped" checked={showStopped} onChange={(e) => setShowStopped(e.target.checked)} />
              {T.showStopped}
            </label>
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-600">
                  <th className="px-2 py-1">{T.fullName}</th>
                  <th className="px-2 py-1">{T.rank}</th>
                  <th className="px-2 py-1">{T.position}</th>
                  <th className="px-2 py-1">{T.grade}</th>
                  <th className="w-28 px-2 py-1">{T.status}</th>
                  <th className="w-44 px-2 py-1"><span className="sr-only">{T.edit}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !listQ.isLoading && (
                  <tr>
                    <td colSpan={6} className="px-2 py-2 text-slate-500">{T.empty}</td>
                  </tr>
                )}
                {rows.map((inv) =>
                  editing?.id === inv.id ? (
                    <tr key={inv.id} data-testid={`ward-inv-${inv.id}`}>
                      <DraftInputs prefix="ward-inv-edit" draft={editing.draft} onChange={(d) => setEditing({ id: inv.id, draft: d })} />
                      <td className="px-2 py-1">{inv.isActive ? T.active : T.stopped}</td>
                      <td className="space-x-2 px-2 py-1">
                        <button type="button" data-testid="ward-inv-edit-save" className="text-blue-700 hover:underline" disabled={update.isPending} onClick={() => update.mutate({ inv, draft: editing.draft })}>
                          {T.save}
                        </button>
                        <button type="button" className="text-slate-600 hover:underline" onClick={() => setEditing(null)}>
                          {T.cancel}
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={inv.id} data-testid={`ward-inv-${inv.id}`} className={inv.isActive ? '' : 'text-slate-500'}>
                      <td className="px-2 py-1">{inv.fullName}</td>
                      <td className="px-2 py-1">{inv.rank}</td>
                      <td className="px-2 py-1">{inv.position}</td>
                      <td className="px-2 py-1">{inv.grade}</td>
                      <td className="px-2 py-1">{inv.isActive ? T.active : T.stopped}</td>
                      <td className="space-x-3 px-2 py-1">
                        <button
                          type="button"
                          className="text-blue-700 hover:underline"
                          onClick={() => setEditing({ id: inv.id, draft: { fullName: inv.fullName, rank: inv.rank ?? '', position: inv.position ?? '', grade: inv.grade ?? '' } })}
                        >
                          {T.edit}
                        </button>
                        <button type="button" className="text-blue-700 hover:underline" disabled={toggle.isPending} onClick={() => toggle.mutate(inv)}>
                          {inv.isActive ? T.stop : T.resume}
                        </button>
                      </td>
                    </tr>
                  ),
                )}
                <tr data-testid="ward-inv-new" className="border-t border-slate-200">
                  <DraftInputs prefix="ward-inv-new" draft={draft} onChange={setDraft} />
                  <td className="px-2 py-1" />
                  <td className="px-2 py-1">
                    <button type="button" data-testid="ward-inv-new-save" className={`${BTN_PRIMARY} py-1.5 text-sm`} disabled={create.isPending || draft.fullName.trim() === ''} onClick={() => create.mutate()}>
                      {T.add}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}
        {error && (
          <p role="alert" className={FIELD_ERROR_TEXT}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
