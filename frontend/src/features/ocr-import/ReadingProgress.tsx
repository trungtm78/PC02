import { useEffect, useState } from 'react';
import { ocrImport } from '@/locales/vi';
import type { OcrJobStage } from './ocrApi';

export interface ReadingProgressProps {
  /** READ goes through the scans first; ANALYSE only works on the text already kept. */
  kind: 'READ' | 'ANALYSE';
  /** The step the server reports; null until it has started the job. */
  stage: OcrJobStage | null;
  pageCount: number;
  /** When the reading was asked for (ms), so the clock survives the panel being closed and opened again. */
  startedAt: number;
  /** What happens to the result: it fills the form, or it is compared with a record already saved. */
  finalStep: 'fill' | 'compare';
  /** The reading goes on if the panel is closed, which is only so for the create forms. */
  canLeave?: boolean;
}

type StepState = 'done' | 'now' | 'pending';

const SLOW_AFTER_SECONDS = 60;

const clockOf = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * What the officer sees while the scans are being read: the steps in order with the current one moving, a bar that
 * slides, and the time waited. The step comes from the server (the job's stage), so it is never a guess from the clock.
 */
export function ReadingProgress({ kind, stage, pageCount, startedAt, finalStep, canLeave = false }: ReadingProgressProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));

  const steps: Array<{ key: string; label: string; state: StepState }> = [];
  const analysing = stage === 'ANALYSING';
  if (kind === 'READ') {
    steps.push({ key: 'read', label: ocrImport.progressStepRead(pageCount), state: analysing ? 'done' : 'now' });
  }
  steps.push({
    key: 'analyse',
    label: ocrImport.progressStepAnalyse,
    state: kind === 'READ' && !analysing ? 'pending' : 'now',
  });
  steps.push({
    key: 'final',
    label: finalStep === 'fill' ? ocrImport.progressStepFill : ocrImport.progressStepCompare,
    state: 'pending',
  });

  const current = steps.find((step) => step.state === 'now');

  const stateText: Record<StepState, string> = {
    done: ocrImport.progressStateDone,
    now: ocrImport.progressStateNow,
    pending: ocrImport.progressStatePending,
  };

  return (
    <div
      data-testid="ocr-reading-progress"
      className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-slate-800"
    >
      {/* Only the step is announced: the clock changes every second and would be read out again and again. */}
      <p role="status" className="sr-only">
        {current?.label}
      </p>

      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-900">{ocrImport.progressTitle}</span>
        <span className="tabular-nums text-xs text-slate-600">{ocrImport.progressElapsed(clockOf(seconds))}</span>
      </div>

      <div className="relative h-1.5 overflow-hidden rounded-full bg-blue-100" aria-hidden="true">
        <div className="ocr-progress-slide absolute inset-y-0 w-1/3 rounded-full bg-blue-600" />
      </div>

      <ol className="space-y-1.5">
        {steps.map((step) => (
          <li key={step.key} data-state={step.state} className="flex items-center gap-2">
            <StepMark state={step.state} />
            <span className={step.state === 'pending' ? 'text-slate-500' : 'text-slate-900'}>{step.label}</span>
            <span className="sr-only">{stateText[step.state]}</span>
          </li>
        ))}
      </ol>

      {seconds >= SLOW_AFTER_SECONDS && <p className="text-xs text-slate-700">{ocrImport.progressSlow}</p>}
      {canLeave && <p className="text-xs text-slate-600">{ocrImport.progressKeepWorking}</p>}
    </div>
  );
}

function StepMark({ state }: { state: StepState }) {
  if (state === 'done') {
    return (
      <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">
        ✓
      </span>
    );
  }
  if (state === 'now') {
    return (
      <span
        aria-hidden="true"
        className="h-4 w-4 rounded-full border-2 border-blue-200 border-t-blue-600 motion-safe:animate-spin"
      />
    );
  }
  return <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-slate-300" />;
}
