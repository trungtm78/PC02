import type { Prisma } from '@prisma/client';
import { TRANG_THAI_KET_THUC, TRANG_THAI_TAM_DINH_CHI } from '../../common/trang-thai/trang-thai-ket-thuc';
import type { PrismaService } from '../../prisma/prisma.service';
import { earliestInstants, type BandRow } from '../engine/bands';
import type { RecordGateway } from '../gateway/record-gateway';
import type { RecordKind } from '../gateway/record-snapshot';

type Tx = Prisma.TransactionClient;

/** The statuses in which a step has a deadline running: the steps that count for the alert of their record. */
export const COUNTED_STEP_STATUSES = ['OPEN', 'REPORTED'] as const;

/** The relation of a flow to its record, and the column that repeats `recordId`, per kind. */
export const RECORD_LINK = {
  PETITION: { relation: 'petition', column: 'petitionId', statuses: 'petition' },
  INCIDENT: { relation: 'incident', column: 'incidentId', statuses: 'incident' },
  CASE: { relation: 'case', column: 'caseId', statuses: 'case' },
} as const;

/** The statuses of a record of each kind in which nothing counts down: finished, or suspended. */
export function clocklessStatuses(kind: RecordKind): string[] {
  const key = RECORD_LINK[kind].statuses;
  return [...TRANG_THAI_KET_THUC[key], ...TRANG_THAI_TAM_DINH_CHI[key]];
}

/** What a new flow stores to reach its record: `recordId` again, in the column of the record's kind. */
export function recordLink(kind: RecordKind, recordId: string): { petitionId?: string; incidentId?: string; caseId?: string } {
  return { [RECORD_LINK[kind].column]: recordId };
}

/** The deadline a step counts down to: the earlier of the regulatory one and the unit's own. */
export function effectiveDue(step: { regulatoryDueAt: Date | null; internalDueAt: Date | null }): Date | null {
  const { regulatoryDueAt: a, internalDueAt: b } = step;
  return a && b ? (a.getTime() <= b.getTime() ? a : b) : (a ?? b);
}

const NO_ALERT = { alertDueAt: null, alertRedFrom: null, alertYellowFrom: null, alertGreenFrom: null } as const;

/**
 * The ONE writer of the stored alert of a record (`alertDueAt`, `alertRedFrom`, `alertYellowFrom`, `alertGreenFrom` on
 * `ProcRecordFlow`): the earliest of each instant over the steps being worked, or nothing when no colour is shown:
 *
 *   - the record is gone, finished or suspended (what the record says NOW), or
 *   - the clock of the record stands still (an open pause), or
 *   - no step that is OPEN or REPORTED has a deadline.
 *
 * It recomputes from the rows as they are inside the caller's transaction, so it is called AFTER the write, by the three
 * places every write of a record's flow goes through: the command layer (`ProcessingCommandService.write`), the
 * application of a flow (`FlowApplicationService.applyIn`) and the worker of the clock (`ProcessingPauseService`).
 * Nothing else writes these columns (gate: `record-alert.gate.spec.ts`).
 */
export async function refreshRecordAlert(tx: Tx, gateway: RecordGateway, kind: RecordKind, recordId: string): Promise<'WRITTEN' | 'UNCHANGED' | 'NO_FLOW'> {
  const flow = await tx.procRecordFlow.findUnique({
    where: { recordKind_recordId: { recordKind: kind, recordId } },
    select: {
      id: true,
      alertDueAt: true,
      alertRedFrom: true,
      alertYellowFrom: true,
      alertGreenFrom: true,
      pauses: { where: { to: null }, select: { id: true } },
      steps: { where: { status: { in: [...COUNTED_STEP_STATUSES] } }, select: { regulatoryDueAt: true, internalDueAt: true, redFrom: true, yellowFrom: true, greenFrom: true } },
    },
  });
  if (!flow) return 'NO_FLOW';

  const snapshot = await gateway.load(kind, recordId, tx);
  const running = snapshot !== null && !snapshot.isFinished && !snapshot.isSuspended && flow.pauses.length === 0;
  const rows: BandRow[] = [];
  if (running) {
    for (const step of flow.steps) {
      const dueAt = effectiveDue(step);
      if (dueAt && step.redFrom && step.yellowFrom && step.greenFrom) rows.push({ dueAt, redFrom: step.redFrom, yellowFrom: step.yellowFrom, greenFrom: step.greenFrom });
    }
  }
  const earliest = earliestInstants(rows);
  const next = earliest ? { alertDueAt: earliest.dueAt, alertRedFrom: earliest.redFrom, alertYellowFrom: earliest.yellowFrom, alertGreenFrom: earliest.greenFrom } : NO_ALERT;

  const same = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);
  if (same(flow.alertDueAt, next.alertDueAt) && same(flow.alertRedFrom, next.alertRedFrom) && same(flow.alertYellowFrom, next.alertYellowFrom) && same(flow.alertGreenFrom, next.alertGreenFrom)) return 'UNCHANGED';
  await tx.procRecordFlow.update({ where: { id: flow.id }, data: next });
  return 'WRITTEN';
}

/**
 * The flows whose stored alert no longer fits what their RECORD says. The three record services change a status (or
 * delete a record) without telling the flow, and they do not have to: the worker of the clock looks, as it does for a
 * suspension.
 *
 *   stale    an alert is stored, but the record is gone, deleted, finished or suspended
 *   missing  no alert is stored, the record is alive and at work, its clock is not paused, and a step counts
 */
export async function alertDriftCandidates(prisma: PrismaService): Promise<Array<{ kind: RecordKind; recordId: string }>> {
  const found: Array<{ kind: RecordKind; recordId: string }> = [];
  for (const kind of Object.keys(RECORD_LINK) as RecordKind[]) {
    const { relation } = RECORD_LINK[kind];
    const clockless = { OR: [{ deletedAt: { not: null } }, { status: { in: clocklessStatuses(kind) } }] };
    const atWork = { deletedAt: null, status: { notIn: clocklessStatuses(kind) } };
    const flows = await prisma.procRecordFlow.findMany({
      where: {
        recordKind: kind,
        OR: [
          { alertDueAt: { not: null }, OR: [{ [relation]: { is: null } }, { [relation]: { is: clockless } }] },
          {
            alertDueAt: null,
            pauses: { none: { to: null } },
            steps: { some: { status: { in: [...COUNTED_STEP_STATUSES] }, regulatoryDueAt: { not: null } } },
            [relation]: { is: atWork },
          },
        ],
      } as Prisma.ProcRecordFlowWhereInput,
      select: { recordId: true },
    });
    for (const flow of flows) found.push({ kind, recordId: flow.recordId });
  }
  return found;
}
