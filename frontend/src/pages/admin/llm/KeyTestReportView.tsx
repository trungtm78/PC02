import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { llmConfig as t } from '@/locales/vi';
import type { KeyTestReport } from './llmApi';

/** The five steps of a key test with the advice for the first one that failed. Holds no transcript or key. */
export function KeyTestReportView({ report }: { report: KeyTestReport }) {
  const failed = report.steps.find((step) => !step.ok && step.code !== 'SKIPPED');
  return (
    <div
      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
      data-testid="key-test-report"
    >
      <p className={`mb-2 font-medium ${report.ok ? 'text-green-700' : 'text-red-700'}`} role="status">
        {report.ok ? t.testResult.passed : t.testResult.failed}
      </p>
      <ol className="space-y-1">
        {report.steps.map((step) => {
          const skipped = step.code === 'SKIPPED';
          return (
            <li key={step.id} className="flex items-center gap-2" data-testid={`key-test-step-${step.id}`}>
              {step.ok ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="ok" />
              ) : skipped ? (
                <MinusCircle className="h-4 w-4 text-slate-400" aria-label="skipped" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" aria-label="failed" />
              )}
              <span className={skipped ? 'text-slate-400' : 'text-slate-800'}>{t.testSteps[step.id]}</span>
            </li>
          );
        })}
      </ol>
      {failed?.code && (
        <p className="mt-2 text-red-700" data-testid="key-test-advice">
          {t.testCodes[failed.code] ?? t.genericFailure}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        {t.testResult.summary(report.totalLatencyMs, report.inputTokens, report.outputTokens)}
      </p>
    </div>
  );
}
