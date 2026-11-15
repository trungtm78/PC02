import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { userHoldingPermission } from '../../authz/enforcement';
import { PrismaService } from '../../prisma/prisma.service';
import { PROCESSING_ERROR, type ProcessingErrorCode } from '../contract/processing-codes';
import { vietnamDay } from './processing-delegation';
import { displayNameOf } from './record-flow.dto';

const MAX_NOTE = 500;
/** The advisory lock of "the delegations of one person": two creations for the same from-user never interleave. */
const DELEGATION_LOCK = 7_420_011;

const refuse = {
  bad: (code: ProcessingErrorCode) => new BadRequestException({ code }),
  conflict: (code: ProcessingErrorCode) => new ConflictException({ code }),
  notFound: (code: ProcessingErrorCode) => new NotFoundException({ code }),
  forbidden: (code: ProcessingErrorCode) => new ForbiddenException({ code }),
};

export const DELEGATION_STATES = ['IN_FORCE', 'UPCOMING', 'ENDED', 'REVOKED'] as const;
export type DelegationState = (typeof DELEGATION_STATES)[number];

export interface DelegationDto {
  id: string;
  fromUserId: string;
  fromName: string | null;
  toUserId: string;
  toName: string | null;
  validFrom: string;
  validTo: string;
  note: string | null;
  state: DelegationState;
  createdById: string;
  createdAt: string;
  revokedAt: string | null;
  /** Whether THIS reader may revoke it now: its creator or its from-user, while it is in force or upcoming. */
  canRevoke: boolean;
}

export interface DelegationsDto {
  /** The instant the states were judged at. */
  asOf: string;
  given: DelegationDto[];
  received: DelegationDto[];
}

export interface CreateDelegationInput {
  toUserId: string;
  /** `YYYY-MM-DD`, whole days in Vietnam. */
  validFrom: string;
  validTo: string;
  note?: string | null;
  /** Somebody else's work: only for a head of a unit that person belongs to, or a holder of `assign:ProcessingStep`. */
  fromUserId?: string;
}

export interface DelegationCandidateDto {
  userId: string;
  name: string;
}

interface Row {
  id: string;
  fromUserId: string;
  toUserId: string;
  validFrom: Date;
  validTo: Date;
  note: string | null;
  createdById: string;
  createdAt: Date;
  revokedAt: Date | null;
}

export function delegationState(row: { validFrom: Date; validTo: Date; revokedAt: Date | null }, now: Date): DelegationState {
  if (row.revokedAt) return 'REVOKED';
  if (now.getTime() < row.validFrom.getTime()) return 'UPCOMING';
  return now.getTime() > row.validTo.getTime() ? 'ENDED' : 'IN_FORCE';
}

/**
 * Delegation of processing work by date range (R8): a person who will be away lets a colleague act for them. While it
 * is in force the delegate counts as that person on the steps that name them or their unit (`actingFor`).
 *
 * A delegation is never edited: it is revoked and made anew (the history of who acted for whom stays readable).
 *
 * WHO may create one: a person for THEMSELF; for somebody else, a head of an ACTIVE unit that person belongs to, or a
 * holder of `assign:ProcessingStep`. WHO may be the delegate: an ACTIVE person who shares at least one ACTIVE unit with
 * the from-user. WHO may revoke: its creator or its from-user.
 */
@Injectable()
export class ProcessingDelegationService {
  /** The clock, replaceable by a spec. */
  now: () => Date = () => new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The delegations the person gave and the ones they received, newest range first. */
  async mine(userId: string): Promise<DelegationsDto> {
    const now = this.now();
    const rows = await this.prisma.procDelegation.findMany({ where: { OR: [{ fromUserId: userId }, { toUserId: userId }] }, orderBy: [{ validFrom: 'desc' }, { id: 'asc' }], take: 500 });
    const names = await this.namesOf(rows.flatMap((row) => [row.fromUserId, row.toUserId]));
    const dto = (row: Row) => this.toDto(row, now, names, userId);
    return {
      asOf: now.toISOString(),
      given: rows.filter((row) => row.fromUserId === userId).map(dto),
      received: rows.filter((row) => row.toUserId === userId).map(dto),
    };
  }

  /** The people the caller may delegate to: the active members of the caller's active units, without the caller. */
  async candidates(userId: string): Promise<DelegationCandidateDto[]> {
    const members = await this.prisma.userTeam.findMany({
      where: { userId: { not: userId }, user: { isActive: true }, team: { status: 'ACTIVE', members: { some: { userId } } } },
      select: { userId: true, user: { select: { firstName: true, lastName: true, username: true } } },
    });
    const byId = new Map(members.map((member) => [member.userId, displayNameOf(member.user)]));
    return [...byId].map(([id, name]) => ({ userId: id, name })).sort((a, b) => a.name.localeCompare(b.name, 'vi') || a.userId.localeCompare(b.userId));
  }

