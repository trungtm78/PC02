import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, WardInvestigator } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { DataScope } from '../auth/services/unit-scope.service';
import { recordInActionScope, teamInScope } from '../common/utils/scope-filter.util';
import { PrismaService } from '../prisma/prisma.service';
import { WARD_AUDIT, WARD_ERROR } from './ward-assignment.codes';
import type { Actor } from './ward-assignment-command.service';
import { lockedWardTeam } from './ward-locks';
import { sameStamp, wardBody } from './ward-errors';

export interface InvestigatorInput {
  /** Two people of one unit may carry the same name: said by the person, never assumed. */
  allowSameName?: boolean;
  fullName?: string;
  rank?: string | null;
  position?: string | null;
  grade?: string | null;
}

const blank = (v: string | null | undefined): string | null | undefined => (v === undefined ? undefined : v?.trim() || null);

/** A name as it is compared: case and spacing do not make another person. */
export const sameNameKey = (name: string): string => name.normalize('NFC').trim().split(/[ \t]+/).join(' ').toLocaleLowerCase('vi');

/**
 * The investigators a ward unit may propose ("ĐTV thừa uỷ quyền"), one list per ward unit. They are not accounts:
 * the unit keeps its own list, shown as "Cấp bậc – Chức vụ – Họ tên".
 *
 * Who keeps a unit's list: whoever may change that unit's requests, and the reviewers of PC02 (who may name an
 * investigator the unit did not propose). Who sees it: whoever may read that unit's requests. A name is never deleted
 * (requests and slips name it); it is stopped and resumed.
 */
@Injectable()
export class WardInvestigatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(scope: DataScope | null | undefined, teamId: string, includeStopped = false): Promise<WardInvestigator[]> {
    if (!teamInScope(teamId, scope, 'read', 'WardAssignment')) throw new ForbiddenException(wardBody(WARD_ERROR.INVESTIGATOR_OUT_OF_REACH));
    return this.prisma.wardInvestigator.findMany({
      where: { teamId, ...(includeStopped ? {} : { isActive: true }) },
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    });
  }

  async create(actor: Actor, scope: DataScope | null | undefined, input: InvestigatorInput & { teamId: string }): Promise<WardInvestigator> {
    const fullName = input.fullName?.trim();
    if (!fullName) throw new BadRequestException(wardBody(WARD_ERROR.INVESTIGATOR_NAME_REQUIRED));
    return this.prisma.$transaction(async (tx) => {
      const team = await lockedWardTeam(tx, input.teamId);
      if (!this.keeps(scope, team.id)) throw new ForbiddenException(wardBody(WARD_ERROR.INVESTIGATOR_OUT_OF_REACH));
      if (!input.allowSameName) await this.refuseSameName(tx, team.id, fullName, null);
      const created = await tx.wardInvestigator.create({
        data: { teamId: team.id, fullName, rank: blank(input.rank) ?? null, position: blank(input.position) ?? null, grade: blank(input.grade) ?? null, createdById: actor.id },
      });
      await this.audit.log({ userId: actor.id, action: WARD_AUDIT.INVESTIGATOR_CREATED, subject: 'WardInvestigator', subjectId: created.id, metadata: { teamId: team.id } }, tx);
      return created;
    });
  }

  async update(actor: Actor, scope: DataScope | null | undefined, id: string, input: InvestigatorInput & { expectedUpdatedAt: string }): Promise<WardInvestigator> {
    const fullName = input.fullName === undefined ? undefined : input.fullName.trim();
    if (fullName === '') throw new BadRequestException(wardBody(WARD_ERROR.INVESTIGATOR_NAME_REQUIRED));
    return this.change(
      actor,
      scope,
      id,
      input.expectedUpdatedAt,
      WARD_AUDIT.INVESTIGATOR_UPDATED,
      {
        ...(fullName !== undefined && { fullName }),
        ...(input.rank !== undefined && { rank: blank(input.rank) }),
        ...(input.position !== undefined && { position: blank(input.position) }),
        ...(input.grade !== undefined && { grade: blank(input.grade) }),
      },
      input.allowSameName === true,
    );
  }

  /** "Ngừng dùng" ⇄ "Dùng lại". */
  async setActive(actor: Actor, scope: DataScope | null | undefined, id: string, active: boolean, expectedUpdatedAt: string): Promise<WardInvestigator> {
    return this.change(actor, scope, id, expectedUpdatedAt, active ? WARD_AUDIT.INVESTIGATOR_REACTIVATED : WARD_AUDIT.INVESTIGATOR_DEACTIVATED, { isActive: active });
  }

  /** One change of one name, only if the form acted on is the one stored. */
  private async change(
    actor: Actor,
    scope: DataScope | null | undefined,
    id: string,
    expectedUpdatedAt: string,
    action: string,
    data: Partial<Pick<WardInvestigator, 'fullName' | 'rank' | 'position' | 'grade' | 'isActive'>>,
    allowSameName = true,
  ): Promise<WardInvestigator> {
    return this.prisma.$transaction(async (tx) => {
      // Locked BEFORE its unit is read: a merge that moves the name to another unit either waits for this transaction or
      // has moved it already, and the reach is checked against the unit it is in now.
      await tx.$queryRaw`SELECT id FROM "ward_investigators" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.wardInvestigator.findUnique({ where: { id } });
      if (!current || !teamInScope(current.teamId, scope, 'read', 'WardAssignment')) throw new NotFoundException(wardBody(WARD_ERROR.INVESTIGATOR_NOT_FOUND));
      if (!this.keeps(scope, current.teamId)) throw new ForbiddenException(wardBody(WARD_ERROR.INVESTIGATOR_OUT_OF_REACH));
      if (!sameStamp(current.updatedAt, expectedUpdatedAt)) throw new ConflictException(wardBody(WARD_ERROR.INVESTIGATOR_CHANGED));
      // Only a name that changes is compared: a rank corrected on a name the unit already has twice is not a new clash.
      if (!allowSameName && data.fullName !== undefined && sameNameKey(data.fullName) !== sameNameKey(current.fullName)) {
        await this.refuseSameName(tx, current.teamId, data.fullName, id);
      }
      await tx.wardInvestigator.update({ where: { id }, data });
      await this.audit.log({ userId: actor.id, action, subject: 'WardInvestigator', subjectId: id, metadata: { teamId: current.teamId, fields: Object.keys(data) } }, tx);
      return tx.wardInvestigator.findUniqueOrThrow({ where: { id } });
    });
  }

  /** 409 with the name's holder when the unit already lists this name (the stopped ones too: they are resumed, not doubled). */
  private async refuseSameName(tx: Prisma.TransactionClient, teamId: string, fullName: string, exceptId: string | null): Promise<void> {
    const key = sameNameKey(fullName);
    const others = await tx.wardInvestigator.findMany({ where: { teamId, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true, fullName: true, isActive: true } });
    const same = others.find((o) => sameNameKey(o.fullName) === key);
    if (same) throw new ConflictException(wardBody(WARD_ERROR.INVESTIGATOR_DUPLICATE, { existingId: same.id, isActive: same.isActive }));
  }

  /** Whoever changes the unit's requests, or reviews them. */
  private keeps(scope: DataScope | null | undefined, teamId: string): boolean {
    return (
      teamInScope(teamId, scope, 'write', 'WardAssignment') ||
      recordInActionScope({ assignedTeamId: teamId, ownerId: null }, scope, 'WardAssignment', 'review')
    );
  }
}
