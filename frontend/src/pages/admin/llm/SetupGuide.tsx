import { CheckCircle2, Circle } from 'lucide-react';
import { llmConfig as t } from '@/locales/vi';
import type { SetupStep, SetupStepKey } from './llmConfig.logic';

interface Props {
  steps: SetupStep[];
  next: SetupStep | null;
  busy: boolean;
  onAction: (key: SetupStepKey) => void;
}

/**
 * The few things that must be done, in order, for the scan feature to work, with the next one pointed at and a button
 * that does it. The screen used to leave the order to the administrator and refuse silently when it was got wrong.
 */
export function SetupGuide({ steps, next, busy, onAction }: Props) {
  return (
    <section
      className="rounded-lg border border-blue-200 bg-blue-50 p-4"
      aria-labelledby="setup-title"
      data-testid="setup-guide"
    >
      <h2 id="setup-title" className="text-lg font-semibold text-slate-900">
        {t.setup.title}
      </h2>
      <p className={`mt-1 text-sm ${next ? 'text-slate-600' : 'font-medium text-green-800'}`}>
        {next ? t.setup.intro : t.setup.allDone}
      </p>
      <ol className="mt-3 space-y-2">
        {steps.map((step) => {
          const isNext = next?.key === step.key;
          return (
            <li
              key={step.key}
              data-testid={`setup-step-${step.key}`}
              data-done={String(step.done)}
              data-next={String(isNext)}
              className={`flex flex-wrap items-center gap-3 rounded-md px-3 py-2 text-sm ${
                isNext ? 'border border-blue-300 bg-white font-medium text-slate-900' : 'text-slate-700'
              }`}
            >
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" aria-label="Đã xong" />
              ) : (
                <Circle className="h-5 w-5 flex-shrink-0 text-slate-400" aria-label="Chưa làm" />
              )}
              <span className={step.done ? 'text-slate-500' : ''}>{t.setup.steps[step.key]}</span>
              {isNext && step.key === 'KEY' && <span className="basis-full pl-8 text-xs font-normal text-amber-800">{t.setup.keyHelp}</span>}
              {isNext && step.key !== 'KEY' && (
                <button
                  type="button"
                  onClick={() => onAction(step.key)}
                  disabled={busy}
                  className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-normal text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {t.setup.actions[step.key]}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