  async create(actorId: string, input: CreateDelegationInput): Promise<DelegationDto> {
    const now = this.now();
    const fromUserId = typeof input.fromUserId === 'string' && input.fromUserId !== '' ? input.fromUserId : actorId;
    const toUserId = input.toUserId;
    const first = vietnamDay(input.validFrom);
    const last = vietnamDay(input.validTo);
    if (!first || !last || last.end.getTime() < first.start.getTime()) throw refuse.bad(PROCESSING_ERROR.DELEGATION_DATES_INVALID);
    if (last.end.getTime() < now.getTime()) throw refuse.bad(PROCESSING_ERROR.DELEGATION_IN_PAST);
    if (typeof toUserId !== 'string' || toUserId === '' || toUserId === fromUserId) throw refuse.bad(PROCESSING_ERROR.DELEGATE_NOT_ELIGIBLE);
    const note = typeof input.note === 'string' && input.note.trim() !== '' ? input.note.trim().slice(0, MAX_NOTE) : null;

    if (fromUserId !== actorId && !(await this.mayActFor(actorId, fromUserId))) throw refuse.forbidden(PROCESSING_ERROR.DELEGATION_NOT_ALLOWED);

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${DELEGATION_LOCK}::int, hashtext(${fromUserId})::int)`;
      const from = await tx.user.findFirst({ where: { id: fromUserId, isActive: true }, select: { id: true } });
      if (!from) throw refuse.forbidden(PROCESSING_ERROR.DELEGATION_NOT_ALLOWED);
      // The delegate: an active person in at least one ACTIVE unit of the from-user.
      const teammate = await tx.userTeam.findFirst({
        where: { userId: toUserId, user: { isActive: true }, team: { status: 'ACTIVE', members: { some: { userId: fromUserId } } } },
        select: { userId: true },
      });
      if (!teammate) throw refuse.bad(PROCESSING_ERROR.DELEGATE_NOT_ELIGIBLE);
      // Two ranges overlap when each starts before the other ends.
      const overlapping = await tx.procDelegation.count({ where: { fromUserId, revokedAt: null, validFrom: { lte: last.end }, validTo: { gte: first.start } } });
      if (overlapping > 0) throw refuse.conflict(PROCESSING_ERROR.DELEGATION_OVERLAP);
      const created = await tx.procDelegation.create({ data: { fromUserId, toUserId, validFrom: first.start, validTo: last.end, note, createdById: actorId } });
      // Metadata only: who, to whom, which days. The note is a person's words and stays out of the audit.
      await this.audit.log(
        { userId: actorId, action: 'PROC_DELEGATION_CREATED', subject: 'ProcDelegation', subjectId: created.id, metadata: { fromUserId, toUserId, validFrom: input.validFrom, validTo: input.validTo } },
        tx,
      );
      return created;
    });
    return this.toDto(row, now, await this.namesOf([row.fromUserId, row.toUserId]), actorId);
  }

  async revoke(actorId: string, id: string): Promise<DelegationDto> {
    const now = this.now();
    const row = await this.prisma.$transaction(async (tx) => {
      const found = await tx.procDelegation.findUnique({ where: { id } });
      // A delegation that is not the caller's to see answers exactly as one that does not exist.
      if (!found || (found.fromUserId !== actorId && found.toUserId !== actorId && found.createdById !== actorId)) throw refuse.notFound(PROCESSING_ERROR.DELEGATION_NOT_FOUND);
      if (found.createdById !== actorId && found.fromUserId !== actorId) throw refuse.forbidden(PROCESSING_ERROR.DELEGATION_NOT_ALLOWED);
      if (found.revokedAt) throw refuse.conflict(PROCESSING_ERROR.DELEGATION_ALREADY_REVOKED);
      if (delegationState(found, now) === 'ENDED') throw refuse.conflict(PROCESSING_ERROR.DELEGATION_ENDED);
      // The condition is repeated in the write: of two revocations that arrive together, one changes the row.
      const changed = await tx.procDelegation.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now, revokedById: actorId } });
      if (changed.count === 0) throw refuse.conflict(PROCESSING_ERROR.DELEGATION_ALREADY_REVOKED);
      await this.audit.log({ userId: actorId, action: 'PROC_DELEGATION_REVOKED', subject: 'ProcDelegation', subjectId: id, metadata: { fromUserId: found.fromUserId, toUserId: found.toUserId } }, tx);
      return { ...found, revokedAt: now };
    });
    return this.toDto(row, now, await this.namesOf([row.fromUserId, row.toUserId]), actorId);
  }

  /** Whether the actor may delegate the work of ANOTHER person: they head an active unit of that person, or hold `assign`. */
  private async mayActFor(actorId: string, fromUserId: string): Promise<boolean> {
    const heads = await this.prisma.userTeam.count({ where: { userId: actorId, isLeader: true, user: { isActive: true }, team: { status: 'ACTIVE', members: { some: { userId: fromUserId } } } } });
    if (heads > 0) return true;
    return (await this.prisma.user.count({ where: { AND: [{ id: actorId, isActive: true }, userHoldingPermission('assign', 'ProcessingStep')] } })) > 0;
  }

  private async namesOf(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const users = await this.prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true, username: true } });
    return new Map(users.map((user) => [user.id, displayNameOf(user)]));
  }

  private toDto(row: Row, now: Date, names: Map<string, string>, readerId: string): DelegationDto {
    const state = delegationState(row, now);
    return {
      id: row.id,
      fromUserId: row.fromUserId,
      fromName: names.get(row.fromUserId) ?? null,
      toUserId: row.toUserId,
      toName: names.get(row.toUserId) ?? null,
      validFrom: row.validFrom.toISOString(),
      validTo: row.validTo.toISOString(),
      note: row.note,
      state,
      createdById: row.createdById,
      createdAt: row.createdAt.toISOString(),
      revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
      canRevoke: (state === 'IN_FORCE' || state === 'UPCOMING') && (row.createdById === readerId || row.fromUserId === readerId),
    };
  }
}
