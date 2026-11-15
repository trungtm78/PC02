/** Rename a flow, describe it, make it the default of its record kind. Saved with the revision of the flow. */
import { useState } from 'react';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/constants/styles';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import type { FlowDetailDto } from '../types';

const M = L.editor.meta;

interface Props {
  flow: Pick<FlowDetailDto, 'name' | 'description' | 'isDefault'>;
  busy: boolean;
  onSave: (values: { name: string; description: string | null; isDefault: boolean }) => void;
  onClose: () => void;
}

export function FlowMetaPanel({ flow, busy, onSave, onClose }: Props) {
  const [name, setName] = useState(flow.name);
  const [description, setDescription] = useState(flow.description ?? '');
  const [isDefault, setIsDefault] = useState(flow.isDefault);

  return (
    <form
      data-testid="editor-meta-panel"
      className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave({ name: name.trim(), description: description.trim() === '' ? null : description.trim(), isDefault });
      }}
    >
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        {M.name}
        <input data-testid="meta-name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} className="rounded border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        {M.description}
        <textarea data-testid="meta-description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} rows={2} className="rounded border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" data-testid="meta-default" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} disabled={busy} className="mt-1" />
        {M.isDefault}
      </label>
      <div className="flex gap-2">
        <button type="submit" data-testid="meta-save" className={BTN_PRIMARY} disabled={busy || name.trim() === ''}>
          {M.save}
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={onClose} disabled={busy}>
          {L.common.cancel}
        </button>
      </div>
    </form>
  );
}
