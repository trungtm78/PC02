import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { WardAssignmentStatus, type Prisma } from '@prisma/client';
import type { Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { KHOA_TAT_CA } from '../common/tim-kiem/dieu-kien';
import { BoTimKiem } from '../common/tim-kiem/bo-tim-kiem';
import { KHAI_TIM_KIEM_HO_SO_PHAN_CONG } from '../common/tim-kiem/khai/ho-so-phan-cong.khai';
import { noiVaoWhere } from '../common/tim-kiem/dieu-kien';
import { buildListOrderBy } from '../common/utils/list-sort.util';
import { tachCotXuat } from '../common/xuat-danh-sach/cot-xuat.dto';
import { chonCotXuat, xuatDanhSachExcel } from '../common/xuat-danh-sach/xuat-danh-sach';
import { KHAI_COT_XUAT_HO_SO_PHAN_CONG, WARD_EXPORT_SELECT, type WardExportRow } from './xuat-danh-sach-ho-so-phan-cong';
import type { DataScope } from '../auth/services/unit-scope.service';
import { recordInActionScope, recordInScope } from '../common/utils/scope-filter.util';
import { isIntake, mayEnterFor, wardReadConditions, wardReadable } from './ward-locks';
import { PrismaService } from '../prisma/prisma.service';
import { WARD_ERROR } from './ward-assignment.codes';
import { alertOf, alertWhere, firstSubmittedWhere, type AlertLevel } from './ward-alerts';
import { periodDay } from './ward-stats.service';
import { editableByUnit, submittable } from './ward-assignment.rules';
import { decisionInForce, returnRevocable, timeliness, vnDay } from './ward-review.rules';
import { wardBody } from './ward-errors';

export interface WardAssignmentListQuery {
  /** The tags of the search box (`key~value`), as `common/tim-kiem` reads them. */
  tk?: string[];
  /** The old search box: the tag "every column". */
  q?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
/** The old `q` opens as the tag "every column". */
const OLD_PARAMETERS = { q: KHOA_TAT_CA } as const;
/** The columns the list sorts by (the keys the screen sends). */
const SORTABLE = ['code', 'submittedAt', 'resultDueOn', 'status', 'submissionCount', 'caseType', 'kind', 'summary', 'createdAt'] as const;

/**
 * Reading ward assignment requests: the list and one request, each within the person's read scope. A request they may
 * not read does not exist for them (404). What the person may do with a request is said with it (`can`), from the same
 * rules the commands apply, so the screen offers exactly what the server would accept.
 */
@Injectable()
export class WardAssignmentQueryService {
  private tags?: BoTimKiem;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  /** Made on first use: the search reads the declaration of this list (`khai/ho-so-phan-cong.khai.ts`). */
  private get search(): BoTimKiem {
    return (this.tags ??= new BoTimKiem(this.prisma, KHAI_TIM_KIEM_HO_SO_PHAN_CONG, OLD_PARAMETERS));
  }

  /**
   * The ONE condition of the list, of its cards and of its export: the person's reach, the filters, the tags. Each
   * part is its own member of AND (a search can never widen the reach). `null`: the person reaches nothing.
   * `card`: what a card stands for (a status, or the archived ones), left out by the cards' counts.
   */
  private async where(
    scope: DataScope | null | undefined,
    query: WardAssignmentListQuery,
    today: Date,
    card: { archived: boolean | null; status?: WardAssignmentListQuery['status'] },
  ): Promise<Prisma.WardAssignmentWhereInput | null> {
    const reach = wardReadConditions(scope);
    if (reach !== null && reach.length === 0) return null;
    const where: Prisma.WardAssignmentWhereInput = {
      AND: [
        ...(reach ? [{ OR: reach as Prisma.WardAssignmentWhereInput[] }] : []),
        ...(card.archived === null ? [] : [card.archived ? { archivedAt: { not: null } } : { archivedAt: null }]),
        ...(card.status ? [{ status: card.status }] : []),
        ...(query.alert ? [alertWhere(query.alert, today)] : []),
        ...(query.teamId ? [{ assignedTeamId: query.teamId }] : []),
        ...(query.crimeId ? [{ crimeId: query.crimeId }] : []),
        ...(query.caseType ? [{ caseType: query.caseType }] : []),
        ...(query.kind ? [{ kind: query.kind }] : []),
        ...(query.submitted ? [{ submissionCount: { gt: 0 } }] : []),
        firstSubmittedWhere(periodDay(query.from), periodDay(query.to)),
      ],
    };
    noiVaoWhere(where as Record<string, unknown>, await this.search.dieuKien(query));
    return where;
  }

  /** The order of the list, of its pages and of its export. Nothing asked: the newest submission first, drafts on top. */
  private order(query: Pick<WardAssignmentListQuery, 'sortBy' | 'sortOrder'>): Prisma.WardAssignmentOrderByWithRelationInput[] {
    if (!query.sortBy || !(SORTABLE as readonly string[]).includes(query.sortBy)) {
      return [{ submittedAt: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }, { id: 'desc' }];
    }
    return buildListOrderBy({
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      allowed: SORTABLE,
      defaultField: 'submittedAt',
      // A request with no code, no submission day or no deadline sinks to the end, whichever way the column is sorted.
      nullableFields: ['codeSort', 'submittedAt', 'resultDueOn'],
      // "Mã" orders as a number: as text, 2026-8 comes after 2026-21. The number is kept by a trigger (`codeSort`).
      fieldAliases: { code: 'codeSort' },
    }) as Prisma.WardAssignmentOrderByWithRelationInput[];
  }

  /**
   * The numbers of the cards, counted with the list's own condition minus what a card stands for: every card's
   * number is the number of rows the list shows under it. One request instead of one per card.
   */
  async listStats(scope: DataScope | null | undefined, query: WardAssignmentListQuery, now: Date = new Date()) {
    const byStatus = Object.fromEntries(Object.values(WardAssignmentStatus).map((s) => [s, 0])) as Record<WardAssignmentStatus, number>;
    const filters = query;
    const today = vnDay(now);
    const [open, archived] = await Promise.all([this.where(scope, filters, today, { archived: false }), this.where(scope, filters, today, { archived: true })]);
    if (!open || !archived) return { all: 0, byStatus, archived: 0 };
    const [groups, archivedCount] = await Promise.all([
      this.prisma.wardAssignment.groupBy({ by: ['status'], where: open, _count: { _all: true } }),
      this.prisma.wardAssignment.count({ where: archived }),
    ]);
    for (const g of groups) byStatus[g.status] = g._count._all;
    return { all: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus, archived: archivedCount };
  }

  /**
   * The list as an Excel file: the same condition and the same order as the screen, the columns the person is looking
   * at (`cot`), within their reach. Audited (metadata only: the filters and how many rows).
   */
  async exportList(
    scope: DataScope | null | undefined,
    query: WardAssignmentListQuery & { cot?: string },
    res: Response,
    actor: { userId: string; ipAddress?: string; userAgent?: string },
    now: Date = new Date(),
  ): Promise<void> {
    const columns = chonCotXuat(KHAI_COT_XUAT_HO_SO_PHAN_CONG, tachCotXuat(query.cot));
    const where = (await this.where(scope, query, vnDay(now), { archived: query.archived === true, status: query.status })) ?? { id: { in: [] } };
    const orderBy = this.order(query);
    const rows = await xuatDanhSachExcel<WardExportRow>({
      res,
      tenTep: `ho-so-phan-cong-${now.toISOString().slice(0, 10)}.xlsx`,
      tenSheet: 'Hồ sơ phân công',
      tieuDe: 'DANH SÁCH HỒ SƠ PHÂN CÔNG CÔNG AN CẤP PHƯỜNG/XÃ',
      phuDe: query.from || query.to ? `Trình lần đầu: ${query.from ?? '…'} đến ${query.to ?? '…'}` : '',
      cot: columns,
      demTong: () => this.prisma.wardAssignment.count({ where }),
      layIdTheoThuTu: async (max) => (await this.prisma.wardAssignment.findMany({ where, orderBy, select: { id: true }, take: max })).map((r) => r.id),
      // Read again under the same condition: a request that left the person's reach meanwhile is not written.
      layDong: (ids) => this.prisma.wardAssignment.findMany({ where: { AND: [where, { id: { in: ids } }] }, select: WARD_EXPORT_SELECT }),
    });
    await this.audit?.log({
      userId: actor.userId,
      action: 'WARD_ASSIGNMENT_LIST_EXPORTED',
      subject: 'WardAssignment',
      metadata: { format: 'xlsx', filters: { ...query, cot: undefined }, columns: columns.map((c) => c.key), rows },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }

  /** `now`: the clock the alert levels are judged on (the filter and the field of every row use the same "today"). */
  async list(scope: DataScope | null | undefined, query: WardAssignmentListQuery, now: Date = new Date(), actorId?: string) {
    const today = vnDay(now);
    const where = await this.where(scope, query, today, { archived: query.archived === true, status: query.status });
    if (!where) return { data: [], total: 0, intake: isIntake(scope) };
    const pageSize = Math.min(Math.max(query.pageSize ?? 50, 1), PAGE_SIZE_MAX);
    const page = Math.max(query.page ?? 1, 1);
    const [data, total] = await Promise.all([
      this.prisma.wardAssignment.findMany({
        where,
        orderBy: this.order(query),
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          assignedTeam: { select: { id: true, name: true } },
          crime: { select: { id: true, name: true } },
          // What the row's buttons need: whether it was ever submitted, and the decision whose slip is printed.
          rounds: { select: { decisions: { select: { id: true, kind: true, decidedAt: true, revokedAt: true, slipNumber: true } } } },
        },
      }),
      this.prisma.wardAssignment.count({ where }),
    ]);
    // The person's own units, read once: PC02 does not decide (nor print the slip of) its own ward unit's request.
    const own = actorId ? new Set((await this.prisma.userTeam.findMany({ where: { userId: actorId }, select: { teamId: true } })).map((m) => m.teamId)) : new Set<string>();
    return {
      data: data.map(({ rounds, ...row }) => {
        const reach = { assignedTeamId: row.assignedTeamId, ownerId: row.enteredById };
        const changes = recordInScope(reach, scope, 'write', 'WardAssignment') && !row.archivedAt;
        const decides = recordInActionScope(reach, scope, 'WardAssignment', 'review') && !own.has(row.assignedTeamId) && !row.archivedAt;
        const latest = rounds
          .flatMap((r) => r.decisions)
          .filter((d) => !d.revokedAt)
          .sort((a, b) => b.decidedAt.getTime() - a.decidedAt.getTime())[0];
        return {
          ...row,
          alert: alertOf(row, today),
          // The same rules as `get` (and as the commands): the list offers a button only where the form would.
          can: {
            edit: changes && editableByUnit(row.status),
            delete: changes && row.status === 'DRAFT' && rounds.length === 0,
            issueSlip: decides,
          },
          latestDecision: latest ? { id: latest.id, kind: latest.kind, slipNumber: latest.slipNumber } : null,
        };
      }),
      total,
      intake: isIntake(scope),
    };
  }

  /**
   * The ward units the list's filter offers: those that have a request the person may read (archived ones too), by
   * name. Never a unit the person reaches nothing of: the filter does not say which units exist.
   */
  async filterUnits(scope: DataScope | null | undefined) {
    const reach = wardReadConditions(scope);
    if (reach !== null && reach.length === 0) return [];
    const groups = await this.prisma.wardAssignment.groupBy({ by: ['assignedTeamId'], where: reach ? { OR: reach as Prisma.WardAssignmentWhereInput[] } : {} });
    return this.prisma.team.findMany({ where: { id: { in: groups.map((g) => g.assignedTeamId) } }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  }

  /** The active ward units the person may enter a request for: exactly those `create` accepts (ward unit, write reach). */
  async unitChoices(scope: DataScope | null | undefined) {
    const teams = await this.prisma.team.findMany({ where: { wardId: { not: null }, status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
    return teams.filter((t) => mayEnterFor(t.id, scope));
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
    if (!row || !wardReadable(row, scope)) {
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
      // The shared desk at PC02: the form opens a blank request after a submission, and asks who is entering.
      intake: isIntake(scope),
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
