import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { llmConfig as t } from '@/locales/vi';
import { LlmProviderKind } from '@/shared/enums/generated';
import { KeyTestReportView } from './KeyTestReportView';
import {
  llmApi,
  type KeyTestReport,
  type ProviderInput,
  type ProviderPatch,
  type ProviderView,
} from './llmApi';
import {
  DEFAULT_KIND,
  defaultLabel,
  describeError,
  isCloudKind,
  microToUsdPerMTok,
  modelWarning,
  pickDefaultModel,
  SUPPORTED_KINDS,
  usdPerMTokToMicro,
} from './llmConfig.logic';

const KIND_ORDER: readonly LlmProviderKind[] = [
  LlmProviderKind.GEMINI,
  LlmProviderKind.ANTHROPIC,
  LlmProviderKind.OPENAI,
  LlmProviderKind.SELF_HOSTED,
];

interface Props {
  provider: ProviderView | null;
  onClose: () => void;
  onSaved: () => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

/** Create or edit a provider, with the key test and the model list available BEFORE saving. */
export function ProviderFormModal({ provider, onClose, onSaved }: Props) {
  const editing = provider !== null;
  const [kind, setKind] = useState<LlmProviderKind>(provider?.kind ?? DEFAULT_KIND);
  const [label, setLabel] = useState(provider?.label ?? defaultLabel(provider?.kind ?? DEFAULT_KIND));
  /** Until the administrator types a name, the name follows the kind: it is never left to the browser's autofill. */
  const [labelTouched, setLabelTouched] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? '');
  const [model, setModel] = useState(provider?.model ?? '');
  const [dataRegion, setDataRegion] = useState(provider?.dataRegion ?? '');
  const [zeroRetention, setZeroRetention] = useState(provider?.zeroRetention ?? false);
  const [inputPrice, setInputPrice] = useState(microToUsdPerMTok(provider?.prices.inputMicroUsdPerMTok ?? null));
  const [outputPrice, setOutputPrice] = useState(microToUsdPerMTok(provider?.prices.outputMicroUsdPerMTok ?? null));
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<'models' | 'test' | 'save' | null>(null);
  const [report, setReport] = useState<KeyTestReport | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [modelsNote, setModelsNote] = useState('');

  const selfHosted = kind === LlmProviderKind.SELF_HOSTED;

  const prices = () => {
    const input = usdPerMTokToMicro(inputPrice);
    const output = usdPerMTokToMicro(outputPrice);
    return { input, output, invalid: Number.isNaN(input) || Number.isNaN(output) };
  };

  const draftInput = (): ProviderInput => {
    const p = prices();
    return {
      kind,
      label: label.trim(),
      model: model.trim(),
      apiKey: apiKey.trim(),
      baseUrl: selfHosted ? baseUrl.trim() || null : undefined,
      dataRegion: dataRegion.trim() || null,
      zeroRetention,
      inputPriceMicroUsdPerMTok: p.input,
      outputPriceMicroUsdPerMTok: p.output,
    };
  };

