/**
 * The opinion of a unit around a step (the head of the unit that works it, a unit that coordinates, a unit that
 * checks) and the decision of the leader on a result that waits for approval. Who may speak in which role is judged by
 * the server; the form only offers the roles the step's own units hold.
 */
import { useState } from 'react';
import { useDraft } from './draftStore';
import { errorText, processingFlow as L } from '@/locales/processingFlow.vi';
import { FIELD_BOX, FIELD_LABEL, SMALL_DANGER, SMALL_PRIMARY, SMALL_SECONDARY } from './styles';
import type { DecisionVerdict, SpeakingKind } from './types';

const O = L.recordTabs.results;

interface OpinionFormProps {
  kinds: SpeakingKind[];
  locked: boolean;
  /** Where the typed text is kept while it is not sent (see draftStore). */
  draftKey: string;
  onSubmit: (body: { kind: SpeakingKind; verdict?: string; content?: string }) => Promise<boolean>;
}

interface OpinionDraft {
  open: boolean;
  kind: SpeakingKind | null;
  verdict: string;
  content: string;
}

const EMPTY_OPINION: OpinionDraft = { open: false, kind: null, verdict: 'NOTE', content: '' };

export function OpinionForm({ kinds, locked, draftKey, onSubmit }: OpinionFormProps) {
  const [draft, setDraft, clearDraft] = useDraft<OpinionDraft>(draftKey, () => EMPTY_OPINION);
  const [error, setError] = useState<string | null>(null);
  const { open, verdict, content } = draft;
  const kind: SpeakingKind = draft.kind ?? kinds[0] ?? 'SUPERVISOR';
  const setOpen = (value: boolean) => setDraft((prev) => ({ ...prev, open: value }));
  const setKind = (value: SpeakingKind) => setDraft((prev) => ({ ...prev, kind: value }));
  const setVerdict = (value: string) => setDraft((prev) => ({ ...prev, verdict: value }));
  const setContent = (value: string) => setDraft((prev) => ({ ...prev, content: value }));

  if (!open) {
    return (
      <div>
        <button type="button" data-testid="opinion-open" className={SMALL_SECONDARY} disabled={locked} onClick={() => setOpen(true)}>
          {O.opinionForm.open}
        </button>
      </div>
    );
  }

  const effectiveKind: SpeakingKind = kinds.includes(kind) ? kind : (kinds[0] ?? kind);
  const effectiveVerdict = effectiveKind === 'CHECK' ? verdict : 'NOTE';

  const submit = async () => {
    // A plain remark has no meaning without words; a check's verdict (pass, rework) stands on its own.
    if (effectiveVerdict === 'NOTE' && content.trim() === '') {
      setError(errorText('REPORT_TEXT_REQUIRED'));
      return;
    }
    setError(null);
    const ok = await onSubmit({
      kind: effectiveKind,
      ...(effectiveKind === 'CHECK' ? { verdict: effectiveVerdict } : {}),
      ...(content.trim() ? { content: content.trim() } : {}),
    });
    if (ok) clearDraft();
  };

  return (
    <div data-testid="opinion-form" role="group" className="flex flex-col gap-2 rounded-lg border border-blue-300 bg-slate-50 p-3">
      <h4 className="text-sm font-semibold text-slate-800">{O.opinionForm.title}</h4>
      <div className="flex flex-wrap gap-3">
        {kinds.length > 1 && (
          <label className={FIELD_LABEL}>
            {O.opinionForm.kind}
            <select data-testid="opinion-kind" className={FIELD_BOX} value={effectiveKind} disabled={locked} onChange={(e) => setKind(e.target.value as SpeakingKind)}>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {O.opinionKinds[k]}
                </option>
              ))}
            </select>
          </label>
        )}
        {effectiveKind === 'CHECK' && (
          <label className={FIELD_LABEL}>
            {O.opinionForm.verdict}
            <select data-testid="opinion-verdict" className={FIELD_BOX} value={effectiveVerdict} disabled={locked} onChange={(e) => setVerdict(e.target.value)}>
              {['NOTE', 'PASS', 'REQUEST_REWORK'].map((v) => (
                <option key={v} value={v}>
                  {O.opinionVerdicts[v]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className={FIELD_LABEL}>
        {O.opinionForm.content}
        <textarea data-testid="opinion-content" className={`${FIELD_BOX} min-h-[58px]`} value={content} placeholder={O.opinionForm.placeholder} disabled={locked} onChange={(e) => setContent(e.target.value)} />
      </label>
      {error && (
        <p data-testid="opinion-form-error" role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" data-testid="opinion-submit" onClick={() => void submit()} className={SMALL_PRIMARY} disabled={locked}>
          {O.opinionForm.submit}
        </button>
        <button type="button" className={SMALL_SECONDARY} onClick={clearDraft}>
          {L.common.cancel}
        </button>
      </div>
    </div>
  );
}

interface DecisionFormProps {
  locked: boolean;
  /** Where the typed text is kept while it is not sent (see draftStore). */
  draftKey: string;
  onSubmit: (body: { verdict: DecisionVerdict; content?: string }) => Promise<boolean>;
}

/** The leader's decision on the result that waits for approval: three buttons and one box of words. */
export function DecisionForm({ locked, draftKey, onSubmit }: DecisionFormProps) {
  const [content, setContent, clearDraft] = useDraft<string>(draftKey, () => '');
  const [error, setError] = useState<string | null>(null);

  const decide = async (verdict: DecisionVerdict) => {
    const text = content.trim();
    if (verdict !== 'AGREE' && text === '') {
      setError(errorText('REPORT_TEXT_REQUIRED'));
      return;
    }
    setError(null);
    const ok = await onSubmit({ verdict, ...(text ? { content: text } : {}) });
    if (ok) clearDraft();
  };

  return (
    <section data-testid="decision-form" className="flex flex-col gap-2 rounded-lg border border-blue-300 bg-slate-50 p-3">
      <h4 className="text-sm font-semibold text-slate-800">{O.decision.title}</h4>
      <p className="text-xs text-slate-600">{O.decision.hint}</p>
      <label className={FIELD_LABEL}>
        {O.decision.content}
        <input data-testid="decision-content" type="text" className={FIELD_BOX} value={content} placeholder={O.decision.placeholder} disabled={locked} onChange={(e) => setContent(e.target.value)} />
      </label>
      {error && (
        <p data-testid="decision-error" role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" data-testid="decision-agree" className={SMALL_PRIMARY} disabled={locked} onClick={() => void decide('AGREE')}>
          {O.opinionVerdicts.AGREE}
        </button>
        <button type="button" data-testid="decision-disagree" className={SMALL_DANGER} disabled={locked} onClick={() => void decide('DISAGREE')}>
          {O.opinionVerdicts.DISAGREE}
        </button>
        <button type="button" data-testid="decision-other" className={SMALL_SECONDARY} disabled={locked} onClick={() => void decide('OTHER_DIRECTION')}>
          {O.opinionVerdicts.OTHER_DIRECTION}
        </button>
      </div>
    </section>
  );
}
