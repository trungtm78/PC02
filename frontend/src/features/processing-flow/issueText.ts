/** Plain-Vietnamese lines for the issues the server lists (by step) when a draft cannot be published. */
import { errorText, processingFlow as L } from '@/locales/processingFlow.vi';
import type { BoundConflict, InactiveTeamDetail } from './errors';
import type { StepIssue } from './types';

/** "Bước 2 (Xác minh): Mỗi bước cần đúng một đơn vị xử lý chính." or, for the flow as a whole, "Quy trình: …". */
export function issueLine(issue: StepIssue, stepNames: readonly string[]): string {
  const where =
    issue.stepIndex === undefined ? L.publish.flowLevel : L.publish.stepLine(issue.stepIndex + 1, stepNames[issue.stepIndex] ?? '');
  return `${where}: ${errorText(issue.code)}`;
}

/** "Bước 1 (Tiếp nhận): Tổ 9". `teamName` finds the name of a unit by id. */
export function inactiveTeamLine(d: InactiveTeamDetail, stepNames: readonly string[], teamName: (id: string) => string | null): string {
  return L.publish.inactiveTeamLine(d.stepIndex + 1, stepNames[d.stepIndex] ?? '', teamName(d.teamId) ?? L.publish.unknownTeam);
}

/** What `TYPE_ALREADY_BOUND` says about each type: which flow already holds it. `nameOf` finds a type or group's name. */
export function boundConflictLines(conflicts: BoundConflict[], nameOf: (c: BoundConflict) => string): string[] {
  return conflicts.map((c) => L.bound.conflictLine(nameOf(c), c.flowName ?? L.bound.unknownFlow));
}
