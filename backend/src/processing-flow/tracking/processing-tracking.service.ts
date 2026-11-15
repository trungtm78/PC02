import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { CaseGovernanceService } from '../../cases/governance/case-governance.service';
import { buildPetitionScopeFilter, buildScopeFilter } from '../../common/utils/scope-filter.util';
import { PrismaService } from '../../prisma/prisma.service';
import { bandAt, remainingDays } from '../engine/bands';
import { endOfCivilDay, civilDayOf, startOfCivilDay } from '../engine/civil-day';
import type { Band } from '../engine/types';
import { holdsReadPermission, requestScopeOf } from '../gateway/read-access';
import { RECORD_KINDS, type GatewayUser, type RecordKind } from '../gateway/record-snapshot';
import { clocklessStatuses, COUNTED_STEP_STATUSES, finishedStatuses, RECORD_LINK } from '../records/record-alert';
import { actingForIds, delegatesOf } from '../records/processing-delegation';
import { partyNamesUser } from '../records/record-step-access.service';
import { bandConditions, TRACKED_BANDS, type TrackedBand, type WorkRole } from './band-conditions';
import { TRACKING_DEFAULT_PAGE_SIZE, TRACKING_MAX_PAGE_SIZE } from './dto/tracking.dto';

type WorkWhere = Prisma.ProcRecordStepPartyWhereInput;

export interface TrackingFilter {
  asOf?: string;
  mine?: boolean;
  teamId?: string;
  kind?: RecordKind;
  /** The part the unit plays in the step. Left out: MAIN. INFORM is never work. */
  role?: WorkRole;
  /** Only steps that started in this period (`startAt`). A bare day (YYYY-MM-DD) is that civil day in Vietnam. */
  from?: string;
  to?: string;
}

/** For `workWhere`: every piece of work, whatever its band, even one whose step has no deadline. */
export const ANY_WORK = 'ANY' as const;

export interface TrackingSummary {
  /** The instant the counts were judged at: pass it back as `asOf` to open the list of a card. */
  asOf: string;
  counts: Record<TrackedBand, number>;
  /**
   * The RECORDS within the same reach and the same filters whose flow is only a proposal (`confirmed = false`) and
   * still waits for a person to confirm it: the record is not deleted and not finished (a suspended one still waits),
   * whatever the status of its steps. Their work asserts no deadline, so it is in none of the four counts. Counted
   * apart, in records and not in pieces of work.
   */
  unconfirmed: number;
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
  /** Who acts for the responsible person(s) right now under a delegation; `null` when nobody does. */
  delegateName: string | null;
  dueAt: string;
  band: Band;
  /** Civil days left (Vietnam); 0 on the due day, negative after it. */
  remainingDays: number;
}

export interface TrackingItems {
  asOf: string;
  band: Band | null;
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

export const displayName = (user: { firstName: string | null; lastName: string | null; username: string }): string => [user.lastName, user.firstName].filter((part) => part && part.trim() !== '').join(' ') || user.username;

/**
 * The tracking screen ("Theo dõi xử lý"): how much WORK is overdue, red, yellow, green, and which.
 *
 * WORK = a step being worked (OPEN or REPORTED, of a record whose clock runs) x its MAIN party (or, when the filter
 * asks, its CHECK or COORDINATE party; never INFORM). A step with two MAIN
 * parties is two pieces of work; a record with three open steps is three. Steps of a record that is suspended, finished
 * or deleted have no colour and are not counted (the stored alert of their record is empty: `refreshRecordAlert`).
 * Neither are the steps of a flow that is only a PROPOSAL (`confirmed = false`, decision C10): it asserts no deadline
 * until a person confirms it. The records that wait for that are counted apart (`summary.unconfirmed`).
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
    const acting = await this.acting(user);
    const reach = await this.reach(user, filter.kind, acting);
    const counts = { OVERDUE: 0, RED: 0, YELLOW: 0, GREEN: 0 };
    let unconfirmed = 0;
    if (reach) {
      for (const band of TRACKED_BANDS) counts[band] = await this.prisma.procRecordStepParty.count({ where: this.workWhere(user, filter, reach, band, asOf, acting) });
      // The flows nobody has confirmed, whatever their steps and dates say: counted by record.
      unconfirmed = await this.prisma.procRecordFlow.count({ where: { steps: { some: { parties: { some: this.proposalWhere(user, filter, reach, acting) } } } } });
    }
    return { asOf: asOf.toISOString(), counts, unconfirmed };
  }

  async items(user: GatewayUser, filter: TrackingFilter & { band?: Band; page?: number; pageSize?: number }): Promise<TrackingItems> {
    const asOf = this.instant(filter.asOf);
    const page = Math.max(filter.page ?? 1, 1);
    const pageSize = Math.min(Math.max(filter.pageSize ?? TRACKING_DEFAULT_PAGE_SIZE, 1), TRACKING_MAX_PAGE_SIZE);
    const band = filter.band ?? null;
    const empty: TrackingItems = { asOf: asOf.toISOString(), band, items: [], total: 0, page, pageSize };
    const acting = await this.acting(user);
    const reach = await this.reach(user, filter.kind, acting);
    if (!reach) return empty;

    const where = this.workWhere(user, filter, reach, band, asOf, acting);
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
          responsibleName: responsible.get(row.id)?.name ?? null,
          delegateName: responsible.get(row.id)?.delegate ?? null,
          dueAt: step.internalDueAt.toISOString(),
          band: bandAt(asOf, { dueAt: step.internalDueAt, redFrom: step.redFrom, yellowFrom: step.yellowFrom, greenFrom: step.greenFrom }),
          remainingDays: remainingDays(asOf, step.internalDueAt),
        },
      ];
    });
    return { ...empty, items, total };
  }

  /**
   * The people this person acts for NOW (delegations in force at the application clock, never at `asOf`: what a person
   * may see is a question about the present).
   */
  acting(user: GatewayUser): Promise<string[]> {
    return actingForIds(this.prisma, user.id, this.now());
  }

