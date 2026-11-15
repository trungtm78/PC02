import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { RecordKind } from '../gateway/record-snapshot';
import { actingForIds } from './processing-delegation';

/** The switch that lets a record carry the steps of a flow (the same one as the application of a flow). */
const RECORDS_SWITCH = 'processing_flow_records';

/** The statuses in which a step still gives its unit a reason to open the record. */
const WORKED = ['OPEN', 'REPORTED'] as const;

/**
 * The parties of a step that name this person: the person themselves, or an ACTIVE unit they belong to. ONE definition,
 * for opening a record by a step (`mayOpen`) and for the rows of the tracking screen.
 *
 * `acting`: the people this person acts for right now (`actingFor`: delegations in force). A party that names one of
 * them, or a unit one of them belongs to, names the delegate too, for THAT step only.
 */
export function partyNamesUser(userId: string, acting: readonly string[] = []) {
  const ids = [userId, ...acting];
  return { OR: [{ assigneeUserId: { in: ids } }, { team: { status: 'ACTIVE' as const, members: { some: { userId: { in: ids } } } } }] };
}

/**
 * Why a person who is NOT in the scope of a record may still OPEN it, read-only: a step of that record that is being
 * worked names a unit they belong to (or names them), or names a person they act for under a delegation in force
 * (judged with the application clock, at the moment of the question).
 *
 * It widens the DETAIL route of a record by one reason and nothing else:
 *   - never the list screens (an assigned unit reaches the record from the screens of the flow);
 *   - never what hangs on the record (documents, subjects, lawyers…): those keep the record's own policy;
 *   - never a write: the write checks of the record services still look at the person's own scope;
 *   - never past the record's other policies (a case's sensitivity and representation rules still run);
 *   - it ends when the step is done or skipped.
 *
 * While the switch `processing_flow_records` is OFF it answers `false` without touching the database (a cached read,
 * never taken inside a transaction).
 */
@Injectable()
export class RecordStepAccessService implements OnModuleInit {
  private readonly logger = new Logger(RecordStepAccessService.name);
  private recordsOn = false;
  /** The clock, replaceable by a spec. */
  now: () => Date = () => new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshSwitch().catch((error: unknown) => this.logger.warn(`Reading the switch failed: ${String(error)}`));
  }

  @Interval(10_000)
  async tick(): Promise<void> {
    await this.refreshSwitch().catch((error: unknown) => this.logger.warn(`Reading the switch failed: ${String(error)}`));
  }

  async refreshSwitch(): Promise<boolean> {
    this.recordsOn = await this.flags.isEnabled(RECORDS_SWITCH);
    return this.recordsOn;
  }

  /** Whether a step being worked on this record names a unit the person belongs to, or names the person. */
  async mayOpen(kind: RecordKind, recordId: string, userId: string): Promise<boolean> {
    if (!this.recordsOn || !userId) return false;
    const party = await this.prisma.procRecordStepParty.findFirst({
      where: {
        recordStep: { recordKind: kind, recordId, status: { in: [...WORKED] } },
        ...partyNamesUser(userId, await actingForIds(this.prisma, userId, this.now())),
      },
      select: { id: true },
    });
    return party !== null;
  }
}
