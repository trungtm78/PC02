import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { recordInActionScope, recordInScope, recordReadable, scopeConditions } from '../common/utils/scope-filter.util';
import { PrismaService } from '../prisma/prisma.service';
import { WARD_ERROR } from './ward-assignment.codes';
import { alertOf, alertWhere, firstSubmittedWhere, type AlertLevel } from './ward-alerts';
import { periodDay } from './ward-stats.service';
import { editableByUnit, submittable } from './ward-assignment.rules';
import { decisionInForce, returnRevocable, timeliness, vnDay } from './ward-review.rules';
import { wardBody } from './ward-errors';

export interface WardAssignmentListQuery {
  /** Code or summary contains (case and accents as written). */
  q?: string;
  status?: 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED';
  /** The archived requests instead of the others. */
  archived?: boolean;
  /** The deadline alert level (`ward-alerts.ts`), judged on today in Viet Nam. */
  alert?: AlertLevel;
  /** The ward unit. */
  teamId?: string;
  crimeId?: string;
  caseType?: 'INCIDENT' | 'CASE';
  kind?: 'NEW' | 'REASSIGN';
  /** Submitted at least once (what the statistics count). */
  submitted?: boolean;
  /** First submitted within [from, to], `YYYY-MM-DD` on the Viet Nam calendar (the period of the statistics). */
  from?: string;
  to?: string;
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

  /** `now`: the clock the alert levels are judged on (the filter and the field of every row use the same "today"). */
  async list(scope: DataScope | null | undefined, query: WardAssignmentListQuery, now: Date = new Date()) {
    const reach = scopeConditions(scope, 'read', 'WardAssignment');
    if (reach !== null && reach.length === 0) return { data: [], total: 0 };
    const today = vnDay(now);
    const q = query.q?.trim();
    const where: Prisma.WardAssignmentWhereInput = {
      AND: [
        ...(reach ? [{ OR: reach as Prisma.WardAssignmentWhereInput[] }] : []),
        query.archived ? { archivedAt: { not: null } } : { archivedAt: null },
        ...(query.status ? [{ status: query.status }] : []),
        ...(query.alert ? [alertWhere(query.alert, today)] : []),
        ...(query.teamId ? [{ assignedTeamId: query.teamId }] : []),
        ...(query.crimeId ? [{ crimeId: query.crimeId }] : []),
        ...(query.caseType ? [{ caseType: query.caseType }] : []),
        ...(query.kind ? [{ kind: query.kind }] : []),
        ...(query.submitted ? [{ submissionCount: { gt: 0 } }] : []),
        firstSubmittedWhere(periodDay(query.from), periodDay(query.to)),
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
    return { data: data.map((row) => ({ ...row, alert: alertOf(row, today) })), total };
  }

  /** The active PC02 units (no ward units) and their active members: who may follow an approval, and in which unit. */
  async followUpChoices() {
    const teams = await this.prisma.team.findMany({ where: { wardId: null, status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
    const members = await this.prisma.userTeam.findMany({
      where: { team: { wardId: null, status: 'ACTIVE' }, user: { isActive: true } },
      select: { teamId: true, user: { select: { id: true, firstName: true, lastName: true, username: true } } },
    });
    const people = new Map<string, { id: string; name: string; unitIds: string[] }>();
    for (const m of members) {
      const name = [m.user.lastName, m.user.firstName].filter(Boolean).join(' ').trim() || m.user.username;
      const person = people.get(m.user.id) ?? { id: m.user.id, name, unitIds: [] };
      person.unitIds.push(m.teamId);
      people.set(m.user.id, person);
    }
    return { teams, people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi')) };
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
        deadlineChanges: { orderBy: { changedAt: 'asc' } },
        reopenings: { orderBy: { reopenedAt: 'asc' } },
        // Named on the request: whoever may read it reads who follows it, without a list of users or teams.
        followUpUser: { select: { id: true, firstName: true, lastName: true, username: true } },
        followUpTeam: { select: { id: true, name: true } },
      },
    });
    if (!row || !recordReadable('WardAssignment', { assignedTeamId: row.assignedTeamId, enteredById: row.enteredById }, scope)) {
      throw new NotFoundException(wardBody(WARD_ERROR.NOT_FOUND));
    }
    const reach = { assignedTeamId: row.assignedTeamId, ownerId: row.enteredById };
    const changes = recordInScope(reach, scope, 'write', 'WardAssignment') && !row.archivedAt;
    const reviews = recordInActionScope(reach, scope, 'WardAssignment', 'review');
    const pending = row.rounds.at(-1)?.status === 'PENDING';
    const lastCounted = [...row.rounds].reverse().find((r) => r.status !== 'WITHDRAWN');
    const inForce = lastCounted ? decisionInForce(lastCounted.decisions) : null;
    // PC02 decides only what is not its own ward unit's (segregation of duties), and nothing of an archived request.
    const member = await this.prisma.userTeam.findFirst({ where: { userId: actorId, teamId: row.assignedTeamId }, select: { userId: true } });
    const decides = reviews && !member && !row.archivedAt;
    const approved = row.status === 'APPROVED';
    // The same predicate as the command: a result file (an active document that is not an issued slip) keeps the approval.
    const resultFiles = approved ? await this.prisma.document.count({ where: { wardAssignmentId: row.id, deletedAt: null, wardSlipOf: null } }) : 0;
    return {
      ...row,
      viewerId: actorId,
      timeliness: row.completedOn && row.resultDueOn ? timeliness(row.completedOn, row.resultDueOn) : null,
      can: {
        returnIt: decides && row.status === 'SUBMITTED' && pending,
        approve: decides && row.status === 'SUBMITTED' && pending,
        revokeReturn: decides && returnRevocable(row, inForce),
        cancelApproval: decides && approved && !row.resultText?.trim() && !row.completedOn && resultFiles === 0,
        followUp: decides && approved && !row.completedOn,
        extend: decides && approved && !row.completedOn,
        complete: decides && approved && !row.completedOn && !!row.resultText,
        reopen: decides && approved && !!row.completedOn,
        // The request slip of a decision: PC02 deciding this request (the slip service checks the same).
        issueSlip: decides,
        deleteWithData: scope === null,
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