  /**
   * The units the filter of the screen offers: those that hold work (in any colour, now) this person may see. Asked of
   * the same condition as the cards, so a unit offered always has rows, and a person who may not read the list of units
   * of the office still filters their own work. One query, bounded.
   */
  async teams(user: GatewayUser): Promise<TrackingTeam[]> {
    const acting = await this.acting(user);
    const reach = await this.reach(user, undefined, acting);
    if (!reach) return [];
    const teams = await this.prisma.team.findMany({
      where: { procRecordStepParties: { some: this.workWhere(user, {}, reach, null, this.now(), acting) } },
      select: { id: true, name: true, parentId: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: MAX_FILTER_TEAMS,
    });
    return teams.map((team) => ({ id: team.id, name: team.name, parentTeamId: team.parentId }));
  }

  instant(asOf: string | undefined): Date {
    const at = asOf ? new Date(asOf) : this.now();
    return Number.isNaN(at.getTime()) ? this.now() : at;
  }

  /**
   * THE condition of a piece of work in a band (`null`: any colour) at `asOf`, for these filters and this person.
   * `summary` and `items` both build their queries here and nowhere else.
   */
  workWhere(user: GatewayUser, filter: TrackingFilter, reach: WorkWhere, band: Band | null | typeof ANY_WORK, asOf: Date, acting: readonly string[] = []): WorkWhere {
    const parts: WorkWhere[] = [
      { role: filter.role ?? 'MAIN' },
      // A step being worked, of a record whose clock runs. Asked of the record, its pauses and its flow as they are NOW,
      // not of the stored alert: a record's own service finishes, suspends or deletes it without telling the flow, and
      // the stored alert follows only at the worker's next look.
      { recordStep: { status: { in: [...COUNTED_STEP_STATUSES] }, recordFlow: clockRuns(), ...(filter.kind ? { recordKind: filter.kind } : {}) } },
      reach,
    ];
    if (band !== ANY_WORK) parts.push({ recordStep: bandConditions(band, asOf).step });
    const started = periodOf(filter.from, filter.to);
    if (started) parts.push({ recordStep: { startAt: started } });
    if (filter.teamId) parts.push({ teamId: filter.teamId });
    if (filter.mine) parts.push(mineWhere(user.id, acting));
    return { AND: parts };
  }

  /**
   * A party row through which a flow that is only a PROPOSAL is found, for these filters and this person. NOT a piece
   * of work: a proposal waits to be confirmed whether or not a step of it is being worked (its steps may all still
   * wait for a date nobody has recorded), so no status of a step and no date is asked.
   *
   * `reach` is the very condition of the cards, unchanged: it is written over party rows and asks nothing of a step's
   * status, so the record must be in the person's scope, or THIS step must name the person or a unit of theirs. The
   * unit and "my work" filters ask for a MAIN party of any step; without them any party row of the flow will do.
   */
  proposalWhere(user: GatewayUser, filter: TrackingFilter, reach: WorkWhere, acting: readonly string[] = []): WorkWhere {
    const parts: WorkWhere[] = [{ recordStep: { recordFlow: awaitsConfirmation(), ...(filter.kind ? { recordKind: filter.kind } : {}) } }, reach];
    if (filter.teamId || filter.mine) parts.push({ role: 'MAIN' });
    if (filter.teamId) parts.push({ teamId: filter.teamId });
    if (filter.mine) parts.push(mineWhere(user.id, acting));
    return { AND: parts };
  }

  /**
   * What this person may see, as a condition over the work rows; `null` when it is nothing at all (no kind of record
   * they may read). See the class comment for the rule.
   */
  async reach(user: GatewayUser, only?: RecordKind, acting: readonly string[] = []): Promise<WorkWhere | null> {
    const scopes = await this.recordScopes(user, only);
    const byStep: WorkWhere = { recordStep: { parties: { some: partyNamesUser(user.id, acting) } } };
    const record = (kind: RecordKind, where: object): WorkWhere => ({ recordStep: { recordKind: kind, recordFlow: { [RECORD_LINK[kind].relation]: { is: where } } } });
    const branches: WorkWhere[] = [];
    for (const kind of RECORD_KINDS) {
      const scope = scopes[kind];
      if (!scope) continue;
      branches.push(record(kind, scope.inScope));
      if (scope.viaStep) branches.push({ AND: [byStep, record(kind, scope.viaStep)] });
    }
    return branches.length > 0 ? { OR: branches } : null;
  }

  /**
   * Per kind of record the person may read at all: `inScope`, the condition of the RECORDS within the person's own
   * scope (exactly the filter the list of that kind applies), and `viaStep`, the condition a record must still meet
   * when it is reached through a step instead (`null`: the scope is unrestricted already, a second reason adds nothing).
   * A kind the person may not read is absent. `reach` is built from this and nothing else; so is every count of records
   * that have no step to be reached by (the backlog's "no flow yet" column uses `inScope` alone).
   */
  async recordScopes(user: GatewayUser, only?: RecordKind): Promise<Partial<Record<RecordKind, { inScope: object; viaStep: object | null }>>> {
    const scope = await requestScopeOf(this.scopes, user);
    const found: Partial<Record<RecordKind, { inScope: object; viaStep: object | null }>> = {};

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
        found.CASE = { inScope: { AND: [inScope, requestScope ?? {}] }, viaStep: policyOnly };
        continue;
      }
      const subject = kind === 'PETITION' ? 'Petition' : 'Incident';
      if (!(await holdsReadPermission(this.prisma, user.id, subject))) continue;
      const scopeFilter = kind === 'PETITION' ? buildPetitionScopeFilter(scope, 'read') : buildScopeFilter(scope, 'read', 'Incident');
      // Unrestricted already: the second reason adds nothing.
      found[kind] = { inScope: { AND: [{ deletedAt: null }, scopeFilter ?? {}] }, viaStep: scopeFilter ? { deletedAt: null } : null };
    }
    return found;
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

