/**
 * The small inline form a row action opens: skip and extend ask for a reason, reopen takes an optional one, "Chỉnh hạn"
 * asks for a date. The typed text lives in the tab (it must stay on screen after a refused or conflicting write).
 */
import { formatVNDate } from '@/lib/dates';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { FIELD_BOX, FIELD_LABEL, SMALL_PRIMARY, SMALL_SECONDARY } from './styles';
import type { RecordStepDto } from './types';

const P = L.recordTabs.panels;

export type PanelType = 'skip' | 'reopen' | 'extend' | 'adjust';

export interface PanelState {
  type: PanelType;
  stepKey: string;
  reason: string;
  date: string;
}

interface Props {
  panel: PanelState;
  step: RecordStepDto;
  /** 1-based position of the step. */
  position: number;
  locked: boolean;
  onChange: (next: PanelState) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function StepPanel({ panel, step, position, locked, onChange, onSubmit, onClose }: Props) {
  const regulatory = formatVNDate(step.regulatoryDueAt);
  const spec = P[panel.type];
  const title = spec.title(position, step.name);
  const hint =
    panel.type === 'extend'
      ? P.extend.hint(step.extensionsUsed, step.extensionsAllowed, regulatory)
      : panel.type === 'adjust'
        ? P.adjust.hint(regulatory)
        : panel.type === 'skip'
          ? P.skip.hint
          : P.reopen.hint;
  const reasonLabel = panel.type === 'extend' ? P.extend.reason : panel.type === 'adjust' ? P.adjust.reason : panel.type === 'skip' ? P.skip.reason : P.reopen.reason;
  const placeholder = panel.type === 'extend' ? P.extend.placeholder : panel.type === 'adjust' ? P.adjust.placeholder : panel.type === 'skip' ? P.skip.placeholder : P.reopen.placeholder;

  return (
    <section data-testid={`step-panel-${panel.type}`} className="flex flex-col gap-2 rounded-lg border border-blue-300 bg-slate-50 p-3">
      <b className="text-sm text-slate-800">{title}</b>
      <span className="text-sm text-slate-600">{hint}</span>
      <div className="flex flex-wrap items-end gap-3">
        {panel.type === 'adjust' && (
          <label className={FIELD_LABEL}>
            {P.adjust.date}
            <input
              type="date"
              data-testid="step-panel-date"
              className={`${FIELD_BOX} w-44`}
              value={panel.date}
              disabled={locked}
              onChange={(e) => onChange({ ...panel, date: e.target.value })}
            />
          </label>
        )}
        <label className={`${FIELD_LABEL} min-w-[200px] flex-1`}>
          {reasonLabel}
          <input
            type="text"
            data-testid="step-panel-reason"
            className={FIELD_BOX}
            value={panel.reason}
            placeholder={placeholder}
            disabled={locked}
            onChange={(e) => onChange({ ...panel, reason: e.target.value })}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="button" data-testid="step-panel-submit" className={SMALL_PRIMARY} disabled={locked} onClick={onSubmit}>
          {spec.submit}
        </button>
        <button type="button" data-testid="step-panel-close" className={SMALL_SECONDARY} onClick={onClose}>
          {L.recordTabs.actions.close}
        </button>
      </div>
    </section>
  );
}
