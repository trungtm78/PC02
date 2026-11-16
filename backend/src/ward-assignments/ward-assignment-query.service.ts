import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { recordInActionScope, recordInScope, recordReadable, scopeConditions } from '../common/utils/scope-filter.util';
import { PrismaService } from '../prisma/prisma.service';
import { WARD_ERROR } from './ward-assignment.codes';
import { editableByUnit, submittable } from './ward-assignment.rules';
import { wardBody } from './ward-errors';

export interface WardAssignmentListQuery {
  /** Code or summary contains (case and accents as written). */
  q?: string;
  status?: 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED';
  /** The archived requests instead of the others. */
  archived?: boolean;
  page?: number;
  pageSize?: number;
}

const PAGE_SIZE_MAX = 200;

/**
 * Reading ward assignment requests: the list and one request, each within the person's read scope. A request they may
 * not read does not exist for them (404). What the person may do with a request is said with it (`can`), from the same
 * rules the commands apply, so the screen offers exactly what the server would accept.
 */
@Injectable()
export class WardAssignmentQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope: DataScope | null | undefined, query: WardAssignmentListQuery) {
    const reach = scopeConditions(scope, 'read', 'WardAssignment');
    if (reach !== null && reach.length === 0) return { data: [], total: 0 };
    const q = query.q?.trim();
    const where: Prisma.WardAssignmentWhereInput = {
      AND: [
        ...(reach ? [{ OR: reach as Prisma.WardAssignmentWhereInput[] }] : []),
        query.archived ? { archivedAt: { not: null } } : { archivedAt: null },
        ...(query.status ? [{ status: query.status }] : []),
        ...(q ? [{ OR: [{ code: { contains: q, mode: 'insensitive' as const } }, { summary: { contains: q, mode: 'insensitive' as const } }] }] : []),
      ],
    };
    const pageSize = Math.min(Math.max(query.pageSize ?? 50, 1), PAGE_SIZE_MAX);
    const page = Math.max(query.page ?? 1, 1);
    const [data, total] = await Promise.all([
      this.prisma.wardAssignment.findMany({
        where,
        orderBy: [{ submittedAt: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { assignedTeam: { select: { id: true, name: true } }, crime: { select: { id: true, name: true } } },
      }),
      this.prisma.wardAssignment.count({ where }),
    ]);
    return { data, total };
  }

  async get(scope: DataScope | null | undefined, actorId: string, id: string) {
    const row = await this.prisma.wardAssignment.findUnique({
      where: { id },
      include: {
        assignedTeam: { select: { id: true, name: true } },
        crime: { select: { id: true, name: true } },
        proposedInvestigator: true,
        assignedInvestigator: true,
        subjects: { orderBy: { position: 'asc' } },
        rounds: { orderBy: { sequence: 'asc' }, include: { decisions: { orderBy: { decidedAt: 'asc' } } } },
      },
    });
    if (!row || !recordReadable('WardAssignment', { assignedTeamId: row.assignedTeamId, enteredById: row.enteredById }, scope)) {
      throw new NotFoundException(wardBody(WARD_ERROR.NOT_FOUND));
    }
    const reach = { assignedTeamId: row.assignedTeamId, ownerId: row.enteredById };
    const changes = recordInScope(reach, scope, 'write', 'WardAssignment') && !row.archivedAt;
    const reviews = recordInActionScope(reach, scope, 'WardAssignment', 'review');
    const pending = row.rounds.at(-1)?.status === 'PENDING';
    return {
      ...row,
      viewerId: actorId,
      can: {
        edit: changes && editableByUnit(row.status),
        submit: changes && submittable(row.status),
        withdraw: changes && row.status === 'SUBMITTED' && pending,
        delete: changes && row.status === 'DRAFT' && row.rounds.length === 0,
        review: reviews,
        archive: reviews && !row.archivedAt && row.rounds.length > 0,
        restore: reviews && !!row.archivedAt,
      },
    };
  }
}
