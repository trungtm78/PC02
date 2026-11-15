/**
 * The flow of a record, turned into what the shared Gantt chart takes. The instants are the server's: nothing here
 * works out a deadline.
 */
import { processingFlow as L } from '@/locales/processingFlow.vi';
import type { GanttExtras, GanttRowExtra } from '../components/GanttChart';
import type { SchedulePreviewDto, SchedulePreviewRow } from '../types';
import { isAdjusted, recordDeadlineStep } from './present';
import type { RecordFlowDto, RecordStepDto } from './types';

const R = L.recordTabs;

function rowOf(step: RecordStepDto, index: number): SchedulePreviewRow {
  const drawn = step.status !== 'SKIPPED' && step.status !== 'WAITING_ANCHOR';
  return {
    stepIndex: index,
    stepKey: step.stepKey,
    // A step that waits or was skipped has no bar, whatever dates it may still carry.
    startAt: drawn ? step.startAt : null,
    dueAt: drawn ? step.dueAt : null,
    provisional: step.provisional,
    greenFrom: step.greenFrom,
    yellowFrom: step.yellowFrom,
    redFrom: step.redFrom,
    variant: null,
    problem: step.problem,
  };
}

function extraOf(step: RecordStepDto, index: number): GanttRowExtra {
  const tick = step.status === 'DONE' ? '✔ ' : '';
  const skipped = step.status === 'SKIPPED' ? ` (${R.gantt.skipped})` : '';
  return {
    label: `${tick}${index + 1}. ${step.name}${step.setsRecordDeadline ? ' ★' : ''}${skipped}`,
    done: step.status === 'DONE',
    note: step.status === 'SKIPPED' ? R.gantt.skipped : step.status === 'WAITING_ANCHOR' ? R.gantt.waiting : undefined,
    regulatoryAt: isAdjusted(step) ? step.regulatoryDueAt : null,
  };
}

export interface RecordGantt {
  steps: Array<{ name: string; setsRecordDeadline: boolean }>;
  data: SchedulePreviewDto;
  extras: GanttExtras;
}

export function recordGantt(flow: RecordFlowDto, now: Date = new Date()): RecordGantt {
  const deadlineStep = recordDeadlineStep(flow);
  return {
    steps: flow.steps.map((s) => ({ name: s.name, setsRecordDeadline: s.setsRecordDeadline })),
    data: {
      steps: flow.steps.map(rowOf),
      recordDeadline: deadlineStep ? (deadlineStep.regulatoryDueAt ?? deadlineStep.dueAt) : null,
      provisional: flow.steps.some((s) => s.provisional),
      issues: [],
    },
    extras: { todayAt: now.toISOString(), rows: flow.steps.map(extraOf) },
  };
}