  /**
   * Who answers for each row of a page: the person named, otherwise the heads of the unit; and who acts for them now
   * (the shared resolver `delegatesOf`). A fixed number of queries for the page.
   */
  private async responsibleNames(rows: Array<{ id: string; teamId: string | null; assigneeUserId: string | null }>): Promise<Map<string, { name: string; delegate: string | null }>> {
    const assignees = [...new Set(rows.flatMap((row) => (row.assigneeUserId ? [row.assigneeUserId] : [])))];
    const teams = [...new Set(rows.flatMap((row) => (!row.assigneeUserId && row.teamId ? [row.teamId] : [])))];
    const select = { id: true, firstName: true, lastName: true, username: true } as const;
    const people = assignees.length > 0 ? await this.prisma.user.findMany({ where: { id: { in: assignees } }, select }) : [];
    const heads = teams.length > 0
      ? await this.prisma.userTeam.findMany({ where: { teamId: { in: teams }, isLeader: true, user: { isActive: true } }, select: { teamId: true, user: { select } }, orderBy: [{ teamId: 'asc' }, { userId: 'asc' }] })
      : [];
    const nameOf = new Map(people.map((person) => [person.id, displayName(person)]));
    const headsOf = new Map<string, Array<{ id: string; name: string }>>();
    for (const head of heads) headsOf.set(head.teamId, [...(headsOf.get(head.teamId) ?? []), { id: head.user.id, name: displayName(head.user) }]);

    const given = await delegatesOf(this.prisma, [...assignees, ...heads.map((head) => head.user.id)], this.now());
    const delegateIds = [...new Set([...given.values()].map((delegate) => delegate.toUserId))];
    const delegates = delegateIds.length > 0 ? await this.prisma.user.findMany({ where: { id: { in: delegateIds } }, select }) : [];
    const delegateNameOf = new Map(delegates.map((person) => [person.id, displayName(person)]));
    const actingFor = (ids: string[]): string | null => {
      const names = [...new Set(ids.flatMap((id) => { const delegate = given.get(id); const name = delegate ? delegateNameOf.get(delegate.toUserId) : undefined; return name ? [name] : []; }))];
      return names.length > 0 ? names.join(', ') : null;
    };

    const result = new Map<string, { name: string; delegate: string | null }>();
    for (const row of rows) {
      const unitHeads = !row.assigneeUserId && row.teamId ? (headsOf.get(row.teamId) ?? []) : [];
      const name = row.assigneeUserId ? nameOf.get(row.assigneeUserId) : unitHeads.map((head) => head.name).join(', ') || undefined;
      if (name) result.set(row.id, { name, delegate: actingFor(row.assigneeUserId ? [row.assigneeUserId] : unitHeads.map((head) => head.id)) });
    }
    return result;
  }
}

