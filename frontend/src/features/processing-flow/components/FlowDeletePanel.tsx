/**
 * In-page confirmation for deleting a flow: the person types the flow's NAME back (the server asks `confirmName` and
 * `expectedRevision`). A flow with records answers FLOW_IN_USE: then the way forward offered is "Lưu trữ" (hide, keep
 * the data, restorable), never a dead end.
 */
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BTN_DANGER, BTN_SECONDARY } from '@/constants/styles';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { processingFlowApi } from '../api';
import { CODE } from '../codes';
import { explainError } from '../errors';
import type { FlowSummaryDto } from '../types';

export type FlowDeleteOutcome = 'deleted' | 'archived';

interface Props {
  flow: Pick<FlowSummaryDto, 'id' | 'name' | 'revision' | 'publishedVersionNo'>;
  /** Another write is going on elsewhere on the screen. */
  busy?: boolean;
  /** Whether the person may archive (`edit:ProcessingFlow`): without it the in-use answer has no way forward to offer. */
  canArchive: boolean;
  onClose: () => void;
  onDone: (outcome: FlowDeleteOutcome) => void;
  /** The server said somebody else changed the flow: the screen reloads its list. */
  onConflict?: () => void;
}

export function FlowDeletePanel({ flow, busy = false, canArchive, onClose, onDone, onConflict }: Props) {
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  const [inUse, setInUse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = busy || working;

  async function run(job: () => Promise<unknown>, outcome: FlowDeleteOutcome) {
    setWorking(true);
    setError(null);
    try {
      await job();
      onDone(outcome);
    } catch (err) {
      const e = explainError(err);
      if (e.code === CODE.FLOW_IN_USE) setInUse(true);
      else {
        setError(e.message);
        if (e.conflict) onConflict?.();
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <section data-testid="flow-delete-panel" className="mx-4 mt-3 rounded-lg border border-red-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-red-800">{L.deleteFlow.title(flow.name)}</h2>

      {inUse ? (
        <div data-testid="flow-delete-in-use" className="mt-2 flex gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">{L.deleteFlow.inUseTitle}</p>
            <p>{L.deleteFlow.inUseHint}</p>
          </div>
        </div>
      ) : (
        <>
          {flow.publishedVersionNo !== null && <p className="mt-1 text-sm text-slate-600">{L.deleteFlow.publishedHint}</p>}
          <label className="mt-2 block text-sm text-slate-700">
            {L.deleteFlow.typeName(flow.name)}
            <input
              type="text"
              data-testid="flow-delete-name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={L.deleteFlow.placeholder}
              autoComplete="off"
              disabled={disabled}
              className="mt-1 block w-full max-w-md rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </>
      )}

      {error && (
        <p data-testid="flow-delete-error" role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" data-testid="flow-delete-cancel" className={BTN_SECONDARY} onClick={onClose} disabled={working}>
          {L.common.cancel}
        </button>
        {canArchive && (
          <button
            type="button"
            data-testid="flow-delete-archive-instead"
            className={BTN_SECONDARY}
            disabled={disabled}
            onClick={() => void run(() => processingFlowApi.archive(flow.id, flow.revision), 'archived')}
          >
            {L.deleteFlow.archiveInstead}
          </button>
        )}
        {!inUse && (
          <button
            type="button"
            data-testid="flow-delete-confirm"
            className={BTN_DANGER}
            disabled={disabled || typed !== flow.name}
            onClick={() => void run(() => processingFlowApi.remove(flow.id, flow.revision, typed), 'deleted')}
          >
            {L.deleteFlow.confirm}
          </button>
        )}
      </div>
    </section>
  );
}
