import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Plus, X } from 'lucide-react';
import { llmConfig as t } from '@/locales/vi';
import { LlmProviderRole } from '@/shared/enums/generated';
import { KeyTestReportView } from './KeyTestReportView';
import { ProviderFormModal } from './ProviderFormModal';
import {
  llmApi,
  type KeyTestReport,
  type LlmStatus,
  type ProviderView,
} from './llmApi';
import { decodeApiError, describeError, isCloudKind, testBadge } from './llmConfig.logic';

type LoadState = 'LOADING' | 'READY' | 'FEATURE_OFF' | 'FORBIDDEN' | 'FAILED';

const badgeClass: Record<string, string> = {
  NEVER: 'bg-slate-100 text-slate-700',
  PASSED: 'bg-green-100 text-green-800',
  OUTDATED: 'bg-amber-100 text-amber-800',
  FAILED: 'bg-red-100 text-red-800',
};

const th = 'px-4 py-3 text-left text-xs font-medium uppercase text-slate-600';

/**
 * /admin/cau-hinh-llm - providers the system may send scanned images to.
 *
 * A failed load is shown as a failure, never as an empty list: an administrator who sees "no providers" would add a
 * duplicate and could not tell the screen had lost the real ones.
 */
export function LlmConfigPage() {
  const [state, setState] = useState<LoadState>('LOADING');
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [providers, setProviders] = useState<ProviderView[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [actionErrors, setActionErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, KeyTestReport>>({});
  const [modal, setModal] = useState<{ provider: ProviderView | null } | null>(null);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [fileNumber, setFileNumber] = useState('');
  const [filedAt, setFiledAt] = useState('');
  const [assessmentNote, setAssessmentNote] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, list] = await Promise.all([llmApi.status(), llmApi.list()]);
      setStatus(s);
      setProviders(list);
      setState('READY');
    } catch (error) {
      const { status: http } = decodeApiError(error);
      // Keep what we already showed on a refresh failure: only a first load may blank the screen.
      setState((previous) =>
        http === 404 ? 'FEATURE_OFF' : http === 403 ? 'FORBIDDEN' : previous === 'READY' ? 'READY' : 'FAILED',
      );
      if (http !== 404 && http !== 403) setActionErrors(describeError(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Runs one administrative action, then reloads so the screen shows what the server now holds. */
  const run = async (id: string | null, action: () => Promise<unknown>, success = '') => {
    setBusyId(id);
    setActionErrors([]);
    setNotice('');
    try {
      await action();
      if (success) setNotice(success);
      await load();
    } catch (error) {
      setActionErrors(describeError(error));
    } finally {
      setBusyId(null);
    }
  };

  const test = (provider: ProviderView) =>
    run(provider.id, async () => {
      const report = await llmApi.test(provider.id);
      setReports((current) => ({ ...current, [provider.id]: report }));
    });

  const setRole = (provider: ProviderView, role: LlmProviderRole) =>
    run(provider.id, () => llmApi.setRole(provider.id, role));

  const archive = (provider: ProviderView) => {
    if (!window.confirm(t.actions.archiveConfirm)) return Promise.resolve();
    return run(provider.id, () => llmApi.archive(provider.id));
  };

  const remove = (provider: ProviderView) => {
    if (!window.confirm(t.actions.removeConfirm)) return Promise.resolve();
    return run(provider.id, () => llmApi.remove(provider.id));
  };

  const fileAssessment = () =>
    run(
      null,
      async () => {
        await llmApi.createAssessment({
          fileNumber: fileNumber.trim(),
          filedAt,
          ...(assessmentNote.trim() ? { note: assessmentNote.trim() } : {}),
        });
        setAssessmentOpen(false);
        setFileNumber('');
        setFiledAt('');
        setAssessmentNote('');
      },
    );

  const withdraw = async () => {
    if (!window.confirm(t.assessment.withdrawConfirm)) return;
    setActionErrors([]);
    setNotice('');
    try {
      const { providersStopped } = await llmApi.withdrawAssessment();
      setNotice(t.assessment.withdrawn(providersStopped));
      await load();
    } catch (error) {
      setActionErrors(describeError(error));
    }
  };

  if (state === 'LOADING') {
    return (
      <div className="flex items-center gap-2 p-6 text-slate-600" role="status">
        <Loader2 className="h-5 w-5 animate-spin" /> {t.loading}
      </div>
    );
  }
  if (state === 'FEATURE_OFF' || state === 'FORBIDDEN') {
    return (
      <div className="p-6">
        <h1 className="mb-3 text-2xl font-bold text-slate-900">{t.title}</h1>
        <p className="rounded-lg bg-slate-100 p-4 text-slate-700" role="status" data-testid="llm-unavailable">
          {state === 'FEATURE_OFF' ? t.featureOff : t.forbidden}
        </p>
      </div>
    );
  }
  if (state === 'FAILED') {
    return (
      <div className="p-6">
        <h1 className="mb-3 text-2xl font-bold text-slate-900">{t.title}</h1>
        <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-700" role="alert" data-testid="llm-load-failed">
          <AlertCircle className="h-5 w-5" />
          <span>{t.loadFailed}</span>
          <button type="button" onClick={() => void load()} className="ml-auto rounded border border-red-300 px-3 py-1 text-sm hover:bg-red-100">
            {t.retry}
          </button>
        </div>
      </div>
    );
  }

  const shown = providers.filter((p) => showArchived || !p.archivedAt);
  const assessment = status?.assessment ?? null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{t.subtitle}</p>
      </div>

      {status && !status.keyConfigured && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="alert" data-testid="key-not-configured">
          {t.keyNotConfigured}
        </p>
      )}

      {actionErrors.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert" data-testid="action-errors">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <ul className="flex-1 space-y-1">
            {actionErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          <button type="button" onClick={() => setActionErrors([])} aria-label={t.dismiss} className="rounded p-1 hover:bg-red-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {notice && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status" data-testid="notice">
          {notice}
        </p>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="assessment-title">
        <h2 id="assessment-title" className="text-lg font-semibold text-slate-900">
          {t.assessment.title}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t.assessment.explain}</p>
        {assessment ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm" data-testid="assessment-active">
            <span className="rounded bg-green-100 px-2 py-0.5 text-green-800">{t.assessment.inForce}</span>
            <span>
              {t.assessment.fileNumber}: <strong>{assessment.fileNumber}</strong>
            </span>
            <span>
              {t.assessment.filedAt}: {assessment.filedAt.slice(0, 10)}
            </span>
            <button type="button" onClick={() => void withdraw()} className="ml-auto rounded border border-red-300 px-3 py-1 text-red-700 hover:bg-red-50">
              {t.assessment.withdraw}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-amber-800" data-testid="assessment-none">
            {t.assessment.none}
          </p>
        )}
        {!assessmentOpen ? (
          <button type="button" onClick={() => setAssessmentOpen(true)} className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            {t.assessment.record}
          </button>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder={t.assessment.fileNumber} aria-label={t.assessment.fileNumber} value={fileNumber} onChange={(e) => setFileNumber(e.target.value)} />
            <input type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label={t.assessment.filedAt} value={filedAt} onChange={(e) => setFiledAt(e.target.value)} />
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder={t.assessment.note} aria-label={t.assessment.note} value={assessmentNote} onChange={(e) => setAssessmentNote(e.target.value)} />
            <div className="flex gap-2 sm:col-span-3">
              <button type="button" onClick={() => void fileAssessment()} disabled={!fileNumber.trim() || !filedAt} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                {t.assessment.save}
              </button>
              <button type="button" onClick={() => setAssessmentOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
                {t.assessment.cancel}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm" aria-labelledby="providers-title">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <h2 id="providers-title" className="text-lg font-semibold text-slate-900">
            {t.providers.title}
          </h2>
          <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            {t.providers.showArchived}
          </label>
          <button
            type="button"
            onClick={() => setModal({ provider: null })}
            disabled={!status?.keyConfigured}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {t.providers.add}
          </button>
        </div>

        {shown.length === 0 ? (
          <p className="p-8 text-center text-slate-600" data-testid="providers-empty">
            {t.providers.empty}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="providers-table">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className={th}>{t.providers.columns.label}</th>
                  <th className={th}>{t.providers.columns.kind}</th>
                  <th className={th}>{t.providers.columns.model}</th>
                  <th className={th}>{t.providers.columns.key}</th>
                  <th className={th}>{t.providers.columns.test}</th>
                  <th className={th}>{t.providers.columns.role}</th>
                  <th className={th}>{t.providers.columns.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {shown.map((p) => {
                  const badge = testBadge(p);
                  const archived = p.archivedAt !== null;
                  const canHoldRole = badge === 'PASSED' && !archived;
                  return (
                    <tr key={p.id} data-testid={`provider-row-${p.id}`} className={archived ? 'bg-slate-50 text-slate-500' : ''}>
                      <td className="px-4 py-3 text-sm font-medium">
                        {p.label}
                        {archived && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs">{t.providers.archivedTag}</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {t.kinds[p.kind]}{' '}
                        <span className="text-xs text-slate-500">{isCloudKind(p.kind) ? t.providers.cloudTag : t.providers.ownTag}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">{p.model}</td>
                      <td className="px-4 py-3 font-mono text-sm" data-testid={`key-${p.id}`}>
                        ••••{p.apiKeyLast4}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`rounded px-2 py-0.5 text-xs ${badgeClass[badge]}`} data-testid={`test-badge-${p.id}`}>
                          {t.testBadge[badge]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <select
                          value={p.role}
                          disabled={busyId === p.id || archived}
                          onChange={(e) => void setRole(p, e.target.value as LlmProviderRole)}
                          aria-label={`${t.providers.columns.role}: ${p.label}`}
                          title={canHoldRole ? undefined : t.actions.roleNeedsTest}
                          className="rounded border border-slate-300 px-2 py-1 text-sm"
                        >
                          {Object.values(LlmProviderRole).map((role) => (
                            <option key={role} value={role} disabled={role !== LlmProviderRole.OFF && !canHoldRole}>
                              {t.roles[role]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap gap-2">
                          {!archived && (
                            <>
                              <button type="button" onClick={() => void test(p)} disabled={busyId === p.id} className="rounded border border-blue-300 px-2 py-1 text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                                {busyId === p.id ? t.actions.testing : t.actions.test}
                              </button>
                              <button type="button" onClick={() => setModal({ provider: p })} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
                                {t.actions.edit}
                              </button>
                              <button type="button" onClick={() => void archive(p)} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
                                {t.actions.archive}
                              </button>
                            </>
                          )}
                          {archived && (
                            <button type="button" onClick={() => void run(p.id, () => llmApi.restore(p.id))} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
                              {t.actions.restore}
                            </button>
                          )}
                          <button type="button" onClick={() => void remove(p)} className="rounded border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50">
                            {t.actions.remove}
                          </button>
                        </div>
                        {reports[p.id] && (
                          <div className="mt-3">
                            <KeyTestReportView report={reports[p.id]} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal && (
        <ProviderFormModal
          provider={modal.provider}
          onClose={() => setModal(null)}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}

export default LlmConfigPage;
