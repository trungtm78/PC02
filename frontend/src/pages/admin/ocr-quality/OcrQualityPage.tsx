import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { ocrQuality as t } from '@/locales/vi';
import {
  microToUsd,
  percent,
  qualityByModel,
  worstFields,
  type QualityReport,
} from './ocrQuality.logic';

type State = 'LOADING' | 'READY' | 'FAILED' | 'FORBIDDEN';

const th = 'px-3 py-2 text-left text-xs font-medium uppercase text-slate-600';
const td = 'px-3 py-2 text-sm text-slate-800';

/**
 * /admin/chat-luong-ocr - how often officers keep what the scans were read into, and what the readings cost. Counts
 * only: no value read from a scan is stored or shown here.
 */
export default function OcrQualityPage() {
  const [state, setState] = useState<State>('LOADING');
  const [report, setReport] = useState<QualityReport | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await api.get<QualityReport>('/ocr/quality');
        if (!live) return;
        setReport(res.data);
        setState('READY');
      } catch (error) {
        if (live) setState((error as { response?: { status?: number } }).response?.status === 403 ? 'FORBIDDEN' : 'FAILED');
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (state === 'LOADING') {
    return (
      <div className="flex items-center gap-2 p-6 text-slate-600" role="status">
        <Loader2 className="h-4 w-4 animate-spin" /> {t.loading}
      </div>
    );
  }
  if (state !== 'READY' || !report) {
    return (
      <div className="m-6 flex items-center gap-2 rounded-md border border-red-300 bg-red-50 p-4 text-red-800" role="alert">
        <AlertCircle className="h-4 w-4" /> {state === 'FORBIDDEN' ? t.forbidden : t.failed}
      </div>
    );
  }

  const models = qualityByModel(report.fields);
  const worst = worstFields(report.fields);
  return (
    <div className="space-y-8 p-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">{t.title}</h1>
        <p className="text-sm text-slate-600">{t.subtitle}</p>
      </header>

      <section aria-label={t.modelsHeading} className="space-y-2">
        <h2 className="text-base font-medium text-slate-900">{t.modelsHeading}</h2>
        {models.length === 0 ? (
          <p className="text-sm text-slate-600">{t.noData}</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 rounded-md border border-slate-200 bg-white" data-testid="quality-models">
            <thead>
              <tr>
                <th className={th}>{t.model}</th>
                <th className={th}>{t.fieldsSeen}</th>
                <th className={th}>{t.kept}</th>
                <th className={th}>{t.edited}</th>
                <th className={th}>{t.cleared}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {models.map((m) => (
                <tr key={`${m.providerKind}|${m.model}`}>
                  <td className={td}>{m.providerKind} · {m.model}</td>
                  <td className={td}>{m.total}</td>
                  <td className={td}>{percent(m.keptRate)}</td>
                  <td className={td}>{percent(m.editedRate)}</td>
                  <td className={td}>{percent(m.clearedRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label={t.worstHeading} className="space-y-2">
        <h2 className="text-base font-medium text-slate-900">{t.worstHeading}</h2>
        {worst.length === 0 ? (
          <p className="text-sm text-slate-600">{t.noData}</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 rounded-md border border-slate-200 bg-white" data-testid="quality-fields">
            <thead>
              <tr>
                <th className={th}>{t.field}</th>
                <th className={th}>{t.model}</th>
                <th className={th}>{t.fieldsSeen}</th>
                <th className={th}>{t.corrected}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {worst.map((f) => (
                <tr key={`${f.entity}|${f.field}|${f.model}|${f.promptVersion}`}>
                  <td className={td}>{f.field}</td>
                  <td className={td}>{f.model ?? '?'}</td>
                  <td className={td}>{f.total}</td>
                  <td className={td}>{percent(f.correctedRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label={t.costHeading} className="space-y-2">
        <h2 className="text-base font-medium text-slate-900">{t.costHeading}</h2>
        {report.calls.length === 0 ? (
          <p className="text-sm text-slate-600">{t.noData}</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 rounded-md border border-slate-200 bg-white" data-testid="quality-calls">
            <thead>
              <tr>
                <th className={th}>{t.model}</th>
                <th className={th}>{t.calls}</th>
                <th className={th}>{t.failedCalls}</th>
                <th className={th}>{t.images}</th>
                <th className={th}>{t.tokens}</th>
                <th className={th}>{t.cost}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.calls.map((c) => (
                <tr key={`${c.providerKind}|${c.model}`}>
                  <td className={td}>{c.providerKind} · {c.model}</td>
                  <td className={td}>{c.calls}</td>
                  <td className={td}>
                    {c.failed}
                    {c.failed > 0 && (
                      <span className="ml-1 text-xs text-slate-500">
                        ({Object.entries(c.errors).map(([code, n]) => `${code}: ${n}`).join(', ')})
                      </span>
                    )}
                  </td>
                  <td className={td}>{c.images}</td>
                  <td className={td}>{c.inputTokens} / {c.outputTokens}</td>
                  <td className={td}>${microToUsd(c.costMicroUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-slate-500">{t.costNote}</p>
      </section>
    </div>
  );
}