/**
 * "My work": the person is named on it, or nobody is and the person heads the (active) unit that holds it. The same
 * rule as the reminders of a step: the person named, otherwise the heads of the unit.
 */
export function mineWhere(userId: string, acting: readonly string[] = []): WorkWhere {
  // The work of a person this one acts for (a delegation in force) is theirs too, by the same rule.
  const ids = [userId, ...acting];
  return { OR: [{ assigneeUserId: { in: ids } }, { assigneeUserId: null, team: { status: 'ACTIVE', members: { some: { userId: { in: ids }, isLeader: true } } } }] };
}

/**
 * A period as a condition over a stored instant; `null` when neither end is given. A bare day is the civil day in
 * Vietnam: `from` its first instant, `to` its last. An end that is not a date is ignored (the DTO refuses it earlier).
 */
export function periodOf(from: string | undefined, to: string | undefined): { gte?: Date; lte?: Date } | null {
  const bare = (text: string) => /^\d{4}-\d{2}-\d{2}$/.test(text);
  const instant = (text: string | undefined, end: boolean): Date | undefined => {
    if (!text) return undefined;
    // A bare day parses as midnight UTC, which is 07:00 of the same civil day in Vietnam.
    const at = new Date(text);
    if (Number.isNaN(at.getTime())) return undefined;
    if (!bare(text)) return at;
    return end ? endOfCivilDay(civilDayOf(at)) : startOfCivilDay(civilDayOf(at));
  };
  const [gte, lte] = [instant(from, false), instant(to, true)];
  if (!gte && !lte) return null;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}

/**
 * A flow that is only a proposal, of a record that is not deleted and not finished: it waits for a person to confirm
 * it. A suspended record, or a paused clock, changes nothing to that: the flow is still to be decided.
 */
function awaitsConfirmation(): Prisma.ProcRecordFlowWhereInput {
  const alive = (kind: RecordKind) => ({ [RECORD_LINK[kind].relation]: { is: { deletedAt: null, status: { notIn: finishedStatuses(kind) } } } });
  return { confirmed: false, OR: RECORD_KINDS.map(alive) } as Prisma.ProcRecordFlowWhereInput;
}

/**
 * The CONFIRMED flow of a record that is alive and at work, with no pause open: the only flows whose steps count down.
 * A flow that is only a proposal asserts no deadline (decision C10).
 */
export function clockRuns(): Prisma.ProcRecordFlowWhereInput {
  const atWork = (kind: RecordKind) => ({ [RECORD_LINK[kind].relation]: { is: { deletedAt: null, status: { notIn: clocklessStatuses(kind) } } } });
  return { confirmed: true, pauses: { none: { to: null } }, OR: RECORD_KINDS.map(atWork) } as Prisma.ProcRecordFlowWhereInput;
}
