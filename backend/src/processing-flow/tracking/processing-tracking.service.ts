import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { CaseFieldSchemaService } from '../../cases/governance/case-field-schema.service';
import { CaseGovernanceService } from '../../cases/governance/case-governance.service';
import { isPublishedFieldSchema, nativePolicyAliases } from '../../cases/governance/case-native-field-policy';
import { userHoldingPermission } from '../../authz/enforcement';
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
import { AWAITING_APPROVAL, TRACKING_DEFAULT_PAGE_SIZE, TRACKING_MAX_PAGE_SIZE, TRACKING_SEARCH_MAX, TRACKING_SEARCH_MIN } from './dto/tracking.dto';

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
  /** The search box: a part of the record's code or of its label (`searchWhere`). Shorter than two characters: no search. */
  q?: string;
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
  /**
   * The work that waits for THIS person's decision (`awaitingWhere`): the rows `items` lists with `awaiting=approval`
   * for the same filters. 0 for a person who does not hold `approve:ProcessingStep`.
   */
  awaitingMyApproval: number;
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
  /** `null` only on the list of `awaiting=approval`: a step with no deadline still waits for a decision. */
  dueAt: string | null;
  band: Band;
  /** Civil days left (Vietnam); 0 on the due day, negative after it. `null` with `dueAt`. */
  remainingDays: number | null;
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
/** What a person reaches of the records of one kind: see `ProcessingTrackingService.recordScopes`. */
export interface RecordScope {
  inScope: object;
  viaStep: object | null;
  onList: object;
}

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
    const search = await this.searchFor(user, filter.q);
    const counts = { OVERDUE: 0, RED: 0, YELLOW: 0, GREEN: 0 };
    let unconfirmed = 0;
    // Its own reach (the record's scope alone), so it is asked whether or not the cards have anything.
    const awaiting = await this.awaitingWhere(user, filter);
    const awaitingMyApproval = awaiting ? await this.prisma.procRecordStepParty.count({ where: awaiting }) : 0;
    if (reach) {
      for (const band of TRACKED_BANDS) counts[band] = await this.prisma.procRecordStepParty.count({ where: this.workWhere(user, filter, reach, band, asOf, acting, search) });
      // The flows nobody has confirmed, whatever their steps and dates say: counted by record.
      unconfirmed = await this.prisma.procRecordFlow.count({ where: { steps: { some: { parties: { some: this.proposalWhere(user, filter, reach, acting, search) } } } } });
    }
    return { asOf: asOf.toISOString(), counts, unconfirmed, awaitingMyApproval };
  }

  async items(user: GatewayUser, filter: TrackingFilter & { band?: Band; awaiting?: typeof AWAITING_APPROVAL; page?: number; pageSize?: number }): Promise<TrackingItems> {
    const asOf = this.instant(filter.asOf);
    const page = Math.max(filter.page ?? 1, 1);
    const pageSize = Math.min(Math.max(filter.pageSize ?? TRACKING_DEFAULT_PAGE_SIZE, 1), TRACKING_MAX_PAGE_SIZE);
    const awaiting = filter.awaiting === AWAITING_APPROVAL;
    // The list of the card "waiting for my approval" has no band: a step waits whatever its colour.
    const band = awaiting ? null : (filter.band ?? null);
    const empty: TrackingItems = { asOf: asOf.toISOString(), band, items: [], total: 0, page, pageSize };
    let where: WorkWhere;
    if (awaiting) {
      const waiting = await this.awaitingWhere(user, filter);
      if (!waiting) return empty;
      where = waiting;
    } else {
      const acting = await this.acting(user);
      const reach = await this.reach(user, filter.kind, acting);
      if (!reach) return empty;
      where = this.workWhere(user, filter, reach, band, asOf, acting, await this.searchFor(user, filter.q));
    }
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

    const names = await this.recordNames(user, rows.map((row) => ({ kind: row.recordStep.recordKind, id: row.recordStep.recordId })));
    const responsible = await this.responsibleNames(rows);
    const items = rows.flatMap((row): TrackingItem[] => {
      const { recordStep: step } = row;
      const timed = step.internalDueAt && step.redFrom && step.yellowFrom && step.greenFrom ? { dueAt: step.internalDueAt, redFrom: step.redFrom, yellowFrom: step.yellowFrom, greenFrom: step.greenFrom } : null;
      // A row that matched a band has all four instants; one without them is not shown rather than guessed. Only the
      // list of work waiting for a decision has rows with no deadline: they are shown, with no colour.
      if (!timed && !awaiting) return [];
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
          dueAt: timed ? timed.dueAt.toISOString() : null,
          band: timed ? bandAt(asOf, timed) : 'NONE',
          remainingDays: timed ? remainingDays(asOf, timed.dueAt) : null,
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
   * The units the filter of the screen offers: those that hold work (in any colour, now) this person may see, in the
   * ROLE the screen lists (MAIN when none is said), or, with the card "waiting for my approval", that work. Asked of
   * the same condition as the cards, so a unit offered always has rows, and a person who may not read the list of units
   * of the office still filters their own work. One query, bounded.
   */
  async teams(user: GatewayUser, filter: { role?: WorkRole; awaiting?: typeof AWAITING_APPROVAL } = {}): Promise<TrackingTeam[]> {
    let work: WorkWhere;
    if (filter.awaiting === AWAITING_APPROVAL) {
      // The card "waiting for my approval" is chosen: the units of exactly that work.
      const waiting = await this.awaitingWhere(user, { role: filter.role });
      if (!waiting) return [];
      work = waiting;
    } else {
      const acting = await this.acting(user);
      const reach = await this.reach(user, undefined, acting);
      if (!reach) return [];
      // The role of the screen: a unit that only checks, or only coordinates, is offered when that work is listed.
      work = this.workWhere(user, { role: filter.role }, reach, null, this.now(), acting);
    }
    const teams = await this.prisma.team.findMany({
      where: { procRecordStepParties: { some: work } },
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
  workWhere(user: GatewayUser, filter: TrackingFilter, reach: WorkWhere, band: Band | null | typeof ANY_WORK, asOf: Date, acting: readonly string[] = [], search: WorkWhere | null = null): WorkWhere {
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
    if (search) parts.push(search);
    return { AND: parts };
  }

  /**
   * THE condition of the work that waits for THIS person's decision, for these filters; `null` when the person decides
   * nothing at all. `summary.awaitingMyApproval` counts it and `items` with `awaiting=approval` lists it: one condition.
   *
   * It is the rule of the decision route (`POST .../steps/:stepKey/decision`), written as a condition of the query:
   *   - the person is active and holds `approve:ProcessingStep` (the route's guard), and
   *   - the RECORD is within the person's OWN scope: `recordScopes().inScope`, the record branch alone. The step branch
   *     is never used: a person who opens a record only through a step, or a delegation, does not decide (`mayDecide`), and
   *   - the step is REPORTED and a RESULT report of it stands (not withdrawn, not superseded): the two things the
   *     decision command (`ProcessingResultsService.decide`) asks of the step. It asks NOTHING ELSE, so neither does
   *     this: a record that is suspended, finished or paused, and a flow that is only a proposal, are decided on by the
   *     route today and are therefore on the card; a deleted record is not (the route cannot read it, and `inScope`
   *     leaves it out). Whether the flow step asks for approval is not asked by the command either (the commands leave
   *     a step REPORTED only when it does). Proven state by state against the real command in the DB spec; a change of
   *     the command's rule must change this condition with it.
   *
   * Counted as everything on this screen is: per party of the role asked (MAIN when none is), so a step with two MAIN
   * units is two rows. The filters `kind`, `teamId`, `role`, the period and the search apply; `mine` does NOT (the work
   * is somebody else's by definition: the approver is not the person named on it). No instant is compared: a step waits
   * whatever its deadline, and one with no deadline waits too.
   *
   * The UNIT of the number: rows of work, as above. The route decides per STEP; a step with two MAIN units is one
   * decision and two rows here.
   */
  async awaitingWhere(user: GatewayUser, filter: TrackingFilter): Promise<WorkWhere | null> {
    const holders = await this.prisma.user.count({ where: { AND: [{ id: user.id, isActive: true }, userHoldingPermission('approve', 'ProcessingStep')] } });
    if (holders === 0) return null;
    const scopes = await this.recordScopes(user, filter.kind);
    const own: WorkWhere[] = RECORD_KINDS.flatMap((kind) => {
      const scope = scopes[kind];
      return scope ? [{ recordStep: { recordKind: kind, recordFlow: { [RECORD_LINK[kind].relation]: { is: scope.inScope } } } } as WorkWhere] : [];
    });
    if (own.length === 0) return null;
    const parts: WorkWhere[] = [
      { role: filter.role ?? 'MAIN' },
      { recordStep: { status: 'REPORTED', reports: { some: { kind: 'RESULT', withdrawnAt: null, supersededAt: null } }, ...(filter.kind ? { recordKind: filter.kind } : {}) } },
      { OR: own },
    ];
    const started = periodOf(filter.from, filter.to);
    if (started) parts.push({ recordStep: { startAt: started } });
    if (filter.teamId) parts.push({ teamId: filter.teamId });
    const search = await this.searchFor(user, filter.q);
    if (search) parts.push(search);
    return { AND: parts };
  }

  /**
   * THE search of this person, as a condition over the work rows (`searchWhere`); `null` when there is nothing to search.
   * `summary`, `items` and `awaitingWhere` ask here ONCE per request and hand the same condition to every number.
   */
  async searchFor(user: GatewayUser, q: string | undefined): Promise<WorkWhere | null> {
    if (searchText(q) === null) return null;
    return searchWhere(q, await this.caseCodeWhere(user, 'search'));
  }

  /**
   * The cases whose CODE this person may read (`read`: it is shown on a row) or search by (`search`), under the field
   * policy the case's own schema pins (`CaseFieldSchemaService.readableNativeWhere`, the rule the case list applies to
   * the native fields it filters on): a schema that marks `caseCode` RESTRICTED opens it only to a holder of the
   * capability `read_sensitive`, or of a sensitive-access grant on that case. To search, the schema must also not mark
   * the code `searchable: false` (then nobody matches it). A person who may read no case: nothing.
   *
   * The answer is the POLICY alone, to be added to a reach the caller already has (the work rows a person reaches, the
   * records of their list). The schemas known are those of the cases within the person's own scope: a case reached
   * only through a step whose schema is none of those shows no code and is matched by no search (closed, not open).
   *
   * Being able to OPEN a case says nothing about its fields: a row of such a case shows its step and no code, and a
   * search by that code matches nothing for that person (so no fragment of it can be probed through the counts).
   */
  async caseCodeWhere(user: GatewayUser, purpose: 'read' | 'search'): Promise<Prisma.CaseWhereInput> {
    const fields = new CaseFieldSchemaService(this.prisma, new CaseGovernanceService(this.prisma));
    let readable: Prisma.CaseWhereInput;
    try {
      readable = await fields.readableNativeWhere(this.prisma, { actorId: user.id }, ['caseCode']);
    } catch (error) {
      if (error instanceof ForbiddenException) return { id: { in: [] } };
      throw error;
    }
    // `readable` is { AND: [the cases the person reaches by their own scope, the POLICY partitions] }. Only the policy
    // is answered: every caller adds it to a reach of its own (a row of work may be reached through a step, where the
    // person's scope does not go), and the policy alone must never widen anything. A shape this does not know: nothing.
    const parts = (readable as { AND?: unknown }).AND;
    if (!Array.isArray(parts) || parts.length !== 2) return { id: { in: [] } };
    const policy = parts[1] as Prisma.CaseWhereInput;
    if (purpose === 'read') return policy;
    const schemas = await this.prisma.caseFieldDefinitionVersion.findMany({ where: { cases: { some: readable } }, select: { id: true, status: true, publishedAt: true, definition: true } });
    const closed = schemas
      .filter((schema) => {
        if (!isPublishedFieldSchema(schema)) return false;
        const policies = (schema.definition as { fieldPolicies?: Array<{ key: string; searchable?: boolean }> } | null)?.fieldPolicies ?? [];
        return policies.some((policy) => policy.searchable === false && nativePolicyAliases(policy.key).includes('caseCode'));
      })
      .map((schema) => schema.id);
    if (closed.length === 0) return policy;
    // Written without NOT: a case with no schema has NULL there, and NOT of NULL drops the row.
    return { AND: [policy, { OR: [{ fieldDefinitionVersionId: null }, { fieldDefinitionVersionId: { notIn: closed } }] }] };
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
  proposalWhere(user: GatewayUser, filter: TrackingFilter, reach: WorkWhere, acting: readonly string[] = [], search: WorkWhere | null = null): WorkWhere {
    const parts: WorkWhere[] = [{ recordStep: { recordFlow: awaitsConfirmation(), ...(filter.kind ? { recordKind: filter.kind } : {}) } }, reach];
    if (filter.teamId || filter.mine) parts.push({ role: 'MAIN' });
    if (filter.teamId) parts.push({ teamId: filter.teamId });
    if (filter.mine) parts.push(mineWhere(user.id, acting));
    if (search) parts.push(search);
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
   * A kind the person may not read is absent. `reach` is built from this and nothing else.
   *
   * `onList`: the records the LIST of that kind shows the person. For a petition and an incident it is `inScope`. For a
   * case it is NOT: a person who acts by representation needs the capability `view` to open a case (what a row of work
   * leads to, hence `inScope`) and the independent capability `list` to see it on the list. Whatever counts or lists
   * RECORDS as the list screen would (the backlog's "no flow yet" column and its drill-down) uses `onList`.
   */
  async recordScopes(user: GatewayUser, only?: RecordKind): Promise<Partial<Record<RecordKind, RecordScope>>> {
    const scope = await requestScopeOf(this.scopes, user);
    const found: Partial<Record<RecordKind, RecordScope>> = {};

    for (const kind of RECORD_KINDS) {
      if (only && only !== kind) continue;
      if (kind === 'CASE') {
        // Built by hand exactly as the case services do: it holds no state, and asks the process's enforcement itself.
        const governance = new CaseGovernanceService(this.prisma);
        let inScope: Prisma.CaseWhereInput;
        let policyOnly: Prisma.CaseWhereInput;
        let onList: Prisma.CaseWhereInput;
        try {
          // The case list's own visibility (`CasesService.visibilityWhere`): the default capability, `list`.
          onList = await governance.readableCaseWhere(this.prisma, { actorId: user.id });
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
        found.CASE = { inScope: { AND: [inScope, requestScope ?? {}] }, viaStep: policyOnly, onList: { AND: [onList, requestScope ?? {}] } };
        continue;
      }
      const subject = kind === 'PETITION' ? 'Petition' : 'Incident';
      if (!(await holdsReadPermission(this.prisma, user.id, subject))) continue;
      const scopeFilter = kind === 'PETITION' ? buildPetitionScopeFilter(scope, 'read') : buildScopeFilter(scope, 'read', 'Incident');
      // Unrestricted already: the second reason adds nothing.
      const inScope = { AND: [{ deletedAt: null }, scopeFilter ?? {}] };
      found[kind] = { inScope, viaStep: scopeFilter ? { deletedAt: null } : null, onList: inScope };
    }
    return found;
  }

  /** The code and the name of the records of a page: one query per kind present. */
  private async recordNames(user: GatewayUser, records: Array<{ kind: RecordKind; id: string }>): Promise<Map<string, { code: string | null; label: string | null }>> {
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
      // The code only, and only where the case's schema lets THIS person read it (`caseCodeWhere`): a case whose code
      // is restricted for them has no entry, and its row shows the step with no code. The name is never shown.
      const where = { AND: [{ id: { in: cases } }, await this.caseCodeWhere(user, 'read')] };
      for (const row of await this.prisma.case.findMany({ where, select: { id: true, caseCode: true } })) names.set(`CASE:${row.id}`, { code: row.caseCode, label: null });
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

/** A text typed by a person as a LIKE pattern that matches it literally: `%`, `_` and the escape itself are plain characters. */
const literalLike = (text: string): string => text.replace(/[\\%_]/g, (character) => `\\${character}`);

/**
 * THE condition of the search box, over the work rows; `null` when there is nothing to search (fewer than two
 * characters after trimming). The cards, the list, the proposals counted apart and the work waiting for a decision all
 * add this same condition to their own: it only ever NARROWS what the person already reaches.
 *
 * What is matched is what the row shows of its record (`recordNames`): the code people know it by and the name next to
 * it, case-insensitively, anywhere in the text. A case is matched by its code only: its name is a field its own schema
 * may restrict. Its code is a field under the same kind of policy: `caseCode` is the condition of the cases whose code
 * THIS person may search by (`ProcessingTrackingService.caseCodeWhere`), and the case branch matches inside it only;
 * a person the policy gives no searchable code matches NO case (never every case).
 */
export function searchWhere(q: string | undefined, caseCode: Prisma.CaseWhereInput): WorkWhere | null {
  const text = searchText(q);
  if (text === null) return null;
  const has = { contains: literalLike(text), mode: 'insensitive' as const };
  const of = (kind: RecordKind, where: object): WorkWhere => ({ recordStep: { recordKind: kind, recordFlow: { [RECORD_LINK[kind].relation]: { is: where } } } });
  return { OR: [of('PETITION', { OR: [{ stt: has }, { senderName: has }] }), of('INCIDENT', { OR: [{ code: has }, { name: has }] }), of('CASE', { AND: [caseCode, { caseCode: has }] })] };
}

/** The text of a search as it is matched: trimmed, bounded; `null` when it is too short to be one. */
function searchText(q: string | undefined): string | null {
  const text = (q ?? '').trim().slice(0, TRACKING_SEARCH_MAX);
  return text.length < TRACKING_SEARCH_MIN ? null : text;
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
