import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { CaseGovernanceService } from '../../cases/governance/case-governance.service';
import { buildPetitionScopeFilter, buildScopeFilter } from '../../common/utils/scope-filter.util';
import { PrismaService } from '../../prisma/prisma.service';
import { bandAt, remainingDays } from '../engine/bands';
import type { Band } from '../engine/types';
import { holdsReadPermission, requestScopeOf } from '../gateway/read-access';
import { RECORD_KINDS, type GatewayUser, type RecordKind } from '../gateway/record-snapshot';
import { clocklessStatuses, COUNTED_STEP_STATUSES, RECORD_LINK } from '../records/record-alert';
import { partyNamesUser } from '../records/record-step-access.service';
import { bandConditions, TRACKED_BANDS, type TrackedBand } from './band-conditions';
import { TRACKING_DEFAULT_PAGE_SIZE, TRACKING_MAX_PAGE_SIZE } from './dto/tracking.dto';

type WorkWhere = Prisma.ProcRecordStepPartyWhereInput;

export interface TrackingFilter {
  asOf?: string;
  mine?: boolean;
  teamId?: string;
  kind?: RecordKind;
}

export interface TrackingSummary {
  /** The instant the counts were judged at: pass it back as `asOf` to open the list of a card. */
  asOf: string;
  counts: Record<TrackedBand, number>;
}

export interface TrackingItem {
  /**
   * The identity of this piece of work: the id of the party row. A step with two MAIN parties is two rows that share
   * the record and the step, so only this tells them apart (the screen keys its rows by it).
   */
  id: string;
  recordKind: RecordKind;
  recordId: string;
  /** The number people know the record by: a petition's `stt`, an incident's `code`, a case's `caseCode`. */
  recordCode: string | null;
  /** The name next to it on the list: the sender of a petition, the name of an incident. `null` for a case. */
  recordLabel: string | null;
  stepKey: string;
  stepName: string;
  /** The unit that works the step as its MAIN party; `null` while the record has no unit. */
  teamId: string | null;
  teamName: string | null;
  /** The person named on the work, when one is. */
  assigneeUserId: string | null;
  /** Who answers for it: the person named, otherwise the head(s) of the unit. `null` when there is neither. */
  responsibleName: string | null;
  dueAt: string;
  band: Band;
  /** Civil days left (Vietnam); 0 on the due day, negative after it. */
  remainingDays: number;
}

export interface TrackingItems {
  asOf: string;
  band: TrackedBand | null;
  items: TrackingItem[];
  total: number;
  page: number;
  pageSize: number;
}

const ITEM_SELECT = {
  id: true,
  teamId: true,
  assigneeUserId: true,
  team: { select: { name: true } },
  recordStep: {
    select: { stepKey: true, recordKind: true, recordId: true, internalDueAt: true, redFrom: true, yellowFrom: true, greenFrom: true, step: { select: { name: true } } },
  },
} satisfies Prisma.ProcRecordStepPartySelect;

const displayName = (user: { firstName: string | null; lastName: string | null; username: string }): string => [user.lastName, user.firstName].filter((part) => part && part.trim() !== '').join(' ') || user.username;

/**
 * The tracking screen ("Theo dõi xử lý"): how much WORK is overdue, red, yellow, green, and which.
 *
 * WORK = a step being worked (OPEN or REPORTED, of a record whose clock runs) x its MAIN party. A step with two MAIN
 * parties is two pieces of work; a record with three open steps is three. Steps of a record that is suspended, finished
 * or deleted have no colour and are not counted (the stored alert of their record is empty: `refreshRecordAlert`).
 *
 * ONE condition serves the cards and the list (`workWhere`), judged at ONE instant: the counts of `summary` and the
 * `total` of `items` for the same filters and the same `asOf` are the same query with a different band.
 *
 * WHAT A PERSON SEES (`reach`). A piece of work is shown only when its RECORD may be read by that person, by the
 * record's own rules, expressed as conditions of the same query (never row by row):
 *
 *   - the person holds `read` on the kind of record, and the record is not deleted, and
 *   - the record is within the scope of the person (exactly the filter the list of that kind applies), or the STEP of
 *     this work names the person or an active unit of theirs (the rule by which that unit opens the record read-only), and
 *   - for a case, the governance rules as well (sensitivity, representation), which the step never lifts.
 */
