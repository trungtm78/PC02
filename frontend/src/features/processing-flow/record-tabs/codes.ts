/** The code lists of the record tabs, typed from the generated contract: never a copy that can drift. */
import raw from '@/shared/processing/processing-codes.generated.json';
import type { Band, CompletionClass, OpinionKind, RecordKind, ReportKind, StepStatus } from './types';

export const STEP_STATUSES = raw.stepStatuses as readonly StepStatus[];
export const BANDS = raw.bands as readonly Band[];
export const COMPLETION_CLASSES = raw.completionClasses as readonly CompletionClass[];
export const REPORT_KINDS = raw.reportKinds as readonly ReportKind[];
export const OPINION_KINDS = raw.opinionKinds as readonly OpinionKind[];
export const OPINION_VERDICTS = raw.opinionVerdicts as readonly string[];
export const PROPOSAL_KINDS = raw.proposalKinds as Record<RecordKind, readonly string[]>;
