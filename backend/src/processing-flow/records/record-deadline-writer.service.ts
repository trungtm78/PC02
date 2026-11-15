import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RecordGateway } from '../gateway/record-gateway';
import type { RecordKind } from '../gateway/record-snapshot';

type Db = Prisma.TransactionClient | PrismaService;

/**
 * The ONE writer of the `deadline` column of a record that has a flow.
 *
 * For such a record the column is not a value anybody types: it is the REGULATORY deadline of the step the flow marks as
 * "the deadline of the record" (`setsRecordDeadline`), copied here so that every screen, report and reminder that reads
 * the column keeps reading the same field. It is written only when it can be trusted:
 *
 *   - the flow of the record is CONFIRMED (a flow that was only proposed for an information type nobody recognised
 *     asserts no legal deadline), and
 *   - a person has compared that step's legal figures with the source text (`legalVerifiedAt`; a template's figures
 *     come from secondary sources until somebody does), and
 *   - the step has a deadline.
 *
 * Otherwise the record keeps the deadline it has, and the old ways of setting it stay open.
 *
 * It is called by the command layer, the pause worker and the application of a flow, inside their transactions, so the
 * column and the steps never disagree.
 */
@Injectable()
export class RecordDeadlineWriter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RecordGateway,
  ) {}

  /** The deadline the flow of the record keeps in the record's column, or `null` when the record keeps its own. */
  async managedDeadline(db: Db, kind: RecordKind, recordId: string): Promise<Date | null> {
    const flow = await db.procRecordFlow.findUnique({
      where: { recordKind_recordId: { recordKind: kind, recordId } },
      select: { confirmed: true, steps: { where: { step: { setsRecordDeadline: true } }, select: { regulatoryDueAt: true, step: { select: { legalVerifiedAt: true } } } } },
    });
    if (!flow || !flow.confirmed) return null;
    const step = flow.steps[0];
    if (!step || !step.regulatoryDueAt || step.step.legalVerifiedAt === null) return null;
    return step.regulatoryDueAt;
  }

  /** Whether a person may no longer type the deadline of this record: its flow keeps it. */
  async isManaged(db: Db, kind: RecordKind, recordId: string): Promise<boolean> {
    return (await this.managedDeadline(db, kind, recordId)) !== null;
  }

  /**
   * The ids of the records of a kind whose deadline is managed: the same test as `isManaged`, for all of them in one
   * query (the reminders of the old scheduler leave these records to the new ones).
   */
  async managedRecordIds(kind: RecordKind): Promise<string[]> {
    const flows = await this.prisma.procRecordFlow.findMany({
      where: {
        recordKind: kind,
        confirmed: true,
        steps: { some: { regulatoryDueAt: { not: null }, step: { setsRecordDeadline: true, legalVerifiedAt: { not: null } } } },
      },
      select: { recordId: true },
    });
    return flows.map((flow) => flow.recordId);
  }

  /** Copies the managed deadline into the record's column when it differs. Returns what it did. */
  async sync(tx: Prisma.TransactionClient, kind: RecordKind, recordId: string): Promise<'WRITTEN' | 'UNCHANGED' | 'NOT_MANAGED'> {
    const managed = await this.managedDeadline(tx, kind, recordId);
    if (!managed) return 'NOT_MANAGED';
    const snapshot = await this.gateway.load(kind, recordId, tx);
    if (!snapshot) return 'NOT_MANAGED';
    if (snapshot.deadline && snapshot.deadline.getTime() === managed.getTime()) return 'UNCHANGED';
    await this.gateway.writeDeadline(kind, recordId, managed, tx);
    const flow = await tx.procRecordFlow.findUniqueOrThrow({ where: { recordKind_recordId: { recordKind: kind, recordId } }, select: { id: true } });
    await tx.procStepChange.create({
      data: {
        recordFlowId: flow.id,
        recordKind: kind,
        recordId,
        action: 'RECORD_DEADLINE_WRITTEN',
        fromValue: { deadline: snapshot.deadline ? snapshot.deadline.toISOString() : null },
        toValue: { deadline: managed.toISOString() },
        actorId: null,
      },
    });
    return 'WRITTEN';
  }
}