  const loadModels = async () => {
    setBusy('models');
    setErrors([]);
    setModelsNote('');
    try {
      const list =
        editing && !apiKey.trim()
          ? await llmApi.listModels(provider.id)
          : await llmApi.listModelsDraft({ kind, apiKey: apiKey.trim(), baseUrl: selfHosted ? baseUrl.trim() || null : undefined });
      const ids = list.map((m) => m.id);
      setModels(ids);
      setModelsNote(t.form.modelsLoaded(ids.length));
      if (!model.trim()) setModel(pickDefaultModel(kind, ids) ?? '');
    } catch (error) {
      setErrors(describeError(error));
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    setBusy('test');
    setErrors([]);
    setReport(null);
    try {
      // A saved provider with no new key is tested with its stored key; otherwise with what was typed.
      setReport(editing && !apiKey.trim() ? await llmApi.test(provider.id) : await llmApi.testDraft(draftInput()));
      if (editing && !apiKey.trim()) onSaved();
    } catch (error) {
      setErrors(describeError(error));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const p = prices();
    if (p.invalid) {
      setErrors([t.genericFailure]);
      return;
    }
    setBusy('save');
    setErrors([]);
    try {
      if (editing) {
        const patch: ProviderPatch = {
          label: label.trim(),
          model: model.trim(),
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          ...(selfHosted ? { baseUrl: baseUrl.trim() || null } : {}),
          dataRegion: dataRegion.trim() || null,
          zeroRetention,
          inputPriceMicroUsdPerMTok: p.input,
          outputPriceMicroUsdPerMTok: p.output,
        };
        await llmApi.update(provider.id, patch);
      } else {
        await llmApi.create(draftInput());
      }
      onSaved();
      onClose();
    } catch (error) {
      setErrors(describeError(error));
    } finally {
      setBusy(null);
    }
  };

  const canAskProvider = (editing && !apiKey.trim()) || apiKey.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={editing ? t.form.editTitle : t.form.createTitle}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{editing ? t.form.editTitle : t.form.createTitle}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-slate-100" aria-label={t.form.cancel}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">{t.form.kind}</span>
            <select
              className={inputClass}
              value={kind}
              disabled={editing}
              onChange={(e) => {
                const next = e.target.value as LlmProviderKind;
                setKind(next);
                if (!editing && !labelTouched) setLabel(defaultLabel(next));
                setModels([]);
                setReport(null);
              }}
              aria-label={t.form.kind}
            >
              {KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {t.kinds[k]}
                </option>
              ))}
            </select>
            {editing && <span className="text-xs text-slate-500">{t.form.kindLocked}</span>}
            {!SUPPORTED_KINDS.includes(kind) && (
              <span className="block text-xs text-amber-700" data-testid="kind-not-supported">
                {t.form.kindNotSupported}
              </span>
            )}
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">{t.form.label}</span>
            <input
              className={inputClass}
              name="llm-provider-label"
              autoComplete="off"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setLabelTouched(true);
              }}
              aria-label={t.form.label}
            />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">{t.form.apiKey}</span>
            <input
              className={inputClass}
              type="password"
              name="llm-provider-api-key"
              autoComplete="new-password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={editing ? t.form.apiKeyKeep : ''}
              aria-label={t.form.apiKey}
            />
            {editing && provider && <span className="text-xs text-slate-500">{t.form.apiKeySaved(provider.apiKeyLast4)}</span>}
          </label>

          {selfHosted && (
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">{t.form.baseUrl}</span>
              <input
                className={inputClass}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={t.form.baseUrlHint}
                aria-label={t.form.baseUrl}
              />
            </label>
          )}

          <div className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">{t.form.model}</span>
            <div className="flex gap-2">
              {models.length > 0 ? (
                <select className={inputClass} value={model} onChange={(e) => setModel(e.target.value)} aria-label={t.form.model}>
                  {!models.includes(model) && model && <option value={model}>{model}</option>}
                  {models.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={inputClass}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={t.form.modelPlaceholder}
                  aria-label={t.form.model}
                />
              )}
              <button
                type="button"
                onClick={() => void loadModels()}
                disabled={busy !== null || !canAskProvider}
                className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === 'models' ? t.form.loadingModels : t.form.loadModels}
              </button>
            </div>
            {modelsNote && <span className="text-xs text-slate-500">{modelsNote}</span>}
            {modelWarning(model) && (
              <p className="mt-1 text-xs text-amber-700" data-testid="form-model-warning">
                {t.smallModel}
              </p>
            )}
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">{t.form.dataRegion}</span>
            <input className={inputClass} value={dataRegion} onChange={(e) => setDataRegion(e.target.value)} aria-label={t.form.dataRegion} />
          </label>

          <label className="flex items-center gap-2 pt-6 text-sm">
            <input type="checkbox" checked={zeroRetention} onChange={(e) => setZeroRetention(e.target.checked)} />
            <span>{t.form.zeroRetention}</span>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">{t.form.inputPrice}</span>
            <input className={inputClass} inputMode="decimal" value={inputPrice} onChange={(e) => setInputPrice(e.target.value)} aria-label={t.form.inputPrice} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">{t.form.outputPrice}</span>
            <input className={inputClass} inputMode="decimal" value={outputPrice} onChange={(e) => setOutputPrice(e.target.value)} aria-label={t.form.outputPrice} />
          </label>
          <p className="text-xs text-slate-500 sm:col-span-2">{t.form.priceHint}</p>
        </div>

        {isCloudKind(kind) && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="note" data-testid="cloud-notice">
            {t.form.cloudNotice}
          </p>
        )}

        {errors.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert" data-testid="form-errors">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        {report && (
          <div className="mt-4">
            <KeyTestReportView report={report} />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            {t.form.cancel}
          </button>
          <button
            type="button"
            onClick={() => void runTest()}
            disabled={busy !== null || !canAskProvider || !model.trim()}
            className="rounded-lg border border-blue-300 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            {busy === 'test' ? t.actions.testing : t.form.testDraft}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy === 'save' ? t.form.saving : t.form.save}
          </button>
        </div>
      </div>
    </div>
  );
}