/** A unit of the filter of the tracking screen. */
export interface TrackingTeam {
  id: string;
  name: string;
  parentTeamId: string | null;
}

/** More units than this hold work only in a broken configuration; the filter is a short list. */
const MAX_FILTER_TEAMS = 500;

@Injectable()
export class ProcessingTrackingService {
  /** The clock, replaceable by a spec. */
  now: () => Date = () => new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: UnitScopeService,
  ) {}

  async summary(user: GatewayUser, filter: TrackingFilter): Promise<TrackingSummary> {
    const asOf = this.instant(filter.asOf);
    const reach = await this.reach(user, filter.kind);
    const counts = { OVERDUE: 0, RED: 0, YELLOW: 0, GREEN: 0 };
    if (reach) {
      for (const band of TRACKED_BANDS) counts[band] = await this.prisma.procRecordStepParty.count({ where: this.workWhere(user, filter, reach, band, asOf) });
    }
    return { asOf: asOf.toISOString(), counts };
  }

  async items(user: GatewayUser, filter: TrackingFilter & { band?: TrackedBand; page?: number; pageSize?: number }): Promise<TrackingItems> {
    const asOf = this.instant(filter.asOf);
    const page = Math.max(filter.page ?? 1, 1);
    const pageSize = Math.min(Math.max(filter.pageSize ?? TRACKING_DEFAULT_PAGE_SIZE, 1), TRACKING_MAX_PAGE_SIZE);
    const band = filter.band ?? null;
    const empty: TrackingItems = { asOf: asOf.toISOString(), band, items: [], total: 0, page, pageSize };
    const reach = await this.reach(user, filter.kind);
    if (!reach) return empty;

    const where = this.workWhere(user, filter, reach, band, asOf);
    const [rows, total] = await Promise.all([
      this.prisma.procRecordStepParty.findMany({
        where,
        select: ITEM_SELECT,
        // The most urgent first: the earliest deadline. The id settles ties, so a page never repeats or skips a row.
        orderBy: [{ recordStep: { internalDueAt: 'asc' } }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.procRecordStepParty.count({ where }),
    ]);

    const names = await this.recordNames(rows.map((row) => ({ kind: row.recordStep.recordKind, id: row.recordStep.recordId })));
    const responsible = await this.responsibleNames(rows);
    const items = rows.flatMap((row): TrackingItem[] => {
      const { recordStep: step } = row;
      // Every row matched a band, so it has all four instants; a row without them is not shown rather than guessed.
      if (!step.internalDueAt || !step.redFrom || !step.yellowFrom || !step.greenFrom) return [];
      const name = names.get(`${step.recordKind}:${step.recordId}`);
      return [
        {
          id: row.id,
          recordKind: step.recordKind,
          recordId: step.recordId,
          recordCode: name?.code ?? null,
          recordLabel: name?.label ?? null,
          stepKey: step.stepKey,
          stepName: step.step.name,
          teamId: row.teamId,
          teamName: row.team?.name ?? null,
          assigneeUserId: row.assigneeUserId,
          responsibleName: responsible.get(row.id) ?? null,
          dueAt: step.internalDueAt.toISOString(),
          band: bandAt(asOf, { dueAt: step.internalDueAt, redFrom: step.redFrom, yellowFrom: step.yellowFrom, greenFrom: step.greenFrom }),
          remainingDays: remainingDays(asOf, step.internalDueAt),
        },
      ];
    });
    return { ...empty, items, total };
  }

  /**
   * The units the filter of the screen offers: those that hold work (in any colour, now) this person may see. Asked of
   * the same condition as the cards, so a unit offered always has rows, and a person who may not read the list of units
   * of the office still filters their own work. One query, bounded.
   */
  async teams(user: GatewayUser): Promise<TrackingTeam[]> {
    const reach = await this.reach(user);
    if (!reach) return [];
    const teams = await this.prisma.team.findMany({
      where: { procRecordStepParties: { some: this.workWhere(user, {}, reach, null, this.now()) } },
      select: { id: true, name: true, parentId: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: MAX_FILTER_TEAMS,
    });
    return teams.map((team) => ({ id: team.id, name: team.name, parentTeamId: team.parentId }));
  }

  private instant(asOf: string | undefined): Date {
    const at = asOf ? new Date(asOf) : this.now();
    return Number.isNaN(at.getTime()) ? this.now() : at;
  }

  /**
   * THE condition of a piece of work in a band (`null`: any colour) at `asOf`, for these filters and this person.
   * `summary` and `items` both build their queries here and nowhere else.
   */
  workWhere(user: GatewayUser, filter: TrackingFilter, reach: WorkWhere, band: Band | null, asOf: Date): WorkWhere {
    const parts: WorkWhere[] = [
      { role: 'MAIN' },
      // A step being worked, of a record whose clock runs. Asked of the record and its pauses as they are NOW, not of the
      // stored alert: a record's own service finishes, suspends or deletes it without telling the flow, and the stored
      // alert follows only at the worker's next look.
      { recordStep: { status: { in: [...COUNTED_STEP_STATUSES] }, recordFlow: clockRuns(), ...(filter.kind ? { recordKind: filter.kind } : {}) } },
      { recordStep: bandConditions(band, asOf).step },
      reach,
    ];
    if (filter.teamId) parts.push({ teamId: filter.teamId });
    if (filter.mine) parts.push(mineWhere(user.id));
    return { AND: parts };
  }

  /**
   * What this person may see, as a condition over the work rows; `null` when it is nothing at all (no kind of record
   * they may read). See the class comment for the rule.
   */
  async reach(user: GatewayUser, only?: RecordKind): Promise<WorkWhere | null> {
    const scope = await requestScopeOf(this.scopes, user);
    const byStep: WorkWhere = { recordStep: { parties: { some: partyNamesUser(user.id) } } };
    const record = (kind: RecordKind, where: object): WorkWhere => ({ recordStep: { recordKind: kind, recordFlow: { [RECORD_LINK[kind].relation]: { is: where } } } });
    const branches: WorkWhere[] = [];

    for (const kind of RECORD_KINDS) {
      if (only && only !== kind) continue;
      if (kind === 'CASE') {
        // Built by hand exactly as the case services do: it holds no state, and asks the process's enforcement itself.
        const governance = new CaseGovernanceService(this.prisma);
        let inScope: Prisma.CaseWhereInput;
        let policyOnly: Prisma.CaseWhereInput;
        try {
          // 'view': a row shows the step of a case, which the detail route (`assertCaseReadable`) guards with it.
          inScope = await governance.readableCaseWhere(this.prisma, { actorId: user.id }, { representationCapability: 'view' });
          policyOnly = await governance.readableCaseWhere(this.prisma, { actorId: user.id }, { representationCapability: 'view', withoutScope: true });
        } catch (error) {
          // No `read:Case` (or not an active person): no case at all.
          if (error instanceof ForbiddenException) continue;
          throw error;
        }
        // The list of cases applies the scope of the request on top of the governance scope; so does this.
        const requestScope = buildScopeFilter(scope, 'read', 'Case');
        branches.push(record('CASE', { AND: [inScope, requestScope ?? {}] }));
        branches.push({ AND: [byStep, record('CASE', policyOnly)] });
        continue;
      }
      const subject = kind === 'PETITION' ? 'Petition' : 'Incident';
      if (!(await holdsReadPermission(this.prisma, user.id, subject))) continue;
      const scopeFilter = kind === 'PETITION' ? buildPetitionScopeFilter(scope, 'read') : buildScopeFilter(scope, 'read', 'Incident');
      branches.push(record(kind, { AND: [{ deletedAt: null }, scopeFilter ?? {}] }));
      // Unrestricted already: the second reason adds nothing.
      if (scopeFilter) branches.push({ AND: [byStep, record(kind, { deletedAt: null })] });
    }
    return branches.length > 0 ? { OR: branches } : null;
  }

  /** The code and the name of the records of a page: one query per kind present. */
  private async recordNames(records: Array<{ kind: RecordKind; id: string }>): Promise<Map<string, { code: string | null; label: string | null }>> {
    const ids = (kind: RecordKind) => [...new Set(records.filter((record) => record.kind === kind).map((record) => record.id))];
    const names = new Map<string, { code: string | null; label: string | null }>();
    const [petitions, incidents, cases] = [ids('PETITION'), ids('INCIDENT'), ids('CASE')];
    if (petitions.length > 0) {
      for (const row of await this.prisma.petition.findMany({ where: { id: { in: petitions } }, select: { id: true, stt: true, senderName: true } })) names.set(`PETITION:${row.id}`, { code: row.stt, label: row.senderName });
    }
    if (incidents.length > 0) {
      for (const row of await this.prisma.incident.findMany({ where: { id: { in: incidents } }, select: { id: true, code: true, name: true } })) names.set(`INCIDENT:${row.id}`, { code: row.code, label: row.name });
    }
    if (cases.length > 0) {
      // The code only: the name of a case is a field its own schema may restrict, and that policy is not asked here.
      for (const row of await this.prisma.case.findMany({ where: { id: { in: cases } }, select: { id: true, caseCode: true } })) names.set(`CASE:${row.id}`, { code: row.caseCode, label: null });
    }
    return names;
  }

  /** Who answers for each row of a page: the person named, otherwise the heads of the unit. Two queries for the page. */
  private async responsibleNames(rows: Array<{ id: string; teamId: string | null; assigneeUserId: string | null }>): Promise<Map<string, string>> {
    const assignees = [...new Set(rows.flatMap((row) => (row.assigneeUserId ? [row.assigneeUserId] : [])))];
    const teams = [...new Set(rows.flatMap((row) => (!row.assigneeUserId && row.teamId ? [row.teamId] : [])))];
    const select = { id: true, firstName: true, lastName: true, username: true } as const;
    const people = assignees.length > 0 ? await this.prisma.user.findMany({ where: { id: { in: assignees } }, select }) : [];
    const heads = teams.length > 0
      ? await this.prisma.userTeam.findMany({ where: { teamId: { in: teams }, isLeader: true, user: { isActive: true } }, select: { teamId: true, user: { select } }, orderBy: [{ teamId: 'asc' }, { userId: 'asc' }] })
      : [];
    const nameOf = new Map(people.map((person) => [person.id, displayName(person)]));
    const headsOf = new Map<string, string[]>();
    for (const head of heads) headsOf.set(head.teamId, [...(headsOf.get(head.teamId) ?? []), displayName(head.user)]);

    const result = new Map<string, string>();
    for (const row of rows) {
      const name = row.assigneeUserId ? nameOf.get(row.assigneeUserId) : row.teamId ? headsOf.get(row.teamId)?.join(', ') : undefined;
      if (name) result.set(row.id, name);
    }
    return result;
  }
}

/**
 * "My work": the person is named on it, or nobody is and the person heads the (active) unit that holds it. The same
 * rule as the reminders of a step: the person named, otherwise the heads of the unit.
 */
export function mineWhere(userId: string): WorkWhere {
  return { OR: [{ assigneeUserId: userId }, { assigneeUserId: null, team: { status: 'ACTIVE', members: { some: { userId, isLeader: true } } } }] };
}

/** The flow of a record that is alive and at work, with no pause open: the only flows whose steps count down. */
function clockRuns(): Prisma.ProcRecordFlowWhereInput {
  const atWork = (kind: RecordKind) => ({ [RECORD_LINK[kind].relation]: { is: { deletedAt: null, status: { notIn: clocklessStatuses(kind) } } } });
  return { pauses: { none: { to: null } }, OR: RECORD_KINDS.map(atWork) } as Prisma.ProcRecordFlowWhereInput;
}
