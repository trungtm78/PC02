import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { permissions as L } from '@/locales/permissions.vi';
import { authzKeys, permissionsApi } from '../api';
import { explainError, type ExplainedError } from '../errors';
import { permissionLabel, type CatalogueIndex } from '../labels';
import { diffCount, diffEntries, newlySensitive } from '../matrix';
import { TEMPLATE_STATUS, type CatalogueResource, type Entries, type PreviewResult, type TemplateSummary } from '../types';
import { TemplateMatrix } from './TemplateMatrix';
import { BTN, BTN_PRIMARY, CARD, ErrorBox, INPUT, PreviewBox } from './ui';

interface Props {
  resources: readonly CatalogueResource[];
  index: CatalogueIndex;
  /** Null = a new template. */
  template: TemplateSummary | null;
  canWrite: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  /** Somebody else changed the template: load the list again (the editor closes). */
  onReload: () => void;
}

const E = L.editor;

/** A template's name and its matrix. Saving sends the whole document, with the revision it was read at. */
export function TemplateEditor({ resources, index, template, canWrite, onClose, onSaved, onReload }: Props) {
  const queryClient = useQueryClient();
  const initial: Entries = useMemo(() => template?.entries ?? {}, [template]);
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [entries, setEntries] = useState<Entries>(initial);
  const [advanced, setAdvanced] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<ExplainedError | null>(null);
  const [localError, setLocalError] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const changes = diffCount(diffEntries(initial, entries));
  const sensitive = newlySensitive(resources, initial, entries);
  const dirty = changes > 0 || name !== (template?.name ?? '') || description !== (template?.description ?? '');

  const change = (next: Entries) => {
    setEntries(next);
    setPreview(null);
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        entries,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      };
      return template
        ? permissionsApi.updateTemplate(template.id, { ...body, expectedRevision: template.revision })
        : permissionsApi.createTemplate(body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authzKeys.all });
      onSaved(template ? L.templates.done.updated : L.templates.done.created);
    },
    onError: (err) => setError(explainError(err, index)),
  });

  const runPreview = useMutation({
    mutationFn: () => permissionsApi.preview({ templates: [{ id: (template as TemplateSummary).id, entries }] }),
    onSuccess: (result) => {
      setError(null);
      setPreview(result);
    },
    onError: (err) => setError(explainError(err, index)),
  });

  const submit = () => {
    setError(null);
    if (!name.trim()) return setLocalError(E.nameRequired);
    if (sensitive.length > 0 && !reason.trim()) return setLocalError(L.common.reasonMissing);
    setLocalError('');
    save.mutate();
  };

  return (
    <div className={`${CARD} p-4`} data-testid="template-editor">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-bold text-slate-700">{template ? E.titleEdit(template.name) : E.titleNew}</h2>
        {dirty && (
          <span data-testid="template-unsaved" className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {L.common.unsaved}
          </span>
        )}
        {template?.status === TEMPLATE_STATUS.ARCHIVED && <span className="text-xs text-slate-500">{E.archivedNote}</span>}
      </div>
      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-slate-600">
          {E.name}
          <input
            data-testid="template-name"
            className={`${INPUT} mt-1 block w-full`}
            value={name}
            maxLength={120}
            placeholder={E.namePlaceholder}
            disabled={!canWrite}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          {E.description}
          <input
            data-testid="template-description"
            className={`${INPUT} mt-1 block w-full`}
            value={description}
            maxLength={1000}
            disabled={!canWrite}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </div>

      <TemplateMatrix resources={resources} entries={entries} onChange={change} advanced={advanced} readOnly={!canWrite} />
      {advanced && <p className="mt-1 text-xs text-slate-500">{L.teamOnlyHint}</p>}

      <p className="mt-3 text-sm text-slate-600" data-testid="template-changes">
        {changes > 0 ? E.changes(changes) : L.common.noChange}
      </p>
      {sensitive.length > 0 && (
        <p className="mt-1 text-sm text-amber-800" data-testid="template-sensitive-note">
          {E.sensitiveNote(sensitive.map((key) => permissionLabel(index, key)).join('; '))}
        </p>
      )}
      {canWrite && (
        <label className="mt-2 block text-xs font-medium text-slate-600">
          {sensitive.length > 0 ? L.common.reasonRequired : L.common.reason}
          <input
            data-testid="template-reason"
            className={`${INPUT} mt-1 block w-full max-w-xl`}
            value={reason}
            maxLength={500}
            placeholder={L.common.reasonPlaceholder}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      )}
      {localError && (
        <p role="alert" data-testid="template-local-error" className="mt-2 text-sm text-red-700">
          {localError}
        </p>
      )}
      <div className="mt-2 space-y-2">
        <ErrorBox error={error} onReload={onReload} testId="template-error" />
        <PreviewBox result={preview} index={index} testId="template-preview" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" data-testid="template-advanced" className={BTN} onClick={() => setAdvanced((v) => !v)}>
          {advanced ? L.common.advancedHide : L.common.advancedShow}
        </button>
        {template && (
          <button
            type="button"
            data-testid="template-preview-btn"
            className={BTN}
            disabled={changes === 0 || runPreview.isPending}
            onClick={() => runPreview.mutate()}
          >
            {runPreview.isPending ? L.teams.previewing : E.preview}
          </button>
        )}
        {canWrite && (
          <button type="button" data-testid="template-save" className={BTN_PRIMARY} disabled={save.isPending || (!!template && !dirty)} onClick={submit}>
            {save.isPending ? L.common.saving : L.common.save}
          </button>
        )}
        <button type="button" data-testid="template-cancel" className={BTN} onClick={onClose}>
          {canWrite ? L.common.cancel : L.common.close}
        </button>
      </div>
    </div>
  );
}
