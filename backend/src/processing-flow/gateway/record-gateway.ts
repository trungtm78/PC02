import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CaseAdapter } from './case.adapter';
import { IncidentAdapter } from './incident.adapter';
import { PetitionAdapter } from './petition.adapter';
import type { CanReadOptions, GatewayUser, Reader, RecordAdapter, RecordKind, RecordSnapshot } from './record-snapshot';

/**
 * The one door through which the processing flow reads a petition, an incident or a case.
 *
 * Read-only. The three kinds keep their own tables, services and read policies; this only chooses the adapter of a
 * kind and hands back the same shape for all three, so that code about flows and deadlines never names a column of
 * one kind.
 */
@Injectable()
export class RecordGateway {
  private readonly adapters: Record<RecordKind, RecordAdapter>;

  constructor(petitions: PetitionAdapter, incidents: IncidentAdapter, cases: CaseAdapter) {
    this.adapters = { PETITION: petitions, INCIDENT: incidents, CASE: cases };
  }

  /** The record that is not deleted, or `null`. `tx`: read inside the caller's transaction. */
  load(kind: RecordKind, id: string, tx?: Reader): Promise<RecordSnapshot | null> {
    return this.adapters[kind].load(id, tx);
  }

  /** Writes the deadline column of a record (see `RecordDeadlineWriter`): the one write the gateway does. */
  writeDeadline(kind: RecordKind, id: string, at: Date, tx: Prisma.TransactionClient): Promise<void> {
    return this.adapters[kind].writeDeadline(id, at, tx);
  }

  /** Whether the detail route of that kind would show this record to this person. A missing record: `false`. */
  canRead(kind: RecordKind, id: string, user: GatewayUser, options?: CanReadOptions): Promise<boolean> {
    return this.adapters[kind].canRead(id, user, options);
  }
}
